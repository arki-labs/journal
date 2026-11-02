/**
 * The Foreman module for the journal's jobs, with its exact read and action types: read the jobs,
 * their attempts and the archive, and retry, discard, cancel, purge or replay them under an
 * approved permit. The public `journalJobsModule` in `./index.ts` returns it as a plain
 * `ForemanModule`, so the entry's types never name the Zod schemas the module is built from.
 */
import { z } from 'zod';
import type { IdGenerationFailure } from '@arki/contracts';
import type { StandardSchemaV1 } from '@arki/schema';
import type { RootDb, TransactionSource } from '../index.js';
import type { JournalJobsModuleOptions } from './shapes.js';
/** One try of a job. The error has secrets removed and is capped. */
export declare const attemptSummarySchema: z.ZodObject<{
    attempt: z.ZodNumber;
    startedAt: z.ZodString;
    finishedAt: z.ZodNullable<z.ZodString>;
    outcome: z.ZodNullable<z.ZodString>;
    error: z.ZodNullable<z.ZodString>;
}, z.core.$strict>;
/** One row of the operations audit: who did what, and why. */
export declare const operationSummarySchema: z.ZodObject<{
    id: z.ZodString;
    action: z.ZodString;
    actor: z.ZodString;
    reason: z.ZodNullable<z.ZodString>;
    executionId: z.ZodNullable<z.ZodString>;
    count: z.ZodNumber;
    at: z.ZodISODateTime;
}, z.core.$strict>;
/** A finished job as the archive keeps it, without its payload and attempt log. */
export declare const archivedSummarySchema: z.ZodObject<{
    id: z.ZodString;
    kind: z.ZodEnum<{
        effect: "effect";
        forward: "forward";
        queue: "queue";
    }>;
    name: z.ZodString;
    eventSeq: z.ZodNullable<z.ZodNumber>;
    outcome: z.ZodEnum<{
        cancelled: "cancelled";
        completed: "completed";
        dead: "dead";
        discarded: "discarded";
    }>;
    attempts: z.ZodNumber;
    priority: z.ZodNumber;
    enqueuedAt: z.ZodISODateTime;
    finishedAt: z.ZodISODateTime;
    archivedAt: z.ZodISODateTime;
    keepUntil: z.ZodNullable<z.ZodISODateTime>;
    exportedAt: z.ZodNullable<z.ZodISODateTime>;
    lastError: z.ZodNullable<z.ZodString>;
    replayOf: z.ZodNullable<z.ZodString>;
}, z.core.$strict>;
/** A job in the hot table. It never carries its payload. */
export declare const jobSummarySchema: z.ZodObject<{
    id: z.ZodString;
    kind: z.ZodEnum<{
        effect: "effect";
        forward: "forward";
        queue: "queue";
    }>;
    name: z.ZodString;
    state: z.ZodEnum<{
        dead: "dead";
        delayed: "delayed";
        ready: "ready";
        running: "running";
    }>;
    eventSeq: z.ZodNullable<z.ZodNumber>;
    attempts: z.ZodNumber;
    priority: z.ZodNumber;
    availableAt: z.ZodISODateTime;
    enqueuedAt: z.ZodISODateTime;
    deadAt: z.ZodNullable<z.ZodISODateTime>;
    lastError: z.ZodNullable<z.ZodString>;
    replayOf: z.ZodNullable<z.ZodString>;
}, z.core.$strict>;
export declare function jobsModule<Meta extends StandardSchemaV1<unknown, Record<string, unknown>>, Tx extends TransactionSource<Tx>, AppDb extends RootDb>(options: JournalJobsModuleOptions<Meta, Tx, AppDb>): import("@arki/admin/module").ForemanModule<Record<string, never>, {
    jobs: import("@arki/admin/module").Read<z.ZodObject<{
        status: z.ZodDefault<z.ZodEnum<{
            all: "all";
            dead: "dead";
            delayed: "delayed";
            pending: "pending";
            ready: "ready";
            running: "running";
        }>>;
        effect: z.ZodOptional<z.ZodString>;
        job: z.ZodOptional<z.ZodString>;
        limit: z.ZodDefault<z.ZodNumber>;
        after: z.ZodOptional<z.ZodString>;
    }, z.core.$strict>, z.ZodObject<{
        jobs: z.ZodArray<z.ZodObject<{
            id: z.ZodString;
            kind: z.ZodEnum<{
                effect: "effect";
                forward: "forward";
                queue: "queue";
            }>;
            name: z.ZodString;
            state: z.ZodEnum<{
                dead: "dead";
                delayed: "delayed";
                ready: "ready";
                running: "running";
            }>;
            eventSeq: z.ZodNullable<z.ZodNumber>;
            attempts: z.ZodNumber;
            priority: z.ZodNumber;
            availableAt: z.ZodISODateTime;
            enqueuedAt: z.ZodISODateTime;
            deadAt: z.ZodNullable<z.ZodISODateTime>;
            lastError: z.ZodNullable<z.ZodString>;
            replayOf: z.ZodNullable<z.ZodString>;
        }, z.core.$strict>>;
        next: z.ZodNullable<z.ZodString>;
    }, z.core.$strict>, Record<string, never>>;
    job: import("@arki/admin/module").Read<z.ZodObject<{
        id: z.ZodString;
    }, z.core.$strict>, z.ZodObject<{
        job: z.ZodObject<{
            id: z.ZodString;
            kind: z.ZodEnum<{
                effect: "effect";
                forward: "forward";
                queue: "queue";
            }>;
            name: z.ZodString;
            state: z.ZodEnum<{
                dead: "dead";
                delayed: "delayed";
                ready: "ready";
                running: "running";
            }>;
            eventSeq: z.ZodNullable<z.ZodNumber>;
            attempts: z.ZodNumber;
            priority: z.ZodNumber;
            availableAt: z.ZodISODateTime;
            enqueuedAt: z.ZodISODateTime;
            deadAt: z.ZodNullable<z.ZodISODateTime>;
            lastError: z.ZodNullable<z.ZodString>;
            replayOf: z.ZodNullable<z.ZodString>;
        }, z.core.$strict>;
        event: z.ZodNullable<z.ZodObject<{
            seq: z.ZodNumber;
            id: z.ZodString;
            kind: z.ZodString;
            entityId: z.ZodString;
            version: z.ZodNumber;
            type: z.ZodString;
            recordedAt: z.ZodISODateTime;
        }, z.core.$strict>>;
        attempts: z.ZodArray<z.ZodObject<{
            attempt: z.ZodNumber;
            startedAt: z.ZodString;
            finishedAt: z.ZodNullable<z.ZodString>;
            outcome: z.ZodNullable<z.ZodString>;
            error: z.ZodNullable<z.ZodString>;
        }, z.core.$strict>>;
        operations: z.ZodArray<z.ZodObject<{
            id: z.ZodString;
            action: z.ZodString;
            actor: z.ZodString;
            reason: z.ZodNullable<z.ZodString>;
            executionId: z.ZodNullable<z.ZodString>;
            count: z.ZodNumber;
            at: z.ZodISODateTime;
        }, z.core.$strict>>;
        payload: z.ZodOptional<z.ZodString>;
    }, z.core.$strict>, Record<string, never>>;
    jobCounts: import("@arki/admin/module").Read<z.ZodObject<{}, z.core.$strict>, z.ZodObject<{
        counts: z.ZodArray<z.ZodObject<{
            kind: z.ZodEnum<{
                effect: "effect";
                forward: "forward";
                queue: "queue";
            }>;
            name: z.ZodString;
            ready: z.ZodNumber;
            delayed: z.ZodNumber;
            running: z.ZodNumber;
            dead: z.ZodNumber;
            oldestDeadAt: z.ZodNullable<z.ZodISODateTime>;
        }, z.core.$strict>>;
    }, z.core.$strict>, Record<string, never>>;
    strandedJobs: import("@arki/admin/module").Read<z.ZodObject<{}, z.core.$strict>, z.ZodObject<{
        stranded: z.ZodArray<z.ZodObject<{
            kind: z.ZodEnum<{
                effect: "effect";
                forward: "forward";
                queue: "queue";
            }>;
            name: z.ZodString;
            jobs: z.ZodNumber;
        }, z.core.$strict>>;
    }, z.core.$strict>, Record<string, never>>;
    jobOperations: import("@arki/admin/module").Read<z.ZodObject<{
        jobId: z.ZodOptional<z.ZodString>;
        limit: z.ZodDefault<z.ZodNumber>;
        after: z.ZodOptional<z.ZodString>;
    }, z.core.$strict>, z.ZodObject<{
        operations: z.ZodArray<z.ZodObject<{
            id: z.ZodString;
            action: z.ZodString;
            actor: z.ZodString;
            reason: z.ZodNullable<z.ZodString>;
            executionId: z.ZodNullable<z.ZodString>;
            count: z.ZodNumber;
            at: z.ZodISODateTime;
        }, z.core.$strict>>;
        next: z.ZodNullable<z.ZodString>;
    }, z.core.$strict>, Record<string, never>>;
    archivedJobs: import("@arki/admin/module").Read<z.ZodObject<{
        outcome: z.ZodOptional<z.ZodEnum<{
            cancelled: "cancelled";
            completed: "completed";
            dead: "dead";
            discarded: "discarded";
        }>>;
        effect: z.ZodOptional<z.ZodString>;
        job: z.ZodOptional<z.ZodString>;
        limit: z.ZodDefault<z.ZodNumber>;
        after: z.ZodOptional<z.ZodString>;
    }, z.core.$strict>, z.ZodObject<{
        jobs: z.ZodArray<z.ZodObject<{
            id: z.ZodString;
            kind: z.ZodEnum<{
                effect: "effect";
                forward: "forward";
                queue: "queue";
            }>;
            name: z.ZodString;
            eventSeq: z.ZodNullable<z.ZodNumber>;
            outcome: z.ZodEnum<{
                cancelled: "cancelled";
                completed: "completed";
                dead: "dead";
                discarded: "discarded";
            }>;
            attempts: z.ZodNumber;
            priority: z.ZodNumber;
            enqueuedAt: z.ZodISODateTime;
            finishedAt: z.ZodISODateTime;
            archivedAt: z.ZodISODateTime;
            keepUntil: z.ZodNullable<z.ZodISODateTime>;
            exportedAt: z.ZodNullable<z.ZodISODateTime>;
            lastError: z.ZodNullable<z.ZodString>;
            replayOf: z.ZodNullable<z.ZodString>;
        }, z.core.$strict>>;
        next: z.ZodNullable<z.ZodString>;
    }, z.core.$strict>, Record<string, never>>;
    archivedJob: import("@arki/admin/module").Read<z.ZodObject<{
        id: z.ZodString;
    }, z.core.$strict>, z.ZodObject<{
        job: z.ZodObject<{
            id: z.ZodString;
            kind: z.ZodEnum<{
                effect: "effect";
                forward: "forward";
                queue: "queue";
            }>;
            name: z.ZodString;
            eventSeq: z.ZodNullable<z.ZodNumber>;
            outcome: z.ZodEnum<{
                cancelled: "cancelled";
                completed: "completed";
                dead: "dead";
                discarded: "discarded";
            }>;
            attempts: z.ZodNumber;
            priority: z.ZodNumber;
            enqueuedAt: z.ZodISODateTime;
            finishedAt: z.ZodISODateTime;
            archivedAt: z.ZodISODateTime;
            keepUntil: z.ZodNullable<z.ZodISODateTime>;
            exportedAt: z.ZodNullable<z.ZodISODateTime>;
            lastError: z.ZodNullable<z.ZodString>;
            replayOf: z.ZodNullable<z.ZodString>;
        }, z.core.$strict>;
        attempts: z.ZodArray<z.ZodObject<{
            attempt: z.ZodNumber;
            startedAt: z.ZodString;
            finishedAt: z.ZodNullable<z.ZodString>;
            outcome: z.ZodNullable<z.ZodString>;
            error: z.ZodNullable<z.ZodString>;
        }, z.core.$strict>>;
        operations: z.ZodArray<z.ZodObject<{
            id: z.ZodString;
            action: z.ZodString;
            actor: z.ZodString;
            reason: z.ZodNullable<z.ZodString>;
            executionId: z.ZodNullable<z.ZodString>;
            count: z.ZodNumber;
            at: z.ZodISODateTime;
        }, z.core.$strict>>;
        payload: z.ZodOptional<z.ZodString>;
    }, z.core.$strict>, Record<string, never>>;
    archiveStatus: import("@arki/admin/module").Read<z.ZodObject<{}, z.core.$strict>, z.ZodObject<{
        rows: z.ZodNumber;
        unexported: z.ZodNumber;
        oldestUnexportedAt: z.ZodNullable<z.ZodISODateTime>;
        pastKeepUntil: z.ZodNumber;
    }, z.core.$strict>, Record<string, never>>;
}, {
    retryJob: import("@arki/admin/module").Action<z.ZodObject<{
        jobId: z.ZodString;
        reason: z.ZodOptional<z.ZodString>;
    }, z.core.$strict>, z.ZodObject<{
        revision: z.ZodString;
        jobId: z.ZodString;
        name: z.ZodString;
        attempts: z.ZodNumber;
        lastError: z.ZodNullable<z.ZodString>;
        consequence: z.ZodString;
    }, z.core.$strict>, z.ZodObject<{
        jobId: z.ZodString;
        operationId: z.ZodString;
    }, z.core.$strict>, Record<string, never>, readonly [import("@arki/failure").FailureDefinition<"contracts.random_source_unavailable", undefined>, import("@arki/failure").FailureDefinition<"failure.unexpected_defect", undefined>], import("@arki/failure").Failure<"contracts.random_source_unavailable", undefined> | import("@arki/failure").Failure<"failure.unexpected_defect", undefined> | {
        jobId: string;
        operationId: string;
    }>;
    retryDead: import("@arki/admin/module").Action<z.ZodObject<{
        ids: z.ZodOptional<z.ZodArray<z.ZodString>>;
        effect: z.ZodOptional<z.ZodString>;
        job: z.ZodOptional<z.ZodString>;
        limit: z.ZodDefault<z.ZodNumber>;
        reason: z.ZodOptional<z.ZodString>;
    }, z.core.$strict>, z.ZodObject<{
        revision: z.ZodString;
        count: z.ZodNumber;
        jobs: z.ZodArray<z.ZodObject<{
            id: z.ZodString;
            name: z.ZodString;
        }, z.core.$strict>>;
        consequence: z.ZodString;
    }, z.core.$strict>, z.ZodObject<{
        ids: z.ZodArray<z.ZodString>;
        operationId: z.ZodNullable<z.ZodString>;
    }, z.core.$strict>, Record<string, never>, readonly [import("@arki/failure").FailureDefinition<"contracts.random_source_unavailable", undefined>, import("@arki/failure").FailureDefinition<"failure.unexpected_defect", undefined>], import("@arki/failure").Failure<"contracts.random_source_unavailable", undefined> | import("@arki/failure").Failure<"failure.unexpected_defect", undefined> | {
        ids: string[];
        operationId: string | null;
    }>;
    discardJob: import("@arki/admin/module").Action<z.ZodObject<{
        jobId: z.ZodString;
        reason: z.ZodOptional<z.ZodString>;
    }, z.core.$strict>, z.ZodObject<{
        revision: z.ZodString;
        jobId: z.ZodString;
        name: z.ZodString;
        attempts: z.ZodNumber;
        lastError: z.ZodNullable<z.ZodString>;
        consequence: z.ZodString;
    }, z.core.$strict>, z.ZodObject<{
        jobId: z.ZodString;
        operationId: z.ZodString;
    }, z.core.$strict>, Record<string, never>, readonly [import("@arki/failure").FailureDefinition<"contracts.random_source_unavailable", undefined>, import("@arki/failure").FailureDefinition<"failure.unexpected_defect", undefined>], import("@arki/failure").Failure<"contracts.random_source_unavailable", undefined> | import("@arki/failure").Failure<"failure.unexpected_defect", undefined> | {
        jobId: string;
        operationId: string;
    }>;
    cancelJob: import("@arki/admin/module").Action<z.ZodObject<{
        jobId: z.ZodString;
        reason: z.ZodOptional<z.ZodString>;
    }, z.core.$strict>, z.ZodObject<{
        revision: z.ZodString;
        jobId: z.ZodString;
        name: z.ZodString;
        attempts: z.ZodNumber;
        lastError: z.ZodNullable<z.ZodString>;
        consequence: z.ZodString;
    }, z.core.$strict>, z.ZodObject<{
        jobId: z.ZodString;
        operationId: z.ZodString;
    }, z.core.$strict>, Record<string, never>, readonly [import("@arki/failure").FailureDefinition<"contracts.random_source_unavailable", undefined>, import("@arki/failure").FailureDefinition<"failure.unexpected_defect", undefined>], import("@arki/failure").Failure<"contracts.random_source_unavailable", undefined> | import("@arki/failure").Failure<"failure.unexpected_defect", undefined> | {
        jobId: string;
        operationId: string;
    }>;
    purgeDead: import("@arki/admin/module").Action<z.ZodObject<{
        olderThanDays: z.ZodNumber;
        limit: z.ZodDefault<z.ZodNumber>;
        reason: z.ZodOptional<z.ZodString>;
    }, z.core.$strict>, z.ZodObject<{
        revision: z.ZodString;
        deadJobs: z.ZodNumber;
        oldestDeadAt: z.ZodNullable<z.ZodISODateTime>;
        willDo: z.ZodEnum<{
            archive: "archive";
            delete: "delete";
        }>;
        consequence: z.ZodString;
    }, z.core.$strict>, z.ZodObject<{
        archived: z.ZodNumber;
        deleted: z.ZodNumber;
        operationId: z.ZodNullable<z.ZodString>;
    }, z.core.$strict>, Record<string, never>, readonly [import("@arki/failure").FailureDefinition<"contracts.random_source_unavailable", undefined>, import("@arki/failure").FailureDefinition<"failure.unexpected_defect", undefined>], {
        archived: number;
        deleted: number;
        operationId: string | null;
    } | IdGenerationFailure>;
    replayJob: import("@arki/admin/module").Action<z.ZodObject<{
        id: z.ZodString;
        reason: z.ZodOptional<z.ZodString>;
    }, z.core.$strict>, z.ZodObject<{
        revision: z.ZodString;
        id: z.ZodString;
        name: z.ZodString;
        outcome: z.ZodEnum<{
            cancelled: "cancelled";
            completed: "completed";
            dead: "dead";
            discarded: "discarded";
        }>;
        consequence: z.ZodString;
    }, z.core.$strict>, z.ZodObject<{
        jobId: z.ZodString;
        operationId: z.ZodString;
    }, z.core.$strict>, Record<string, never>, readonly [import("@arki/failure").FailureDefinition<"contracts.random_source_unavailable", undefined>, import("@arki/failure").FailureDefinition<"failure.unexpected_defect", undefined>], {
        jobId: string;
        operationId: string;
    } | IdGenerationFailure>;
}>;
//# sourceMappingURL=jobs.d.ts.map