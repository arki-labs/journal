/**
 * The job verbs an operator uses: read the hot table and the archive, retry, discard, cancel, purge and replay.
 * Every verb that changes jobs writes exactly one `journal_job_operations` row in the same transaction, so the
 * audit and the change commit or roll back together. A caller's transaction is joined (a nested transaction is a
 * savepoint); the wake fires after commit only when the verb opened the transaction itself.
 * Imports only leaf files. Must not import `journal`, `api` or `worker` (the `JobRow` type is the one exception).
 */
import type { SQL } from 'drizzle-orm';
import type { IdGenerationFailure } from '@arki/contracts';
import type { ForwardedLog } from './event-log.js';
import type { JournalTables } from './pg.js';
import type { ArchivedJob, ArchiveOutcome, EffectRetention, ResolvedRetention } from './retention.js';
import type { DbHandle } from './types.js';
import type { JobRow } from './worker.js';
/** Where a job is right now, from the database clock. `ready` and `delayed` are waiting; `running` holds a live lease. */
export type JobState = 'ready' | 'delayed' | 'running' | 'dead';
export type JobFilter = {
    /** `pending`: ready, delayed and running together. Default `pending`. */
    readonly status?: JobState | 'pending' | 'all';
    readonly effect?: string;
    readonly job?: string;
};
/** Ids (at most 500), or a filter over dead jobs, oldest dead first (`limit` default 100, at most 500). */
export type JobSelection = {
    readonly ids: readonly string[];
} | {
    readonly effect?: string;
    readonly job?: string;
    readonly deadBefore?: Date;
    readonly limit?: number;
};
/** Who asked, and why. `actor` is a free string the app owns: a user id, `system:retention`, a script name. */
export type JobOperationInput = {
    readonly actor: string;
    readonly reason?: string;
    /** The Foreman execution that asked for it. */
    readonly executionId?: string;
};
export type JobAttempt = JournalTables['jobAttempts']['$inferSelect'];
export type JobOperation = JournalTables['jobOperations']['$inferSelect'];
export type { ArchivedJob } from './retention.js';
/** The event header of an effect job. The payload is not read. */
export type EventHeader = {
    readonly seq: number;
    readonly id: string;
    readonly kind: string;
    readonly entityId: string;
    readonly version: number;
    readonly type: string;
    readonly recordedAt: Date;
};
export type JobWithState = JobRow & {
    readonly state: JobState;
};
export type JobDetail = JobWithState & {
    /** Null on a queue job. */
    readonly event: EventHeader | null;
    /** Oldest first. A retried job keeps the attempts of its earlier runs; attempt numbers restart at 1. */
    readonly attemptLog: readonly JobAttempt[];
    /** The latest 100 operations that touched this job, newest first. */
    readonly operations: readonly JobOperation[];
};
export type JobCount = {
    readonly kind: JobRow['kind'];
    /** The effect name, or the queue job name. */
    readonly name: string;
    readonly ready: number;
    readonly delayed: number;
    readonly running: number;
    readonly dead: number;
    readonly oldestDeadAt: Date | null;
};
/** `after` is the `next` of the previous page, passed back untouched. */
export type PageOptions = {
    readonly limit?: number;
    readonly after?: string;
};
export declare const LIST_LIMIT: {
    readonly default: 100;
    readonly max: 200;
};
export type JobOpsDeps = {
    readonly tables: JournalTables;
    readonly retention: ResolvedRetention;
    /** Wakes this process's workers. */
    readonly wake: () => void;
    /** The per-effect retention override of a job row (the worker's lookup, shared). Default: none. */
    readonly overrideFor?: (job: {
        readonly effect: string | null;
    }) => EffectRetention | undefined;
    /** Per entity kind, the log its forward jobs append to: `discard` asks it whether a forward job's events landed. */
    readonly forwarded?: ReadonlyMap<string, ForwardedLog>;
};
export declare function bounded(what: string, value: number | undefined, range: {
    readonly default: number;
    readonly max: number;
}): number;
/** The column as microsecond-exact UTC text, selected next to each paged row. */
export declare const cursorText: (column: SQL | {
    readonly name: string;
}) => SQL<string>;
/** The row comparison for the page after `after`: `(column, id)` strictly past the cursor in the sort direction. */
export declare function pastCursor(after: string | undefined, column: SQL | {
    readonly name: string;
}, id: SQL | {
    readonly name: string;
}, newestFirst: boolean): SQL<unknown> | undefined;
/** Cut a `limit + 1` fetch into a page and the cursor of its last row. */
export declare function pageOf<Row extends {
    readonly id: string;
    readonly cursorAt: string;
}>(rows: readonly Row[], limit: number): {
    items: Omit<Row, "cursorAt">[];
    next: string | null;
};
/**
 * The job verbs the app and Foreman call. A job a workflow run owns (`run_id` set) is the run's to move: `retry`,
 * `discard`, `cancel` and `replayJob` refuse it with `JOB_MANAGED`, and `retryDead` and `purgeDead` skip it.
 */
export declare function createJobOps(deps: JobOpsDeps): {
    jobs: (db: DbHandle, opts?: JobFilter & PageOptions) => Promise<{
        readonly jobs: JobWithState[];
        readonly next: string | null;
    }>;
    job: (db: DbHandle, id: string) => Promise<JobDetail | undefined>;
    jobCounts: (db: DbHandle) => Promise<JobCount[]>;
    jobOperations: (db: DbHandle, opts?: PageOptions & {
        readonly jobId?: string;
    }) => Promise<{
        readonly operations: JobOperation[];
        readonly next: string | null;
    }>;
    archivedJobs: (db: DbHandle, opts?: PageOptions & {
        readonly outcome?: ArchiveOutcome;
        readonly effect?: string;
        readonly job?: string;
    }) => Promise<{
        readonly jobs: ArchivedJob[];
        readonly next: string | null;
    }>;
    archivedJob: (db: DbHandle, id: string) => Promise<{
        id: string;
        kind: "effect" | "forward" | "queue";
        eventSeq: number | null;
        effect: string | null;
        jobName: string | null;
        args: unknown;
        dedupeKey: string | null;
        priority: number;
        enqueuedAt: Date;
        attempts: number;
        lastError: string | null;
        outcome: "cancelled" | "completed" | "dead" | "discarded";
        attemptLog: unknown;
        replayOf: string | null;
        finishedAt: Date;
        archivedAt: Date;
        keepUntil: Date | null;
        exportedAt: Date | null;
        runId: string | null;
        stream: string | null;
        streamPosition: number | null;
    } | undefined>;
    archiveStatus: (db: DbHandle) => Promise<{
        rows: number;
        unexported: number;
        oldestUnexportedAt: Date | null;
        pastKeepUntil: number;
    }>;
    retry: (db: DbHandle, id: string, op: JobOperationInput) => Promise<{
        operationId: string;
    } | IdGenerationFailure>;
    discard: (db: DbHandle, id: string, op: JobOperationInput) => Promise<{
        operationId: string;
    } | IdGenerationFailure>;
    cancel: (db: DbHandle, id: string, op: JobOperationInput) => Promise<{
        operationId: string;
    } | IdGenerationFailure>;
    retryDead: (db: DbHandle, selection: JobSelection, op: JobOperationInput) => Promise<{
        ids: readonly string[];
        operationId: string | null;
    } | IdGenerationFailure>;
    purgeDead: (db: DbHandle, opts: {
        readonly olderThan: Date;
        readonly limit?: number;
    }, op: JobOperationInput) => Promise<{
        archived: number;
        deleted: number;
        operationId: string | null;
    } | IdGenerationFailure>;
    replayJob: (db: DbHandle, archivedId: string, op: JobOperationInput) => Promise<{
        jobId: string;
        operationId: string;
    } | IdGenerationFailure>;
    exportArchive: (db: DbHandle, opts?: {
        readonly limit?: number;
        readonly signal?: AbortSignal;
    }, op?: JobOperationInput) => Promise<{
        exported: number;
        failed: boolean;
        operationId: string | null;
    } | IdGenerationFailure>;
    pruneArchive: (db: DbHandle, opts?: {
        readonly limit?: number;
    }, op?: JobOperationInput) => Promise<{
        pruned: number;
        operationId: string | null;
    } | IdGenerationFailure>;
    pruneWorkflows: (db: DbHandle, opts?: {
        readonly limit?: number;
    }, op?: JobOperationInput) => Promise<{
        pruned: number;
        operationId: string | null;
    } | IdGenerationFailure>;
    pruneOperations: (db: DbHandle, opts?: {
        readonly limit?: number;
    }) => Promise<{
        pruned: number;
    }>;
    sweepOnce: (db: DbHandle, signal?: AbortSignal) => Promise<void>;
};
/**
 * The same verbs for the workflow runner alone: they act on a run's own jobs. Not exported from the package.
 */
export declare function createManagedJobOps(deps: JobOpsDeps): {
    jobs: (db: DbHandle, opts?: JobFilter & PageOptions) => Promise<{
        readonly jobs: JobWithState[];
        readonly next: string | null;
    }>;
    job: (db: DbHandle, id: string) => Promise<JobDetail | undefined>;
    jobCounts: (db: DbHandle) => Promise<JobCount[]>;
    jobOperations: (db: DbHandle, opts?: PageOptions & {
        readonly jobId?: string;
    }) => Promise<{
        readonly operations: JobOperation[];
        readonly next: string | null;
    }>;
    archivedJobs: (db: DbHandle, opts?: PageOptions & {
        readonly outcome?: ArchiveOutcome;
        readonly effect?: string;
        readonly job?: string;
    }) => Promise<{
        readonly jobs: ArchivedJob[];
        readonly next: string | null;
    }>;
    archivedJob: (db: DbHandle, id: string) => Promise<{
        id: string;
        kind: "effect" | "forward" | "queue";
        eventSeq: number | null;
        effect: string | null;
        jobName: string | null;
        args: unknown;
        dedupeKey: string | null;
        priority: number;
        enqueuedAt: Date;
        attempts: number;
        lastError: string | null;
        outcome: "cancelled" | "completed" | "dead" | "discarded";
        attemptLog: unknown;
        replayOf: string | null;
        finishedAt: Date;
        archivedAt: Date;
        keepUntil: Date | null;
        exportedAt: Date | null;
        runId: string | null;
        stream: string | null;
        streamPosition: number | null;
    } | undefined>;
    archiveStatus: (db: DbHandle) => Promise<{
        rows: number;
        unexported: number;
        oldestUnexportedAt: Date | null;
        pastKeepUntil: number;
    }>;
    retry: (db: DbHandle, id: string, op: JobOperationInput) => Promise<{
        operationId: string;
    } | IdGenerationFailure>;
    discard: (db: DbHandle, id: string, op: JobOperationInput) => Promise<{
        operationId: string;
    } | IdGenerationFailure>;
    cancel: (db: DbHandle, id: string, op: JobOperationInput) => Promise<{
        operationId: string;
    } | IdGenerationFailure>;
    retryDead: (db: DbHandle, selection: JobSelection, op: JobOperationInput) => Promise<{
        ids: readonly string[];
        operationId: string | null;
    } | IdGenerationFailure>;
    purgeDead: (db: DbHandle, opts: {
        readonly olderThan: Date;
        readonly limit?: number;
    }, op: JobOperationInput) => Promise<{
        archived: number;
        deleted: number;
        operationId: string | null;
    } | IdGenerationFailure>;
    replayJob: (db: DbHandle, archivedId: string, op: JobOperationInput) => Promise<{
        jobId: string;
        operationId: string;
    } | IdGenerationFailure>;
    exportArchive: (db: DbHandle, opts?: {
        readonly limit?: number;
        readonly signal?: AbortSignal;
    }, op?: JobOperationInput) => Promise<{
        exported: number;
        failed: boolean;
        operationId: string | null;
    } | IdGenerationFailure>;
    pruneArchive: (db: DbHandle, opts?: {
        readonly limit?: number;
    }, op?: JobOperationInput) => Promise<{
        pruned: number;
        operationId: string | null;
    } | IdGenerationFailure>;
    pruneWorkflows: (db: DbHandle, opts?: {
        readonly limit?: number;
    }, op?: JobOperationInput) => Promise<{
        pruned: number;
        operationId: string | null;
    } | IdGenerationFailure>;
    pruneOperations: (db: DbHandle, opts?: {
        readonly limit?: number;
    }) => Promise<{
        pruned: number;
    }>;
    sweepOnce: (db: DbHandle, signal?: AbortSignal) => Promise<void>;
};
/** The job verbs and reads, as `createJobOps` builds them. */
export type JobOps = ReturnType<typeof createJobOps>;
//# sourceMappingURL=outbox.d.ts.map