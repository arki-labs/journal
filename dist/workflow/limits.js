/**
 * Named limits at runtime: the `journal.limit` entity that holds what an operator changed (`journal_limits`), its
 * schemas, and the start gate's reads (`createLimitGate`), which say which limit, if any, blocks a start. The types and
 * bounds are in `limit-types.ts`.
 */
import { and, arrayContains, asc, count, eq, gt, inArray, isNull, ne, not, or, sql } from 'drizzle-orm';
import { z } from 'zod';
import { LIMIT_BOUNDS } from './limit-types.js';
import { byOperator } from './machine.js';
const at = z.iso.datetime();
/** An override count: 0 admits no run. */
const overrideCount = z.int().nonnegative();
/** Checks a stored key override. The type is the source; `schemas.test-d.ts` locks this schema to it both ways. */
export const limitKeyOverrideSchema = z.object({ perKey: overrideCount, until: at }).readonly();
/** The values a `LimitOverridden` sets; one it leaves out keeps what the row has. */
const overridden = (data) => ({
    ...(data.total === undefined ? {} : { total: data.total }),
    ...(data.perKey === undefined ? {} : { perKey: data.perKey }),
});
/**
 * The `journal.limit` entity: one row per limit an operator changed, in `journal_limits`. A limit nobody changed has
 * no row, and its code values apply.
 */
export function limitMachine(j, tables) {
    const LimitOverridden = j.event('LimitOverridden', z.object({ total: overrideCount.optional(), perKey: overrideCount.optional(), at, ...byOperator }));
    /** `expired`: the keys whose override had run out when this one was written; the row drops them. */
    const LimitKeyOverridden = j.event('LimitKeyOverridden', z.object({
        key: z.string().min(1),
        ...limitKeyOverrideSchema.unwrap().shape,
        expired: z.array(z.string()).readonly(),
        at,
        ...byOperator,
    }));
    /** Without `key`, every override of the limit goes; the pause stays. */
    const LimitReset = j.event('LimitReset', z.object({ key: z.string().min(1).optional(), at, ...byOperator }));
    const LimitPaused = j.event('LimitPaused', z.object({ at, ...byOperator }));
    const LimitResumed = j.event('LimitResumed', z.object({ at, ...byOperator }));
    const unchanged = { paused: false, total: null, perKey: null, keys: {} };
    const keyed = (keys, data) => ({
        ...Object.fromEntries(Object.entries(keys).filter(([key]) => !data.expired.includes(key))),
        [data.key]: { perKey: data.perKey, until: data.until },
    });
    // The verbs write a reset or a resume only on a row that exists, so those two need no create.
    const limit = j
        .entity('journal.limit', tables.limits, { key: 'name', events: 'stored' })
        .create(LimitOverridden, e => ({ ...unchanged, ...overridden(e.data) }))
        .create(LimitKeyOverridden, e => ({ ...unchanged, keys: keyed({}, e.data) }))
        .create(LimitPaused, () => ({ ...unchanged, paused: true }))
        .on(LimitOverridden, (_row, e) => overridden(e.data))
        .on(LimitKeyOverridden, (row, e) => ({ keys: keyed(row.keys, e.data) }))
        .on(LimitReset, (row, e) => {
        const { key } = e.data;
        if (key === undefined)
            return { total: null, perKey: null, keys: {} };
        return { keys: Object.fromEntries(Object.entries(row.keys).filter(([kept]) => kept !== key)) };
    })
        .on(LimitPaused, () => ({ paused: true }))
        .on(LimitResumed, () => ({ paused: false }));
    return { limit, events: { LimitOverridden, LimitKeyOverridden, LimitReset, LimitPaused, LimitResumed } };
}
/** The key override of `key` on a stored row, if one is set and has not expired. An expired one is ignored. */
export function liveKeyOverride(keys, key, now) {
    const found = keys?.[key];
    return found !== undefined && new Date(found.until).getTime() > now.getTime() ? found : undefined;
}
/** The advisory lock of a limit. A start takes it shared, an operator verb exclusive, so a verb waits for the starts. */
export const limitLockId = (name) => `journal.limit:${name}`;
const lockShared = (tx, id) => tx.execute(sql `select pg_advisory_xact_lock_shared(hashtextextended(${id}, 0))`);
export const lockExclusive = (tx, id) => tx.execute(sql `select pg_advisory_xact_lock(hashtextextended(${id}, 0))`);
/** What `pg_try_advisory_xact_lock` answers: an array of rows (PGlite) or `{ rows }` (node-postgres). */
const lockedRows = z.array(z.object({ locked: z.boolean() }));
/** Takes an advisory lock if it is free now (or this transaction holds it already); false when another holds it. */
const tryLock = async (tx, id, mode) => {
    const result = await tx.execute(mode === 'shared'
        ? sql `select pg_try_advisory_xact_lock_shared(hashtextextended(${id}, 0)) as locked`
        : sql `select pg_try_advisory_xact_lock(hashtextextended(${id}, 0)) as locked`);
    const parsed = z.union([lockedRows, z.object({ rows: lockedRows })]).parse(result);
    return (Array.isArray(parsed) ? parsed : parsed.rows)[0]?.locked === true;
};
/** Takes an advisory lock, waiting for it. Always true. */
const waitLock = async (tx, id, mode) => {
    await (mode === 'shared' ? lockShared(tx, id) : lockExclusive(tx, id));
    return true;
};
/** The start gate's reads: which limit blocks a start, the runs that hold a limit, and a limit as an operator sees it. */
export function createLimitGate(tables) {
    const { workflowRuns, limits } = tables;
    /** The runs that hold `limit`, whatever their state: a workflow's own by name, a shared one by `limits`. */
    const holds = (limit) => limit.workflow === undefined
        ? arrayContains(workflowRuns.limits, [limit.name])
        : eq(workflowRuns.name, limit.workflow);
    /** The unfinished runs that hold `limit`, and with `key` when it is given. A queued run holds no slot yet. */
    const holding = (limit, key) => and(isNull(workflowRuns.finishedAt), ne(workflowRuns.state, 'queued'), holds(limit), key === null ? undefined : eq(workflowRuns.concurrencyKey, key));
    /** Whether `value` runs hold the limit already. The count stops at `value`, so a large total costs no more to check. */
    const full = async (tx, limit, key, value) => {
        if (value === 0)
            return true;
        const held = tx
            .select({ id: workflowRuns.id })
            .from(workflowRuns)
            .where(holding(limit, key))
            .limit(value)
            .as('held');
        const [row] = await tx.select({ n: count() }).from(held);
        return (row?.n ?? 0) >= value;
    };
    const check = async (tx, start, take) => {
        const { held, key } = start;
        if (!start.gated) {
            const own = held.find(limit => limit.workflow !== undefined);
            if (own === undefined)
                return undefined;
            const [row] = await tx.select({ paused: limits.paused }).from(limits).where(eq(limits.name, own.name));
            return row?.paused === true ? { limit: own, reason: 'paused', scale: undefined, value: 0 } : undefined;
        }
        for (const limit of held) {
            if (!(await take(tx, limitLockId(limit.name), 'shared')))
                return 'locked';
        }
        const rows = await tx
            .select()
            .from(limits)
            .where(inArray(limits.name, held.map(limit => limit.name)));
        const rowOf = (limit) => rows.find(row => row.name === limit.name);
        const paused = held.find(limit => rowOf(limit)?.paused === true);
        if (paused !== undefined)
            return { limit: paused, reason: 'paused', scale: undefined, value: 0 };
        const now = new Date();
        const checks = [];
        for (const limit of held) {
            const row = rowOf(limit);
            const perKey = key === null ? undefined : (liveKeyOverride(row?.keys, key, now)?.perKey ?? row?.perKey ?? limit.perKey);
            if (perKey !== undefined && key !== null) {
                const lock = limit.workflow === undefined
                    ? `${limitLockId(limit.name)}#key:${key}`
                    : `journal.workflow:${limit.workflow}:${key}`;
                checks.push({ limit, scale: 'perKey', value: perKey, lock });
            }
            const total = row?.total ?? limit.total;
            if (total !== undefined)
                checks.push({ limit, scale: 'total', value: total, lock: `${limitLockId(limit.name)}#total` });
        }
        for (const lock of checks.map(entry => entry.lock).sort()) {
            if (!(await take(tx, lock, 'exclusive')))
                return 'locked';
        }
        const first = (entry) => entry.limit.workflow !== undefined && entry.scale === 'perKey' ? 0 : 1;
        for (const entry of [...checks].sort((a, b) => first(a) - first(b))) {
            if (await full(tx, entry.limit, entry.scale === 'perKey' ? key : null, entry.value)) {
                return { limit: entry.limit, reason: 'full', scale: entry.scale, value: entry.value };
            }
        }
        return undefined;
    };
    /** Which limit blocks a start, if any, waiting for each lock (see `check`). */
    const blocking = async (tx, start) => {
        const found = await check(tx, start, waitLock);
        if (found === 'locked')
            throw new Error('journal: a waiting advisory lock cannot be refused');
        return found;
    };
    /**
     * The same check for a promotion, which waits for no lock: `'locked'` when another transaction holds one the
     * candidate needs. A promotion runs inside the write of a run end or a verb, after its own limit locks, and a
     * candidate may hold other limits whose locks sort before those. Waiting for them could make two transactions wait
     * on each other in opposite orders; trying them never can. A candidate that finds one taken stays queued.
     */
    const tryBlocking = (tx, start) => check(tx, start, tryLock);
    /** The ids of the runs of `scope` that hold the blocking limit, oldest first: the runs a busy start may name. */
    const holdersIn = async (tx, block, key, scope) => {
        const found = await tx
            .select({ id: workflowRuns.id })
            .from(workflowRuns)
            .where(and(holding(block.limit, block.scale === 'perKey' ? key : null), scope === null ? isNull(workflowRuns.scope) : eq(workflowRuns.scope, scope)))
            .orderBy(workflowRuns.startedAt, workflowRuns.id)
            .limit(Math.min(Math.max(block.value, 1), LIMIT_BOUNDS.runningShown));
        return found.map(row => row.id);
    };
    /**
     * The id of the oldest queued run (by start, then id) that holds one of `among`, with `key` when it is given, and
     * that no `skip` leaves out. A run past its `ttl_at` is left to its ttl timer, which ends it `expired`.
     */
    const oldestQueued = async (tx, among, key, skips) => {
        const [found] = await tx
            .select({ id: workflowRuns.id })
            .from(workflowRuns)
            .where(and(eq(workflowRuns.state, 'queued'), or(...among.map(limit => holds(limit))), key === null ? undefined : eq(workflowRuns.concurrencyKey, key), or(isNull(workflowRuns.ttlAt), gt(workflowRuns.ttlAt, sql `now()`)), ...skips.map(skip => 'id' in skip
            ? ne(workflowRuns.id, skip.id)
            : skip.key === null
                ? not(holds(skip.limit))
                : sql `not (${holds(skip.limit)} and ${workflowRuns.concurrencyKey} is not distinct from ${skip.key})`)))
            .orderBy(asc(workflowRuns.startedAt), asc(workflowRuns.id))
            .limit(1);
        return found?.id;
    };
    /** A limit as `journal.limits` shows it, read now. */
    const view = async (db, known) => {
        const [row] = await db.select().from(limits).where(eq(limits.name, known.name));
        const [running] = await db.select({ n: count() }).from(workflowRuns).where(holding(known, null));
        const [queued] = await db
            .select({ n: count() })
            .from(workflowRuns)
            .where(and(eq(workflowRuns.state, 'queued'), holds(known)));
        const now = new Date();
        const code = { total: known.total ?? null, perKey: known.perKey ?? null };
        const override = { total: row?.total ?? null, perKey: row?.perKey ?? null };
        return {
            name: known.name,
            workflows: known.workflows,
            code,
            override,
            keys: Object.entries(row?.keys ?? {})
                .filter(([key]) => liveKeyOverride(row?.keys, key, now) !== undefined)
                .map(([key, value]) => ({ key, ...value })),
            effective: known.gated
                ? { total: override.total ?? code.total, perKey: known.keyed ? (override.perKey ?? code.perKey) : null }
                : { total: null, perKey: null },
            paused: row?.paused ?? false,
            running: running?.n ?? 0,
            queued: queued?.n ?? 0,
            version: row?.version ?? 0,
        };
    };
    return { blocking, tryBlocking, holdersIn, oldestQueued, view };
}
/** The keys of a stored row whose override has run out by `now`: a new key override drops them from the row. */
export const expiredKeys = (keys, now) => Object.keys(keys ?? {}).filter(key => liveKeyOverride(keys, key, now) === undefined);
//# sourceMappingURL=limits.js.map