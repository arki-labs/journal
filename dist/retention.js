import { JournalError } from './errors.js';
/** The units an age string takes: minutes, hours, days. */
export const AGE_UNITS = ['m', 'h', 'd'];
const UNIT_MS = { m: 60_000, h: 3_600_000, d: 86_400_000 };
const AGE_PATTERN = /^(\d+(?:\.\d+)?)([mhd])$/;
const badRetention = (what, detail) => new JournalError('BAD_DEFINITION', 'retention', what, detail);
/** An age in milliseconds. A number is seconds. Throws `BAD_DEFINITION` on anything else. */
export function parseAge(age) {
    if (typeof age === 'number') {
        if (!Number.isFinite(age) || age < 0)
            throw badRetention(String(age), 'an age in seconds must be a finite number, 0 or more');
        return age * 1000;
    }
    const match = AGE_PATTERN.exec(age);
    const amount = match?.[1];
    const unit = match?.[2];
    if (amount === undefined || unit === undefined || (unit !== 'm' && unit !== 'h' && unit !== 'd')) {
        throw badRetention(JSON.stringify(age), "an age is a number of seconds or a string like '30d' (unit m, h or d)");
    }
    return Number(amount) * UNIT_MS[unit];
}
function parseMax(max) {
    if (max === undefined)
        return undefined;
    if (!Number.isInteger(max) || max < 1)
        throw badRetention(String(max), '`max` must be a whole number, 1 or more');
    return max;
}
/** Parse one {@link Keep}. Throws `BAD_DEFINITION` on a bad age or `max`. */
export function parseKeep(keep) {
    if (keep === false)
        return { store: false };
    if (keep === 'forever')
        return { store: true, ageMs: null, untilExported: false, max: undefined };
    if (keep === 'untilExported')
        return { store: true, ageMs: 0, untilExported: true, max: undefined };
    if (typeof keep === 'object') {
        return {
            store: true,
            ageMs: keep.age === 'forever' ? null : parseAge(keep.age),
            untilExported: false,
            max: parseMax(keep.max),
        };
    }
    return { store: true, ageMs: parseAge(keep), untilExported: false, max: undefined };
}
const DEFAULT_SWEEP_BATCH = 1000;
/** The most rows one verb call takes: the same bound `purgeDead` has. */
export const MAX_SWEEP_BATCH = 5000;
/** The defaults, as the synthesis fixes them: completed 7d, dead 90d, retryable 30d, operations forever, sweep hourly. */
export const defaultRetention = {
    retryableFor: '30d',
    completed: '7d',
    dead: '90d',
    operations: 'forever',
    workflows: { completed: '7d', failed: '90d' },
    sweep: { every: '1h', batch: DEFAULT_SWEEP_BATCH },
};
/**
 * Parse one {@link RunRetention} value. Throws `BAD_DEFINITION` for `'untilExported'` and for `max`: neither means
 * anything for a run row. `where` names the setting in the message.
 */
export function parseRunKeep(keep, where) {
    if (keep === 'untilExported')
        throw badRetention("'untilExported'", `${where} cannot be 'untilExported': a run has no archive sink`);
    if (typeof keep === 'object' && keep.max !== undefined)
        throw badRetention(String(keep.max), `${where} cannot set \`max\`: runs have no row cap`);
    return parseKeep(keep);
}
/** Parse the journal-wide policy and fill the defaults. Throws `BAD_DEFINITION` on a bad value. */
export function resolveRetention(retention) {
    const sweep = retention?.sweep;
    if (sweep !== undefined &&
        sweep !== false &&
        sweep.batch !== undefined &&
        (!Number.isInteger(sweep.batch) || sweep.batch < 1 || sweep.batch > MAX_SWEEP_BATCH)) {
        throw badRetention(String(sweep.batch), `\`sweep.batch\` must be a whole number from 1 to ${MAX_SWEEP_BATCH}`);
    }
    const resolved = resolveSweep(sweep);
    return {
        retryableForMs: parseAge(retention?.retryableFor ?? defaultRetention.retryableFor),
        completed: parseKeep(retention?.archive?.completed ?? defaultRetention.completed),
        dead: parseKeep(retention?.archive?.dead ?? defaultRetention.dead),
        sink: retention?.archive?.sink,
        operations: parseKeep(retention?.operations ?? defaultRetention.operations),
        workflows: resolveRunRetention(retention?.workflows),
        sweep: resolved,
    };
}
function resolveRunRetention(runs) {
    const failed = parseRunKeep(runs?.failed ?? defaultRetention.workflows.failed, 'retention.workflows.failed');
    return {
        completed: parseRunKeep(runs?.completed ?? defaultRetention.workflows.completed, 'retention.workflows.completed'),
        failed,
        cancelled: runs?.cancelled === undefined ? failed : parseRunKeep(runs.cancelled, 'retention.workflows.cancelled'),
        expired: runs?.expired === undefined ? failed : parseRunKeep(runs.expired, 'retention.workflows.expired'),
    };
}
function resolveSweep(sweep) {
    if (sweep === false)
        return false;
    const everyMs = parseAge(sweep?.every ?? defaultRetention.sweep.every);
    // A 0 ms interval would make the worker's sweep loop spin without ever sleeping.
    if (everyMs <= 0)
        throw badRetention(String(sweep?.every), '`sweep.every` must be longer than 0');
    return { everyMs, batch: sweep?.batch ?? defaultRetention.sweep.batch };
}
/**
 * The keep rule for one archived row: the effect's (or queue job name's) override if it names this class,
 * else the journal's, which already holds the default. `dead`, `discarded` and `cancelled` share the `dead` class.
 */
export function keepFor(policy, outcome, override) {
    if (outcome === 'completed') {
        return override?.completed === undefined ? policy.completed : parseKeep(override.completed);
    }
    return override?.dead === undefined ? policy.dead : parseKeep(override.dead);
}
/**
 * The keep rule for a run that ended as `outcome`. The workflow's own setting wins over the journal's. A workflow
 * that sets `failed` but not `cancelled` (or `expired`) gives both the same time, as the journal's default does.
 */
export function runKeepFor(policy, own, outcome, workflow) {
    const setting = outcome === 'cancelled' || outcome === 'expired' ? (own[outcome] ?? own.failed) : own[outcome];
    if (setting === undefined)
        return policy.workflows[outcome];
    return parseRunKeep(setting, `workflow "${workflow}": retention.${outcome}`);
}
/** The `keep_until` of a run that ended at `now`. `false` is `now`: the next sweep deletes the row. Null keeps it. */
export function runKeepUntil(keep, now) {
    return keep.store ? keepUntil(keep, now) : now;
}
/** How long a dead job stays retryable in the hot table, in milliseconds. */
export function retryableForMs(policy, override) {
    return override?.retryableFor === undefined ? policy.retryableForMs : parseAge(override.retryableFor);
}
/**
 * The `keep_until` to store when a row is archived at `now`. Null keeps it forever.
 * `'untilExported'` stores `now`: the prune step deletes a row past `keep_until` once the sink has it,
 * so the row goes right after export. Call only when `keep.store` is true; a `false` keep writes no row.
 */
export function keepUntil(keep, now) {
    return keep.ageMs === null ? null : new Date(now.getTime() + keep.ageMs);
}
/**
 * The override for a job row's effect, by name. The one lookup the worker's ack and the operator verbs share, so a
 * job is archived under the same rule whoever removes it. Queue rows have none here: a queue job's override comes
 * from its runner, which only a worker holds.
 */
export function effectOverrides(effects) {
    const byName = new Map(effects.map(effect => [effect.name, effect.schedule.retention]));
    return job => (job.effect === null ? undefined : byName.get(job.effect));
}
const needsSink = (keep) => keep.store && keep.untilExported;
/**
 * Boot check. `'untilExported'` means "keep only until the sink has it", so it needs a sink; effects are defined
 * before the runtime journal exists, so the type cannot say this and the journal checks it once, at init.
 * Also parses every effect override, so a bad age fails at init instead of at the first ack.
 */
export function assertRetention(policy, effects) {
    if (policy.sink === undefined && (needsSink(policy.completed) || needsSink(policy.dead))) {
        throw new JournalError('BAD_DEFINITION', 'retention', 'journal', "journal: retention 'untilExported' needs `retention.archive.sink`; without one nothing is ever exported");
    }
    if (needsSink(policy.operations)) {
        throw badRetention("'untilExported'", "`operations` cannot be 'untilExported': the audit has no sink");
    }
    for (const effect of effects) {
        const override = effect.schedule.retention;
        if (override === undefined)
            continue;
        const parsed = [override.completed, override.dead].flatMap(keep => (keep === undefined ? [] : [parseKeep(keep)]));
        if (override.retryableFor !== undefined)
            parseAge(override.retryableFor);
        if (policy.sink === undefined && parsed.some(keep => needsSink(keep))) {
            throw new JournalError('BAD_DEFINITION', 'effect', effect.name, `journal: effect "${effect.name}": retention 'untilExported' needs \`retention.archive.sink\`; without one nothing is ever exported`);
        }
    }
}
const pad = (n, width = 2) => String(n).padStart(width, '0');
/**
 * An {@link ArchiveSink} that writes one NDJSON file per batch: one JSON line per archived job, in batch order.
 * The key is `<prefix>/YYYY/MM/DD/<first archived_at in ms>-<first id>.ndjson` (UTC). Resending a batch after a
 * crash between write and mark gives the same key when the batch starts at the same row, so a store that overwrites
 * by key makes the retry harmless; a different start gives another file and the reader dedupes on `id`.
 */
export function ndjsonArchiveSink(
// Called as `options.put(...)`, not detached: an adapter's `put` may use `this`.
options) {
    const prefix = (options.prefix ?? 'journal-archive').replace(/\/+$/, '');
    const encoder = new TextEncoder();
    return {
        name: 'ndjson',
        async write(rows) {
            const first = rows[0];
            if (first === undefined)
                return;
            const at = first.archivedAt;
            const day = `${at.getUTCFullYear()}/${pad(at.getUTCMonth() + 1)}/${pad(at.getUTCDate())}`;
            const key = `${prefix}/${day}/${at.getTime()}-${first.id}.ndjson`;
            await options.put(key, encoder.encode(rows.map(row => `${JSON.stringify(row)}\n`).join('')));
        },
    };
}
//# sourceMappingURL=retention.js.map