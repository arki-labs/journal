import type { IdGenerationFailure } from '@arki/contracts';
import type { SchemaOutput, StandardSchemaV1 } from '@arki/schema';
import type { EventLog, ForwardedLog, ForwardLag, ProjectionCursor } from './event-log.js';
import type { History } from './history.js';
import type { HookPointInternal } from './hooks.js';
import type { JournalTables } from './pg.js';
import type { ResolvedRetention } from './retention.js';
import type { BuiltInEventLog } from './store.js';
import type { AcceptFailure, DbHandle, Effect, EffectHookContext, HandlerServices, JobRunner, JournalWorker, Needs, Projection, RootDb, StrandedJobs, Tap, TransactionSource, WakeListener } from './types.js';
/**
 * The retry of an effect or a workflow step that sets none: 7 retries (8 tries), doubling from 1 s to at most
 * 5 minutes. It retries a throw; a returned failure is final.
 */
export declare const defaultEffectRetry: import("@arki/resilience").Backoff;
export type JobRow = JournalTables['jobs']['$inferSelect'];
/**
 * The command part of one effect attempt, made fresh for each attempt. Only a journal-owned effect sees it.
 * `run` is the journal's `run`, bound to the root database the drain was given and to the
 * event the job is for. `accept` marks a refusal that `run` returned as handled.
 * `settle` waits for the handler, ends the attempt (a later `accept` throws), and resolves
 * with the outcome the job records.
 */
export type EffectAttempt<Run> = {
    readonly run: Run;
    /** `run` without the refusal watch, under the same fence. Only a `journalOwnedEffect` gets it (`internal-context.ts`). */
    readonly runUnwatched: Run;
    readonly accept: AcceptFailure;
    readonly settle: (handler: Promise<unknown>) => Promise<unknown>;
};
/** What `drain` needs from the journal. `Run` is the type of the `ctx.run` of a journal-owned effect. */
export type DrainDeps<Meta extends StandardSchemaV1<unknown, Record<string, unknown>>, AppDb extends RootDb, Run> = {
    readonly tables: JournalTables;
    /** The effect hooks. Frozen by the first drain. */
    readonly hooks: HookPointInternal<EffectHookContext<SchemaOutput<Meta>>>;
    /** As composed: an effect may still have needs. Each drain binds them from its `services`. */
    readonly effects: readonly Effect<SchemaOutput<Meta>, AppDb, Needs>[];
    readonly history: Pick<History<Meta>, 'decodeStoredEvent'>;
    /** Makes the command part of one attempt's context, for the effect named `effect`. See `EffectAttempt`. */
    readonly attemptOn: (db: AppDb & RootDb, cause: {
        readonly seq: number;
        readonly correlationId: string | null;
    }, effect: string, 
    /** The attempt row this worker holds open: its command transactions check it. */
    attempt: {
        readonly jobId: string;
        readonly attempt: number;
    }) => EffectAttempt<Run>;
    /** The journal's resolved archive policy. Default: completed jobs kept 7 days. */
    readonly retention?: ResolvedRetention;
    /** Per entity kind, the log its `forward` jobs append to. Empty: no forward lane. */
    readonly forwarded?: ReadonlyMap<string, ForwardedLog>;
};
export declare function createDrain<Meta extends StandardSchemaV1<unknown, Record<string, unknown>>, AppDb extends RootDb, Run>(deps: DrainDeps<Meta, AppDb, Run>): (db: AppDb & RootDb, opts?: {
    readonly batchSize?: number;
    readonly signal?: AbortSignal;
    readonly leaseSeconds?: number;
    readonly services?: HandlerServices;
    readonly jobs?: JobRunner<AppDb>;
}) => Promise<number | IdGenerationFailure>;
/**
 * Counts pending jobs no handler here can claim: effect rows whose effect this journal
 * does not have, and, when a runner is given, queue rows whose name it does not know.
 * `drain` never claims them, on purpose: during a rolling deploy an older worker may
 * still have that handler. But once every worker runs the new code, a renamed or
 * removed handler leaves its jobs here for good, so they must be visible.
 */
export declare function createStrandedJobs(deps: {
    readonly tables: JournalTables;
    readonly effectNames: readonly string[];
    /** The entity kinds this journal forwards: a forward job of another kind waits for a journal that has its log. */
    readonly forwarded?: ReadonlyMap<string, ForwardedLog>;
}): (db: DbHandle, opts?: {
    readonly jobs?: Pick<JobRunner, 'names'>;
}) => Promise<readonly StrandedJobs[]>;
/**
 * How far forwarded logs are behind the rows: the forward jobs still in the table, dead ones
 * included, and when the oldest was written. Zero pending means every forwarded log is current.
 */
export declare function createForwardLag(deps: {
    readonly tables: Pick<JournalTables, 'jobs'>;
}): (db: DbHandle) => Promise<ForwardLag>;
/** What the worker loop needs from the journal. */
export type WorkerDeps<AppDb extends RootDb> = {
    /** Runs one batch. The journal passes its own `drain` method, looked up on each call. */
    readonly drain: (db: AppDb & RootDb, opts?: {
        readonly batchSize?: number;
        readonly signal?: AbortSignal;
        readonly leaseSeconds?: number;
        readonly services?: HandlerServices;
        readonly jobs?: JobRunner<AppDb>;
    }) => Promise<number | IdGenerationFailure>;
    /** One batch per async projection. Returns how many events were scanned. */
    /** The retention sweep: run `run` every `everyMs` while the worker is up. Absent when `retention.sweep` is false. */
    readonly sweep?: {
        readonly everyMs: number;
        readonly run: (db: AppDb & RootDb, signal: AbortSignal) => Promise<void>;
    };
    readonly catchUp: (db: AppDb & RootDb, opts?: {
        readonly batchSize?: number;
    }) => Promise<{
        readonly scanned: number;
    }>;
    /** Fire the taps for one wake payload. */
    readonly dispatch: (db: AppDb & RootDb, payload: string, services: HandlerServices | undefined) => Promise<void>;
    /** Throws when an effect or a tap is missing a service in `services`. */
    readonly checkServices: (services: HandlerServices | undefined) => void;
    readonly tapNames: readonly string[];
};
/** What the async lane of projections needs from the journal. */
export type CatchUpDeps<Meta extends StandardSchemaV1<unknown, Record<string, unknown>>, Tx extends TransactionSource<Tx>> = {
    readonly tables: Pick<JournalTables, 'cursors'>;
    /** The log a projection follows, in its global order: the one log its entities share. */
    readonly logOf: (projection: Pick<Projection, 'entities'>) => EventLog;
    readonly projections: readonly Projection<SchemaOutput<Meta>, Tx>[];
    readonly history: Pick<History<Meta>, 'decodeStoredEvent'>;
};
export declare function createCatchUp<Meta extends StandardSchemaV1<unknown, Record<string, unknown>>, Tx extends TransactionSource<Tx>>(deps: CatchUpDeps<Meta, Tx>): {
    catchUp: (db: RootDb & TransactionSource<Tx>, opts?: {
        readonly batchSize?: number;
    }) => Promise<{
        readonly scanned: number;
    }>;
    reset: (db: RootDb & TransactionSource<Tx>, projection: Projection<SchemaOutput<Meta>, Tx>, clear?: (tx: Tx) => Promise<void>) => Promise<void>;
    cursors: (db: DbHandle) => Promise<readonly ProjectionCursor[]>;
};
/** What tap dispatch needs from the journal. */
export type TapDispatchDeps<Meta extends StandardSchemaV1<unknown, Record<string, unknown>>, AppDb extends RootDb> = {
    /** Taps follow the built-in log only: they read the seq range the wake signal announced. */
    readonly log: Pick<BuiltInEventLog, 'bind'>;
    /** As composed: a tap may still have needs. Each dispatch binds them from its `services`. */
    readonly taps: readonly Tap<SchemaOutput<Meta>, AppDb, Needs>[];
    readonly history: Pick<History<Meta>, 'decodeStoredEvent'>;
};
export declare function createTapDispatch<Meta extends StandardSchemaV1<unknown, Record<string, unknown>>, AppDb extends RootDb>(deps: TapDispatchDeps<Meta, AppDb>): (db: AppDb & RootDb, payload: string, services: HandlerServices | undefined) => Promise<void>;
export declare function createWorkers<AppDb extends RootDb>(deps: WorkerDeps<AppDb>): {
    worker: (db: AppDb & RootDb, opts?: {
        readonly pollMs?: number;
        readonly batchSize?: number;
        readonly leaseSeconds?: number;
        readonly listen?: WakeListener;
        readonly taps?: boolean;
        readonly services?: HandlerServices;
        readonly jobs?: JobRunner<AppDb>;
    }) => JournalWorker;
    wakeAll: () => void;
};
//# sourceMappingURL=worker.d.ts.map