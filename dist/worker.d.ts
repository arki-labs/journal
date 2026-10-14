/**
 * The async lane: job claims under a lease, the retry policy, `drain` (one batch),
 * the worker loop around it, waking sleeping workers, and counting jobs no
 * effect of this journal can claim.
 * May import `fold`, `history`, `storage` and leaf files.
 * Must not import `journal`, `api`, `write` or `command`.
 */
import type { z } from 'zod';
import type { History } from './history.js';
import type { HookPointInternal } from './hooks.js';
import type { JournalTables } from './pg.js';
import type { DbHandle, Effect, EffectHookContext, HandlerServices, JournalWorker, Needs, Projection, RootDb, StrandedJobs, Tap, TransactionSource, WakeListener } from './types.js';
export type JobRow = JournalTables['jobs']['$inferSelect'];
/** What `drain` needs from the journal. `Run` is the type of an effect's `ctx.run`. */
export type DrainDeps<Meta extends z.ZodObject, AppDb extends RootDb, Run> = {
    readonly tables: JournalTables;
    /** The effect hooks. Frozen by the first drain. */
    readonly hooks: HookPointInternal<EffectHookContext<z.output<Meta>>>;
    /** As composed: an effect may still have needs. Each drain binds them from its `services`. */
    readonly effects: readonly Effect<z.output<Meta>, AppDb, Run, Needs>[];
    readonly history: Pick<History<Meta>, 'decodeStoredEvent'>;
    /** Makes an effect's `ctx.run`: the journal's `run`, bound to the root database this drain was given and to the event the job is for. */
    readonly runOn: (db: AppDb & RootDb, cause: {
        readonly seq: number;
        readonly correlationId: string | null;
    }) => Run;
};
export declare function createDrain<Meta extends z.ZodObject, AppDb extends RootDb, Run>(deps: DrainDeps<Meta, AppDb, Run>): (db: AppDb & RootDb, opts?: {
    readonly batchSize?: number;
    readonly signal?: AbortSignal;
    readonly leaseSeconds?: number;
    readonly services?: HandlerServices;
}) => Promise<number>;
/**
 * Counts pending jobs whose effect this journal does not have. `drain` never
 * claims them, on purpose: during a rolling deploy an older worker may still
 * have that effect. But once every worker runs the new code, a renamed or
 * removed effect leaves its jobs here for good, so they must be visible.
 */
export declare function createStrandedJobs(deps: {
    readonly tables: JournalTables;
    readonly effectNames: readonly string[];
}): (db: DbHandle) => Promise<readonly StrandedJobs[]>;
/** The job verbs an operator uses: list, retry a dead job, discard a dead job. */
export declare function createAdmin(deps: {
    readonly tables: JournalTables;
    readonly wake: () => void;
}): {
    jobs: (db: DbHandle, opts?: {
        readonly status?: 'pending' | 'dead' | 'all';
        readonly effect?: string;
        readonly limit?: number;
    }) => Promise<JobRow[]>;
    retry: (db: DbHandle, jobId: string) => Promise<void>;
    discard: (db: DbHandle, jobId: string) => Promise<void>;
};
/** What the worker loop needs from the journal. */
export type WorkerDeps<AppDb extends RootDb> = {
    /** Runs one batch. The journal passes its own `drain` method, looked up on each call. */
    readonly drain: (db: AppDb & RootDb, opts?: {
        readonly batchSize?: number;
        readonly signal?: AbortSignal;
        readonly leaseSeconds?: number;
        readonly services?: HandlerServices;
    }) => Promise<number>;
    /** One batch per async projection. Returns how many events were scanned. */
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
export type CatchUpDeps<Meta extends z.ZodObject, Tx extends TransactionSource<Tx>> = {
    readonly tables: JournalTables;
    readonly projections: readonly Projection<z.output<Meta>, Tx>[];
    readonly history: Pick<History<Meta>, 'decodeStoredEvent'>;
};
export declare function createCatchUp<Meta extends z.ZodObject, Tx extends TransactionSource<Tx>>(deps: CatchUpDeps<Meta, Tx>): {
    catchUp: (db: RootDb & TransactionSource<Tx>, opts?: {
        readonly batchSize?: number;
    }) => Promise<{
        readonly scanned: number;
    }>;
    reset: (db: RootDb & TransactionSource<Tx>, projection: Projection<z.output<Meta>, Tx>, clear?: (tx: Tx) => Promise<void>) => Promise<void>;
    cursors: (db: DbHandle) => Promise<readonly {
        readonly name: string;
        readonly seq: number;
        readonly lag: number;
    }[]>;
};
/** What tap dispatch needs from the journal. */
export type TapDispatchDeps<Meta extends z.ZodObject, AppDb extends RootDb> = {
    readonly tables: Pick<JournalTables, 'events'>;
    /** As composed: a tap may still have needs. Each dispatch binds them from its `services`. */
    readonly taps: readonly Tap<z.output<Meta>, AppDb, Needs>[];
    readonly history: Pick<History<Meta>, 'decodeStoredEvent'>;
};
export declare function createTapDispatch<Meta extends z.ZodObject, AppDb extends RootDb>(deps: TapDispatchDeps<Meta, AppDb>): (db: AppDb & RootDb, payload: string, services: HandlerServices | undefined) => Promise<void>;
export declare function createWorkers<AppDb extends RootDb>(deps: WorkerDeps<AppDb>): {
    worker: (db: AppDb & RootDb, opts?: {
        readonly pollMs?: number;
        readonly batchSize?: number;
        readonly leaseSeconds?: number;
        readonly listen?: WakeListener;
        readonly taps?: boolean;
        readonly services?: HandlerServices;
    }) => JournalWorker;
    wakeAll: () => void;
};
//# sourceMappingURL=worker.d.ts.map