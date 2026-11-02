/**
 * What an operator reads about workflow runs: a page of runs, one run with its steps, counts, the stranded runs and a
 * run's events. Everything derived (`running`, `stuck`, `residual`, `stranded`) is worked out here from the run,
 * step, signal and job tables; nothing is stored for it.
 */
import { and, arrayContains, asc, count, desc, eq, getTableColumns, gte, isNull, lt, or, sql } from 'drizzle-orm';
import { z } from 'zod';
import { JournalError } from '../errors.js';
import { bounded, cursorText, LIST_LIMIT, pageOf, pastCursor } from '../outbox.js';
import { stepStatusSql } from './machine.js';
import { BATCH_LIMIT } from './run-fields.js';
import { codeOf } from './stranded.js';
import { withWaitEvents } from './wait-results.js';
const seqCursor = z.int().positive();
// `btoa` rather than `Buffer`: the package runs in the browser and Hermes too.
const encodeSeq = (seq) => btoa(String(seq)).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '');
function decodeSeq(after) {
    try {
        return seqCursor.parse(Number(atob(after.replaceAll('-', '+').replaceAll('_', '/'))));
    }
    catch {
        throw new JournalError('BAD_ARGUMENT', 'workflow', 'after', 'not a cursor this journal gave out; pass the `next` of a previous page unchanged');
    }
}
export function createWorkflowReads(deps) {
    const { tables, registry } = deps;
    const { workflowRuns: runs, workflowSteps: steps, workflowSignals: signals, events: eventsTable } = tables;
    const strandedOf = (run) => {
        if (run.finishedAt !== null)
            return null;
        const code = codeOf(run, registry);
        if (!(code instanceof JournalError))
            return null;
        return code.code === 'WORKFLOW_SHAPE_CHANGED' ? 'WORKFLOW_SHAPE_CHANGED' : 'WORKFLOW_UNKNOWN';
    };
    /** A dead step of an unfinished run. A failed `do` while the run compensates is settled, not waiting for anyone. */
    const stuckSql = sql `(${runs.finishedAt} IS NULL AND EXISTS (SELECT 1 FROM ${steps} WHERE ${steps.runId} = ${runs.id} AND ${steps.status} = 'failed' AND (${steps.phase} = 'undo' OR ${runs.state} <> 'compensating')))`;
    /** `start_at` while it is ahead by the database clock and the run has not started (`running`, no node result). */
    const delayedUntilSql = sql `CASE WHEN ${runs.startAt} > now() AND ${runs.state} = 'running' AND ${runs.results} = '{}'::jsonb THEN ${runs.startAt} END`.mapWith(runs.startAt);
    const summaryColumns = {
        id: runs.id,
        name: runs.name,
        workflowVersion: runs.workflowVersion,
        state: runs.state,
        node: runs.node,
        waitingFor: runs.waitingFor,
        wakeAt: runs.wakeAt,
        deadlineAt: runs.deadlineAt,
        parentId: runs.parentId,
        parentPath: runs.parentPath,
        scope: runs.scope,
        tags: runs.tags,
        rootId: runs.rootId,
        batchId: runs.batchId,
        replayOf: runs.replayOf,
        cancelledAt: runs.cancelledAt,
        cancelReason: runs.cancelReason,
        startAt: runs.startAt,
        ttlAt: runs.ttlAt,
        maxAttempts: runs.maxAttempts,
        stepTimeoutMs: runs.stepTimeoutMs,
        priority: runs.priority,
        startedAt: runs.startedAt,
        finishedAt: runs.finishedAt,
        delayedUntil: delayedUntilSql,
    };
    const runsPage = async (db, opts) => {
        const limit = bounded('workflow runs', opts?.limit, LIST_LIMIT);
        const rows = await db
            .select({
            ...summaryColumns,
            shapeHash: runs.shapeHash,
            stuck: stuckSql,
            cursorAt: cursorText(runs.startedAt),
        })
            .from(runs)
            .where(and(opts?.state === undefined ? undefined : eq(runs.state, opts.state), opts?.name === undefined ? undefined : eq(runs.name, opts.name), opts?.version === undefined ? undefined : eq(runs.workflowVersion, opts.version), opts?.parentId === undefined ? undefined : eq(runs.parentId, opts.parentId), opts?.stuck === undefined ? undefined : opts.stuck ? stuckSql : sql `NOT ${stuckSql}`, opts?.tag === undefined ? undefined : arrayContains(runs.tags, [opts.tag]), opts?.scope === undefined ? undefined : eq(runs.scope, opts.scope), opts?.rootId === undefined ? undefined : eq(runs.rootId, opts.rootId), opts?.batchId === undefined ? undefined : eq(runs.batchId, opts.batchId), opts?.from === undefined ? undefined : gte(runs.startedAt, opts.from), opts?.to === undefined ? undefined : lt(runs.startedAt, opts.to), pastCursor(opts?.after, runs.startedAt, runs.id, true)))
            .orderBy(desc(runs.startedAt), desc(runs.id))
            .limit(limit + 1);
        const page = pageOf(rows, limit);
        return {
            runs: page.items.map(({ shapeHash, ...run }) => ({ ...run, stranded: strandedOf({ ...run, shapeHash }) })),
            next: page.next,
        };
    };
    const run = async (db, id) => {
        const [row] = await db
            .select({ ...getTableColumns(runs), delayedUntil: delayedUntilSql, stuck: stuckSql })
            .from(runs)
            .where(eq(runs.id, id))
            .limit(1);
        if (row === undefined)
            return;
        const { stuck, ...base } = row;
        const stepRows = await db
            .select({
            path: steps.path,
            phase: steps.phase,
            status: stepStatusSql(tables),
            attempt: steps.attempt,
            key: steps.key,
            jobId: steps.jobId,
            result: steps.result,
            error: steps.error,
            reason: steps.reason,
            startedAt: steps.startedAt,
            finishedAt: steps.finishedAt,
        })
            .from(steps)
            .where(eq(steps.runId, id))
            .orderBy(asc(steps.startedAt), asc(steps.path), asc(steps.phase));
        const children = await db
            .select({
            id: runs.id,
            name: runs.name,
            workflowVersion: runs.workflowVersion,
            state: runs.state,
            parentPath: runs.parentPath,
            startedAt: runs.startedAt,
            finishedAt: runs.finishedAt,
        })
            .from(runs)
            .where(eq(runs.parentId, id))
            .orderBy(asc(runs.startedAt), asc(runs.id));
        const waiting = await db
            .select({
            id: signals.id,
            name: signals.name,
            deliveryId: signals.deliveryId,
            payload: signals.payload,
            receivedAt: signals.receivedAt,
        })
            .from(signals)
            .where(and(eq(signals.runId, id), isNull(signals.consumedAt)))
            .orderBy(asc(signals.receivedAt), asc(signals.id));
        // An event wait stores a pointer to its event: an operator reads the event as the log has it now.
        const nodes = base.shape.nodes;
        const results = await withWaitEvents(db, tables, id, nodes, base.results);
        const doResults = await withWaitEvents(db, tables, id, nodes, Object.fromEntries(stepRows.filter(step => step.phase === 'do').map(step => [step.path, step.result])));
        return {
            run: { ...base, results, stuck, stranded: strandedOf(base) },
            steps: stepRows.map(step => ({
                ...step,
                result: step.phase === 'do' ? (doResults[step.path] ?? step.result) : step.result,
                stuck: base.finishedAt === null &&
                    step.status === 'failed' &&
                    (step.phase === 'undo' || base.state !== 'compensating'),
            })),
            residual: stepRows.filter(step => step.phase === 'undo' && step.status === 'skipped').map(step => step.path),
            children,
            signals: waiting,
        };
    };
    const counts = db => db
        .select({
        name: runs.name,
        version: runs.workflowVersion,
        state: runs.state,
        runs: count(),
    })
        .from(runs)
        .groupBy(runs.name, runs.workflowVersion, runs.state)
        .orderBy(asc(runs.name), asc(runs.workflowVersion), asc(runs.state));
    const batch = async (db, batchId) => {
        const byState = await db
            .select({ state: runs.state, runs: count() })
            .from(runs)
            .where(eq(runs.batchId, batchId))
            .groupBy(runs.state);
        // One more than the cap tells whether the list is cut.
        const ids = await db
            .select({ id: runs.id })
            .from(runs)
            .where(eq(runs.batchId, batchId))
            .orderBy(asc(runs.startedAt), asc(runs.id))
            .limit(BATCH_LIMIT + 1);
        return {
            batchId,
            total: byState.reduce((sum, row) => sum + row.runs, 0),
            states: Object.fromEntries(byState.map(row => [row.state, row.runs])),
            runIds: ids.slice(0, BATCH_LIMIT).map(row => row.id),
            more: ids.length > BATCH_LIMIT,
        };
    };
    const stranded = async (db, opts) => {
        const limit = bounded('stranded workflow runs', opts?.limit, LIST_LIMIT);
        // One representative run per name, version and shape: the code is the same for all of them.
        const groups = await db
            .select({
            id: sql `min(${runs.id})`,
            name: runs.name,
            workflowVersion: runs.workflowVersion,
            shapeHash: runs.shapeHash,
        })
            .from(runs)
            .where(isNull(runs.finishedAt))
            .groupBy(runs.name, runs.workflowVersion, runs.shapeHash);
        const gone = groups.filter(group => codeOf(group, registry) instanceof JournalError);
        if (gone.length === 0)
            return [];
        const rows = await db
            .select({
            id: runs.id,
            name: runs.name,
            workflowVersion: runs.workflowVersion,
            shapeHash: runs.shapeHash,
            state: runs.state,
            startedAt: runs.startedAt,
            finishedAt: runs.finishedAt,
        })
            .from(runs)
            .where(and(isNull(runs.finishedAt), or(...gone.map(group => and(eq(runs.name, group.name), eq(runs.workflowVersion, group.workflowVersion), eq(runs.shapeHash, group.shapeHash))))))
            .orderBy(asc(runs.startedAt), asc(runs.id))
            .limit(limit);
        return rows.flatMap(({ shapeHash, finishedAt, ...row }) => {
            const code = strandedOf({ ...row, shapeHash, finishedAt });
            return code === null ? [] : [{ ...row, code }];
        });
    };
    const history = async (db, id, opts) => {
        const limit = bounded('workflow history', opts?.limit, LIST_LIMIT);
        const after = opts?.after === undefined ? undefined : decodeSeq(opts.after);
        const rows = await db
            .select({
            seq: eventsTable.seq,
            id: eventsTable.id,
            version: eventsTable.version,
            type: eventsTable.type,
            data: eventsTable.data,
            meta: eventsTable.meta,
            recordedAt: eventsTable.recordedAt,
        })
            .from(eventsTable)
            .where(and(eq(eventsTable.kind, 'workflow.run'), eq(eventsTable.entityId, id), after === undefined ? undefined : sql `${eventsTable.seq} > ${after}`))
            .orderBy(asc(eventsTable.seq))
            .limit(limit + 1);
        const page = rows.slice(0, limit);
        const last = page.at(-1);
        return { events: page, next: rows.length > limit && last !== undefined ? encodeSeq(last.seq) : null };
    };
    return { runs: runsPage, run, counts, batch, stranded, history };
}
//# sourceMappingURL=read.js.map