import type { AsyncSchemaFailure } from '@arki/failure';
import type { JobOperationInput, PageOptions } from '../outbox.js';
import type { JournalTables } from '../pg.js';
import type { DbHandle, TransactionSource } from '../types.js';
import type { MetadataChange, MetadataOutcome, TagsOutcome } from './run-fields.js';
import type { StepPhase, StepStatus } from './states.js';
import type { CancelOutcome, ReplayArgs, RescheduleArgs, RescheduleOutcome, SignalOutcome, StartOutcome } from './run-types.js';
import type { CommandFailure, CommandNotFound, WorkflowStranded } from '../errors.js';
/** Why a run has no code to go on with: no registered workflow has its name and version, or the registered one has other nodes. */
export type StrandedReason = WorkflowStranded['data']['reason'];
type RunRow = JournalTables['workflowRuns']['$inferSelect'];
type StepRow = JournalTables['workflowSteps']['$inferSelect'];
type SignalRow = JournalTables['workflowSignals']['$inferSelect'];
type EventRow = JournalTables['events']['$inferSelect'];
export type RunState = RunRow['state'];
/** A run in a list: without its input, results, output and metadata, which can be large. */
export type RunSummary = Pick<RunRow, 'id' | 'name' | 'workflowVersion' | 'state' | 'node' | 'waitingFor' | 'wakeAt' | 'deadlineAt' | 'parentId' | 'parentPath' | 'scope' | 'tags' | 'rootId' | 'batchId' | 'replayOf' | 'cancelledAt' | 'cancelReason' | 'startAt' | 'ttlAt' | 'maxAttempts' | 'stepTimeoutMs' | 'priority' | 'startedAt' | 'finishedAt'> & {
    /** When a delayed run's first node is due, while that is still ahead and it has not started; otherwise null. */
    readonly delayedUntil: Date | null;
    /** A step of this unfinished run is dead and waits for an operator: a failed `undo`, or a failed `do` while the run is not compensating. */
    readonly stuck: boolean;
    /** The run's code is missing or has other nodes. Null for a finished run and for a run with its code. */
    readonly stranded: StrandedReason | null;
};
export type RunFilter = {
    readonly state?: RunState;
    readonly name?: string;
    readonly version?: number;
    readonly parentId?: string;
    readonly stuck?: boolean;
    /** Runs that have this tag among theirs. */
    readonly tag?: string;
    readonly scope?: string;
    /** The runs of one tree below its top run (the top run itself has no `rootId`). */
    readonly rootId?: string;
    /** The runs one `def.startBatch` started. */
    readonly batchId?: string;
    /** Runs started at or after `from`, and before `to`. */
    readonly from?: Date;
    readonly to?: Date;
};
export type StepView = Pick<StepRow, 'path' | 'phase' | 'attempt' | 'key' | 'jobId' | 'result' | 'error' | 'reason' | 'startedAt' | 'finishedAt'> & {
    /** `running` while the step's job holds a live lease; otherwise what the row stores. */
    readonly status: StepStatus;
    readonly stuck: boolean;
};
/**
 * One run in full. The type parameters type the stored values: `def.read` checks them with the definition's schemas;
 * `journal.workflows.run` leaves them as stored. `output` is `null` until the run completes.
 */
export type RunDetail<Input = unknown, Output = unknown, Results = RunRow['results']> = {
    readonly run: Omit<RunRow, 'input' | 'output' | 'results'> & {
        readonly input: Input;
        readonly output: Output | null;
        readonly results: Results;
        readonly delayedUntil: Date | null;
        readonly stuck: boolean;
        readonly stranded: StrandedReason | null;
    };
    /** Oldest first. */
    readonly steps: readonly StepView[];
    /** The paths whose undo was skipped: the work they did stays done. */
    readonly residual: readonly string[];
    readonly children: readonly Pick<RunRow, 'id' | 'name' | 'workflowVersion' | 'state' | 'parentPath' | 'startedAt' | 'finishedAt'>[];
    /** Signals that arrived and that no wait has taken yet. */
    readonly signals: readonly Pick<SignalRow, 'id' | 'name' | 'deliveryId' | 'payload' | 'receivedAt'>[];
};
export type RunCount = {
    readonly name: string;
    readonly version: number;
    readonly state: RunState;
    readonly runs: number;
};
export type StrandedRun = Pick<RunRow, 'id' | 'name' | 'workflowVersion' | 'state' | 'startedAt'> & {
    readonly code: StrandedReason;
};
export type HistoryEvent = Pick<EventRow, 'seq' | 'id' | 'version' | 'type' | 'data' | 'meta' | 'recordedAt'>;
/**
 * A batch at a glance: how many of its runs are in each state, and their ids, oldest first. `runIds` holds at most
 * `BATCH_LIMIT`; `more` is true when there are more (one id is used by several `startBatch` calls), and
 * `runs(db, { batchId })` pages through all of them.
 */
export type BatchSummary = {
    readonly batchId: string;
    readonly total: number;
    readonly states: Partial<Readonly<Record<RunState, number>>>;
    readonly runIds: readonly string[];
    readonly more: boolean;
};
export type WorkflowReads = {
    /** Runs, newest first, with an opaque `next` cursor (pass it as `after`). `limit` 1 to 200, default 100. */
    runs(db: DbHandle, opts?: RunFilter & PageOptions): Promise<{
        readonly runs: RunSummary[];
        readonly next: string | null;
    }>;
    /** One run with its steps, children and unconsumed signals; undefined when there is no such run. */
    run(db: DbHandle, id: string): Promise<RunDetail | undefined>;
    /** How many runs there are per workflow name, version and state. */
    counts(db: DbHandle): Promise<RunCount[]>;
    /** The runs of one batch: counts by state and the run ids. An unknown batch has none. */
    batch(db: DbHandle, batchId: string): Promise<BatchSummary>;
    /** Unfinished runs whose code is missing or has other nodes, oldest first. `limit` 1 to 200, default 100. */
    stranded(db: DbHandle, opts?: {
        readonly limit?: number;
    }): Promise<StrandedRun[]>;
    /** The run's events, oldest first, with an opaque `next` cursor. */
    history(db: DbHandle, id: string, opts?: PageOptions): Promise<{
        readonly events: HistoryEvent[];
        readonly next: string | null;
    }>;
};
/** The operator verbs. Each writes under the run's row lock, and its events carry `op.actor`, `op.reason` and `op.executionId`. */
export type WorkflowVerbs<Tx> = {
    /**
     * A dead step runs again. A failed `do` or `undo` step gets its next attempt with the same key. A failed child or map
     * node starts its failed children again under new ids (`<id>~2`, then `~3`); the old runs stay as history. When the
     * run is stranded, every dead job of the run (steps, parks, deadline, undos) is retried once the code is registered
     * again, each with the job verb's operations row and a `JobRetried` event; until then the stranded error is thrown.
     * `STEP_NOT_DEAD` for any other step.
     */
    retryStep(source: TransactionSource<Tx>, args: {
        readonly runId: string;
        readonly path: string;
        readonly phase: StepPhase;
    }, op: JobOperationInput): Promise<{
        readonly how: 'rescheduled' | 'childrenRestarted' | 'jobRetried';
    } | CommandFailure>;
    /**
     * Gives the result of a failed `do` step of a running run. The result is checked with the step's `output` schema, then
     * the run carries on as if the step had returned it: the worker routes the result (`next` may be a function) and
     * the body does not run again. `STEP_NOT_RESOLVABLE` for a step with no `output` schema.
     */
    resolveStep(source: TransactionSource<Tx>, args: {
        readonly runId: string;
        readonly path: string;
        readonly result: unknown;
    }, op: JobOperationInput): Promise<{
        readonly runId: string;
    } | CommandFailure>;
    /** Gives up a failed `undo` of a compensating run. `op.reason` is required. Compensation goes on and the path is `residual`. */
    skipUndo(source: TransactionSource<Tx>, args: {
        readonly runId: string;
        readonly path: string;
    }, op: JobOperationInput): Promise<{
        readonly runId: string;
    } | CommandFailure>;
    /**
     * Delivers signal `name` to a run, for an operator who holds only JSON: the run's own version checks the payload
     * (`def.signal(name)` is the typed door for app code; both are one transition). A repeated `deliveryId` is a
     * `duplicate`. `SignalReceived` carries the operator.
     */
    signal(source: TransactionSource<Tx>, args: {
        readonly runId: string;
        readonly name: string;
        readonly deliveryId: string;
        readonly payload: unknown;
    }, op: JobOperationInput): Promise<SignalOutcome | CommandFailure>;
    /** Cancels a run of any workflow, for an operator: the same transition as `def.cancel`. `CancelRequested` carries the operator. */
    cancel(source: TransactionSource<Tx>, args: {
        readonly runId: string;
        readonly reason: string;
    }, op: JobOperationInput): Promise<CancelOutcome | CommandFailure>;
    /**
     * Changes the metadata of an unfinished run (running, parked or compensating), like `ctx.metadata` in a step: one
     * `MetadataChange` (`set`, `increment`, `append` or `remove`) and one `MetadataChanged` event, which carries the
     * operator. `CommandConflict` once the run has finished; `CommandInvalid` for a wrong value type or metadata over the
     * limit. Returns the metadata after the change.
     */
    setMetadata(source: TransactionSource<Tx>, args: {
        readonly runId: string;
        readonly change: MetadataChange;
    }, op: JobOperationInput): Promise<MetadataOutcome | CommandFailure>;
    /**
     * Adds tags to an unfinished run, like `ctx.tags.add`: tags it has already change nothing, the rest go in one
     * `RunTagged` event that carries the operator. `CommandInvalid` past `RUN_FIELD_LIMITS.tags`. Returns all its tags.
     */
    addTags(source: TransactionSource<Tx>, args: {
        readonly runId: string;
        readonly tags: readonly string[];
    }, op: JobOperationInput): Promise<TagsOutcome | CommandFailure>;
    /**
     * Whether `resolveStep` would take `result` for step `path`: the step's `output` schema of the run's own version
     * checks it, and nothing is written. A step `resolveStep` could never resolve throws `STEP_NOT_RESOLVABLE`.
     */
    /**
     * Moves the start of a run whose first node has not started: its first node becomes due at the new time (a time in
     * the past is now), and its `ttl` and deadline count from it. One `RunRescheduled` event carries the operator.
     * `CommandConflict` once the first node has started (a worker holds or has tried its job, or the run moved on);
     * `CommandNotFound` for no such run.
     */
    reschedule(source: TransactionSource<Tx>, args: RescheduleArgs, op: JobOperationInput): Promise<RescheduleOutcome | CommandFailure>;
    /**
     * Starts a new run of the run's workflow at the newest registered version, under a new id, with the old run's input,
     * scope, tags and metadata unless `overrides` gives them (and `delay`, `ttl`). Works for a finished or an
     * unfinished run; its children are not copied, the new run starts its own. The new run's `replayOf` is the old id,
     * and its `RunStarted` carries the operator. It is a start: `WorkflowBusy` at a busy concurrency key (with
     * `onBusy: 'join'`, the running run's id), `InvalidInput` when the input no longer fits the newest input schema,
     * `CommandNotFound` for no such run.
     */
    replay(source: TransactionSource<Tx>, args: ReplayArgs, op: JobOperationInput): Promise<StartOutcome | CommandNotFound | CommandFailure>;
    checkResult(db: DbHandle, args: {
        readonly runId: string;
        readonly path: string;
        readonly result: unknown;
    }): Promise<{
        readonly ok: true;
    } | {
        readonly ok: false;
        readonly issues: string;
    } | AsyncSchemaFailure>;
};
export type WorkflowOps<Tx> = WorkflowReads & WorkflowVerbs<Tx>;
export declare function createWorkflowReads(deps: {
    readonly tables: JournalTables;
    /** The code the journal was composed with, by `name@version`. */
    readonly registry: ReadonlyMap<string, {
        readonly shapeHash: string;
    }>;
}): WorkflowReads;
export {};
//# sourceMappingURL=read.d.ts.map