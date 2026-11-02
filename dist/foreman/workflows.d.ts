/**
 * The Foreman control-plane module for durable workflows: find a stuck run, read it, and move it under an approved
 * permit (retry a dead step, give a signal that never came, resolve a step by hand, skip a failed undo, cancel a run,
 * change its metadata or tags, move its start, replay it), and read and change the limits runs hold (pause, resume,
 * override, reset). Mirrors `journalJobsModule`: every action previews what it will do with a `revision`, and refuses
 * with E010 when the run or limit changed since. Every verb writes who did it onto the run's or limit's events.
 * Requires the optional peer `@arki/admin`.
 */
import { z } from 'zod';
import type { Failure } from '@arki/failure';
import type { StandardSchemaV1 } from '@arki/schema';
import type { RootDb, TransactionSource } from '../index.js';
import type { JournalWorkflowsModuleOptions } from './shapes.js';
/**
 * The permission each read and action needs, written once: one per verb (founder, 2026-10-23), so an operator can be
 * let tag runs without being let replay them or pause a limit. Every read needs `read`.
 */
export declare const WORKFLOW_PERMISSIONS: {
    readonly read: 'workflow:read';
    readonly retry: 'journal:retry';
    readonly resolve: 'workflow:resolve';
    readonly cancel: 'workflow:cancel';
    readonly signal: 'workflow:signal';
    readonly metadata: 'workflow:metadata';
    readonly reschedule: 'workflow:reschedule';
    readonly replay: 'workflow:replay';
    readonly limits: 'workflow:limits';
};
export declare function workflowsModule<Meta extends StandardSchemaV1<unknown, Record<string, unknown>>, Tx extends TransactionSource<Tx>, AppDb extends RootDb>(options: JournalWorkflowsModuleOptions<Meta, Tx, AppDb>): import("@arki/admin/module").ForemanModule<Record<string, never>, {
    runs: import("@arki/admin/module").Read<z.ZodObject<{
        state: z.ZodOptional<z.ZodEnum<{
            cancelled: "cancelled";
            compensating: "compensating";
            completed: "completed";
            expired: "expired";
            failed: "failed";
            parked: "parked";
            queued: "queued";
            running: "running";
        }>>;
        name: z.ZodOptional<z.ZodString>;
        version: z.ZodOptional<z.ZodNumber>;
        parentId: z.ZodOptional<z.ZodString>;
        stuck: z.ZodOptional<z.ZodBoolean>;
        tag: z.ZodOptional<z.ZodString>;
        scope: z.ZodOptional<z.ZodString>;
        rootId: z.ZodOptional<z.ZodString>;
        batchId: z.ZodOptional<z.ZodString>;
        from: z.ZodOptional<z.ZodISODateTime>;
        to: z.ZodOptional<z.ZodISODateTime>;
        limit: z.ZodDefault<z.ZodNumber>;
        after: z.ZodOptional<z.ZodString>;
    }, z.core.$strict>, z.ZodObject<{
        runs: z.ZodArray<z.ZodObject<{
            id: z.ZodString;
            name: z.ZodString;
            version: z.ZodNumber;
            state: z.ZodEnum<{
                cancelled: "cancelled";
                compensating: "compensating";
                completed: "completed";
                expired: "expired";
                failed: "failed";
                parked: "parked";
                queued: "queued";
                running: "running";
            }>;
            node: z.ZodNullable<z.ZodString>;
            waitingFor: z.ZodNullable<z.ZodString>;
            wakeAt: z.ZodNullable<z.ZodISODateTime>;
            deadlineAt: z.ZodNullable<z.ZodISODateTime>;
            parentId: z.ZodNullable<z.ZodString>;
            parentPath: z.ZodNullable<z.ZodString>;
            scope: z.ZodNullable<z.ZodString>;
            tags: z.ZodArray<z.ZodString>;
            rootId: z.ZodNullable<z.ZodString>;
            batchId: z.ZodNullable<z.ZodString>;
            replayOf: z.ZodNullable<z.ZodString>;
            cancelledAt: z.ZodNullable<z.ZodISODateTime>;
            cancelReason: z.ZodNullable<z.ZodString>;
            startedAt: z.ZodISODateTime;
            finishedAt: z.ZodNullable<z.ZodISODateTime>;
            startAt: z.ZodNullable<z.ZodISODateTime>;
            delayedUntil: z.ZodNullable<z.ZodISODateTime>;
            ttlAt: z.ZodNullable<z.ZodISODateTime>;
            maxAttempts: z.ZodNullable<z.ZodNumber>;
            stepTimeoutMs: z.ZodNullable<z.ZodNumber>;
            priority: z.ZodNullable<z.ZodNumber>;
            stuck: z.ZodBoolean;
            stranded: z.ZodNullable<z.ZodEnum<{
                WORKFLOW_SHAPE_CHANGED: "WORKFLOW_SHAPE_CHANGED";
                WORKFLOW_UNKNOWN: "WORKFLOW_UNKNOWN";
            }>>;
        }, z.core.$strict>>;
        next: z.ZodNullable<z.ZodString>;
    }, z.core.$strict>, Record<string, never>>;
    run: import("@arki/admin/module").Read<z.ZodObject<{
        runId: z.ZodString;
    }, z.core.$strict>, z.ZodObject<{
        run: z.ZodObject<{
            id: z.ZodString;
            name: z.ZodString;
            version: z.ZodNumber;
            state: z.ZodEnum<{
                cancelled: "cancelled";
                compensating: "compensating";
                completed: "completed";
                expired: "expired";
                failed: "failed";
                parked: "parked";
                queued: "queued";
                running: "running";
            }>;
            node: z.ZodNullable<z.ZodString>;
            waitingFor: z.ZodNullable<z.ZodString>;
            wakeAt: z.ZodNullable<z.ZodISODateTime>;
            deadlineAt: z.ZodNullable<z.ZodISODateTime>;
            parentId: z.ZodNullable<z.ZodString>;
            parentPath: z.ZodNullable<z.ZodString>;
            scope: z.ZodNullable<z.ZodString>;
            tags: z.ZodArray<z.ZodString>;
            rootId: z.ZodNullable<z.ZodString>;
            batchId: z.ZodNullable<z.ZodString>;
            replayOf: z.ZodNullable<z.ZodString>;
            cancelledAt: z.ZodNullable<z.ZodISODateTime>;
            cancelReason: z.ZodNullable<z.ZodString>;
            startedAt: z.ZodISODateTime;
            finishedAt: z.ZodNullable<z.ZodISODateTime>;
            startAt: z.ZodNullable<z.ZodISODateTime>;
            delayedUntil: z.ZodNullable<z.ZodISODateTime>;
            ttlAt: z.ZodNullable<z.ZodISODateTime>;
            maxAttempts: z.ZodNullable<z.ZodNumber>;
            stepTimeoutMs: z.ZodNullable<z.ZodNumber>;
            priority: z.ZodNullable<z.ZodNumber>;
            stuck: z.ZodBoolean;
            stranded: z.ZodNullable<z.ZodEnum<{
                WORKFLOW_SHAPE_CHANGED: "WORKFLOW_SHAPE_CHANGED";
                WORKFLOW_UNKNOWN: "WORKFLOW_UNKNOWN";
            }>>;
        }, z.core.$strict>;
        steps: z.ZodArray<z.ZodObject<{
            path: z.ZodString;
            phase: z.ZodEnum<{
                do: "do";
                undo: "undo";
            }>;
            attempt: z.ZodNumber;
            key: z.ZodNullable<z.ZodString>;
            jobId: z.ZodNullable<z.ZodString>;
            status: z.ZodEnum<{
                done: "done";
                failed: "failed";
                running: "running";
                scheduled: "scheduled";
                skipped: "skipped";
            }>;
            stuck: z.ZodBoolean;
            error: z.ZodNullable<z.ZodString>;
            reason: z.ZodNullable<z.ZodString>;
            startedAt: z.ZodNullable<z.ZodISODateTime>;
            finishedAt: z.ZodNullable<z.ZodISODateTime>;
            result: z.ZodOptional<z.ZodString>;
        }, z.core.$strict>>;
        residual: z.ZodArray<z.ZodString>;
        children: z.ZodArray<z.ZodObject<{
            id: z.ZodString;
            name: z.ZodString;
            version: z.ZodNumber;
            state: z.ZodEnum<{
                cancelled: "cancelled";
                compensating: "compensating";
                completed: "completed";
                expired: "expired";
                failed: "failed";
                parked: "parked";
                queued: "queued";
                running: "running";
            }>;
            parentPath: z.ZodNullable<z.ZodString>;
            startedAt: z.ZodISODateTime;
            finishedAt: z.ZodNullable<z.ZodISODateTime>;
        }, z.core.$strict>>;
        signals: z.ZodArray<z.ZodObject<{
            id: z.ZodString;
            name: z.ZodString;
            deliveryId: z.ZodString;
            receivedAt: z.ZodISODateTime;
            payload: z.ZodOptional<z.ZodString>;
        }, z.core.$strict>>;
        input: z.ZodOptional<z.ZodString>;
        results: z.ZodOptional<z.ZodString>;
        output: z.ZodOptional<z.ZodString>;
        metadata: z.ZodOptional<z.ZodString>;
    }, z.core.$strict>, Record<string, never>>;
    counts: import("@arki/admin/module").Read<z.ZodObject<{}, z.core.$strict>, z.ZodObject<{
        counts: z.ZodArray<z.ZodObject<{
            name: z.ZodString;
            version: z.ZodNumber;
            state: z.ZodEnum<{
                cancelled: "cancelled";
                compensating: "compensating";
                completed: "completed";
                expired: "expired";
                failed: "failed";
                parked: "parked";
                queued: "queued";
                running: "running";
            }>;
            runs: z.ZodNumber;
        }, z.core.$strict>>;
    }, z.core.$strict>, Record<string, never>>;
    strandedRuns: import("@arki/admin/module").Read<z.ZodObject<{
        limit: z.ZodDefault<z.ZodNumber>;
    }, z.core.$strict>, z.ZodObject<{
        stranded: z.ZodArray<z.ZodObject<{
            id: z.ZodString;
            name: z.ZodString;
            version: z.ZodNumber;
            state: z.ZodEnum<{
                cancelled: "cancelled";
                compensating: "compensating";
                completed: "completed";
                expired: "expired";
                failed: "failed";
                parked: "parked";
                queued: "queued";
                running: "running";
            }>;
            startedAt: z.ZodISODateTime;
            code: z.ZodEnum<{
                WORKFLOW_SHAPE_CHANGED: "WORKFLOW_SHAPE_CHANGED";
                WORKFLOW_UNKNOWN: "WORKFLOW_UNKNOWN";
            }>;
        }, z.core.$strict>>;
    }, z.core.$strict>, Record<string, never>>;
    history: import("@arki/admin/module").Read<z.ZodObject<{
        runId: z.ZodString;
        limit: z.ZodDefault<z.ZodNumber>;
        after: z.ZodOptional<z.ZodString>;
    }, z.core.$strict>, z.ZodObject<{
        events: z.ZodArray<z.ZodObject<{
            seq: z.ZodNumber;
            id: z.ZodString;
            version: z.ZodNumber;
            type: z.ZodString;
            recordedAt: z.ZodISODateTime;
            actorId: z.ZodOptional<z.ZodString>;
            reason: z.ZodOptional<z.ZodString>;
            executionId: z.ZodOptional<z.ZodString>;
            data: z.ZodOptional<z.ZodString>;
        }, z.core.$strict>>;
        next: z.ZodNullable<z.ZodString>;
    }, z.core.$strict>, Record<string, never>>;
    limits: import("@arki/admin/module").Read<z.ZodObject<{}, z.core.$strict>, z.ZodObject<{
        limits: z.ZodArray<z.ZodObject<{
            name: z.ZodString;
            workflows: z.ZodArray<z.ZodString>;
            code: z.ZodObject<{
                total: z.ZodNullable<z.ZodNumber>;
                perKey: z.ZodNullable<z.ZodNumber>;
            }, z.core.$strict>;
            override: z.ZodObject<{
                total: z.ZodNullable<z.ZodNumber>;
                perKey: z.ZodNullable<z.ZodNumber>;
            }, z.core.$strict>;
            keys: z.ZodArray<z.ZodObject<{
                key: z.ZodString;
                perKey: z.ZodNumber;
                until: z.ZodISODateTime;
            }, z.core.$strict>>;
            effective: z.ZodObject<{
                total: z.ZodNullable<z.ZodNumber>;
                perKey: z.ZodNullable<z.ZodNumber>;
            }, z.core.$strict>;
            paused: z.ZodBoolean;
            running: z.ZodNumber;
            queued: z.ZodNumber;
            version: z.ZodNumber;
        }, z.core.$strict>>;
    }, z.core.$strict>, Record<string, never>>;
    limit: import("@arki/admin/module").Read<z.ZodObject<{
        name: z.ZodString;
    }, z.core.$strict>, z.ZodObject<{
        name: z.ZodString;
        workflows: z.ZodArray<z.ZodString>;
        code: z.ZodObject<{
            total: z.ZodNullable<z.ZodNumber>;
            perKey: z.ZodNullable<z.ZodNumber>;
        }, z.core.$strict>;
        override: z.ZodObject<{
            total: z.ZodNullable<z.ZodNumber>;
            perKey: z.ZodNullable<z.ZodNumber>;
        }, z.core.$strict>;
        keys: z.ZodArray<z.ZodObject<{
            key: z.ZodString;
            perKey: z.ZodNumber;
            until: z.ZodISODateTime;
        }, z.core.$strict>>;
        effective: z.ZodObject<{
            total: z.ZodNullable<z.ZodNumber>;
            perKey: z.ZodNullable<z.ZodNumber>;
        }, z.core.$strict>;
        paused: z.ZodBoolean;
        running: z.ZodNumber;
        queued: z.ZodNumber;
        version: z.ZodNumber;
    }, z.core.$strict>, Record<string, never>>;
}, {
    retryStep: import("@arki/admin/module").Action<z.ZodObject<{
        runId: z.ZodString;
        path: z.ZodString;
        phase: z.ZodDefault<z.ZodEnum<{
            do: "do";
            undo: "undo";
        }>>;
        reason: z.ZodOptional<z.ZodString>;
    }, z.core.$strict>, z.ZodObject<{
        revision: z.ZodString;
        runId: z.ZodString;
        path: z.ZodString;
        phase: z.ZodEnum<{
            do: "do";
            undo: "undo";
        }>;
        how: z.ZodEnum<{
            childrenRestarted: "childrenRestarted";
            jobRetried: "jobRetried";
            rescheduled: "rescheduled";
        }>;
        count: z.ZodNumber;
        lastError: z.ZodNullable<z.ZodString>;
        consequence: z.ZodString;
    }, z.core.$strict>, z.ZodObject<{
        runId: z.ZodString;
        how: z.ZodEnum<{
            childrenRestarted: "childrenRestarted";
            jobRetried: "jobRetried";
            rescheduled: "rescheduled";
        }>;
    }, z.core.$strict>, Record<string, never>, readonly [import("@arki/failure").FailureDefinition<"contracts.random_source_unavailable", undefined>, import("@arki/failure").FailureDefinition<"failure.unexpected_defect", undefined>], Failure<"contracts.random_source_unavailable", undefined> | Failure<"failure.unexpected_defect", undefined> | {
        runId: string;
        how: "childrenRestarted" | "jobRetried" | "rescheduled";
    }>;
    signal: import("@arki/admin/module").Action<z.ZodObject<{
        runId: z.ZodString;
        name: z.ZodString;
        payload: z.ZodJSONSchema;
        reason: z.ZodString;
    }, z.core.$strict>, z.ZodObject<{
        revision: z.ZodString;
        runId: z.ZodString;
        name: z.ZodString;
        wakesNow: z.ZodBoolean;
        consequence: z.ZodString;
    }, z.core.$strict>, z.ZodObject<{
        runId: z.ZodString;
        status: z.ZodEnum<{
            duplicate: "duplicate";
            finished: "finished";
            kept: "kept";
            "no-run": "no-run";
            woke: "woke";
        }>;
    }, z.core.$strict>, Record<string, never>, readonly [import("@arki/failure").FailureDefinition<"contracts.random_source_unavailable", undefined>, import("@arki/failure").FailureDefinition<"failure.unexpected_defect", undefined>], Failure<"contracts.random_source_unavailable", undefined> | Failure<"failure.unexpected_defect", undefined> | {
        runId: string;
        status: "duplicate" | "finished" | "kept" | "no-run" | "woke";
    }>;
    resolveStep: import("@arki/admin/module").Action<z.ZodObject<{
        runId: z.ZodString;
        path: z.ZodString;
        result: z.ZodJSONSchema;
        reason: z.ZodString;
    }, z.core.$strict>, z.ZodObject<{
        revision: z.ZodString;
        runId: z.ZodString;
        path: z.ZodString;
        lastError: z.ZodNullable<z.ZodString>;
        consequence: z.ZodString;
    }, z.core.$strict>, z.ZodObject<{
        runId: z.ZodString;
    }, z.core.$strict>, Record<string, never>, readonly [import("@arki/failure").FailureDefinition<"contracts.random_source_unavailable", undefined>, import("@arki/failure").FailureDefinition<"failure.unexpected_defect", undefined>], Failure<"contracts.random_source_unavailable", undefined> | Failure<"failure.unexpected_defect", undefined> | {
        readonly runId: string;
    }>;
    skipUndo: import("@arki/admin/module").Action<z.ZodObject<{
        runId: z.ZodString;
        path: z.ZodString;
        reason: z.ZodString;
    }, z.core.$strict>, z.ZodObject<{
        revision: z.ZodString;
        runId: z.ZodString;
        path: z.ZodString;
        lastError: z.ZodNullable<z.ZodString>;
        consequence: z.ZodString;
    }, z.core.$strict>, z.ZodObject<{
        runId: z.ZodString;
    }, z.core.$strict>, Record<string, never>, readonly [import("@arki/failure").FailureDefinition<"contracts.random_source_unavailable", undefined>, import("@arki/failure").FailureDefinition<"failure.unexpected_defect", undefined>], Failure<"contracts.random_source_unavailable", undefined> | Failure<"failure.unexpected_defect", undefined> | {
        readonly runId: string;
    }>;
    cancel: import("@arki/admin/module").Action<z.ZodObject<{
        runId: z.ZodString;
        reason: z.ZodString;
    }, z.core.$strict>, z.ZodObject<{
        revision: z.ZodString;
        runId: z.ZodString;
        name: z.ZodString;
        plan: z.ZodArray<z.ZodObject<{
            path: z.ZodString;
            action: z.ZodEnum<{
                compensated: "compensated";
                detached: "detached";
                none: "none";
                ownUndo: "ownUndo";
                undo: "undo";
            }>;
        }, z.core.$strict>>;
        running: z.ZodArray<z.ZodObject<{
            path: z.ZodString;
            children: z.ZodNumber;
            action: z.ZodEnum<{
                cancelled: "cancelled";
                detached: "detached";
            }>;
        }, z.core.$strict>>;
        consequence: z.ZodString;
    }, z.core.$strict>, z.ZodObject<{
        runId: z.ZodString;
        state: z.ZodEnum<{
            cancelled: "cancelled";
            compensating: "compensating";
        }>;
    }, z.core.$strict>, Record<string, never>, readonly [import("@arki/failure").FailureDefinition<"contracts.random_source_unavailable", undefined>, import("@arki/failure").FailureDefinition<"failure.unexpected_defect", undefined>], Failure<"contracts.random_source_unavailable", undefined> | Failure<"failure.unexpected_defect", undefined> | {
        runId: string;
        state: "cancelled" | "compensating";
    }>;
    setMetadata: import("@arki/admin/module").Action<z.ZodObject<{
        runId: z.ZodString;
        change: z.ZodReadonly<z.ZodDiscriminatedUnion<[z.ZodObject<{
            kind: z.ZodLiteral<"set">;
            patch: z.ZodReadonly<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
        }, z.core.$strip>, z.ZodObject<{
            kind: z.ZodLiteral<"increment">;
            key: z.ZodString;
            by: z.ZodNumber;
        }, z.core.$strip>, z.ZodObject<{
            kind: z.ZodLiteral<"append">;
            key: z.ZodString;
            value: z.ZodUnknown;
        }, z.core.$strip>, z.ZodObject<{
            kind: z.ZodLiteral<"remove">;
            key: z.ZodString;
        }, z.core.$strip>], "kind">>;
        reason: z.ZodOptional<z.ZodString>;
    }, z.core.$strict>, z.ZodObject<{
        revision: z.ZodString;
        runId: z.ZodString;
        keys: z.ZodArray<z.ZodString>;
        consequence: z.ZodString;
    }, z.core.$strict>, z.ZodObject<{
        runId: z.ZodString;
        keys: z.ZodArray<z.ZodString>;
    }, z.core.$strict>, Record<string, never>, readonly [import("@arki/failure").FailureDefinition<"contracts.random_source_unavailable", undefined>, import("@arki/failure").FailureDefinition<"failure.unexpected_defect", undefined>, import("@arki/failure").FailureDefinition<"journal.not_found", StandardSchemaV1<{
        detail: string;
    }, {
        detail: string;
    }>>, import("@arki/failure").FailureDefinition<"journal.invalid", StandardSchemaV1<{
        detail: string;
    }, {
        detail: string;
    }>>, import("@arki/failure").FailureDefinition<"journal.conflict", StandardSchemaV1<{
        detail: string;
    }, {
        detail: string;
    }>>, import("@arki/failure").FailureDefinition<"journal.workflow_busy", StandardSchemaV1<{
        name: string;
        key: string | null;
        limit: number;
        running: string[];
        limitName?: string | undefined;
        reason?: "full" | "paused" | undefined;
        detail: string;
    }, {
        name: string;
        key: string | null;
        limit: number;
        running: string[];
        limitName?: string | undefined;
        reason?: "full" | "paused" | undefined;
        detail: string;
    }>>, import("@arki/failure").FailureDefinition<"schema.invalid_input", StandardSchemaV1<unknown, {
        issues: readonly StandardSchemaV1.Issue[];
    }>>], Failure<"contracts.random_source_unavailable", undefined> | Failure<"failure.unexpected_defect", undefined> | Failure<"journal.conflict", {
        detail: string;
    }> | Failure<"journal.invalid", {
        detail: string;
    }> | Failure<"journal.not_found", {
        detail: string;
    }> | Failure<"schema.invalid_input", {
        issues: readonly StandardSchemaV1.Issue[];
    }> | {
        runId: string;
        keys: string[];
    }>;
    addTags: import("@arki/admin/module").Action<z.ZodObject<{
        runId: z.ZodString;
        tags: z.ZodReadonly<z.ZodArray<z.ZodString>>;
        reason: z.ZodOptional<z.ZodString>;
    }, z.core.$strict>, z.ZodObject<{
        revision: z.ZodString;
        runId: z.ZodString;
        added: z.ZodArray<z.ZodString>;
        consequence: z.ZodString;
    }, z.core.$strict>, z.ZodObject<{
        runId: z.ZodString;
        tags: z.ZodArray<z.ZodString>;
    }, z.core.$strict>, Record<string, never>, readonly [import("@arki/failure").FailureDefinition<"contracts.random_source_unavailable", undefined>, import("@arki/failure").FailureDefinition<"failure.unexpected_defect", undefined>, import("@arki/failure").FailureDefinition<"journal.not_found", StandardSchemaV1<{
        detail: string;
    }, {
        detail: string;
    }>>, import("@arki/failure").FailureDefinition<"journal.invalid", StandardSchemaV1<{
        detail: string;
    }, {
        detail: string;
    }>>, import("@arki/failure").FailureDefinition<"journal.conflict", StandardSchemaV1<{
        detail: string;
    }, {
        detail: string;
    }>>, import("@arki/failure").FailureDefinition<"journal.workflow_busy", StandardSchemaV1<{
        name: string;
        key: string | null;
        limit: number;
        running: string[];
        limitName?: string | undefined;
        reason?: "full" | "paused" | undefined;
        detail: string;
    }, {
        name: string;
        key: string | null;
        limit: number;
        running: string[];
        limitName?: string | undefined;
        reason?: "full" | "paused" | undefined;
        detail: string;
    }>>, import("@arki/failure").FailureDefinition<"schema.invalid_input", StandardSchemaV1<unknown, {
        issues: readonly StandardSchemaV1.Issue[];
    }>>], Failure<"contracts.random_source_unavailable", undefined> | Failure<"failure.unexpected_defect", undefined> | Failure<"journal.conflict", {
        detail: string;
    }> | Failure<"journal.invalid", {
        detail: string;
    }> | Failure<"journal.not_found", {
        detail: string;
    }> | Failure<"schema.invalid_input", {
        issues: readonly StandardSchemaV1.Issue[];
    }> | {
        runId: string;
        tags: string[];
    }>;
    reschedule: import("@arki/admin/module").Action<z.ZodUnion<readonly [z.ZodObject<{
        runId: z.ZodString;
        delay: z.ZodUnion<readonly [z.ZodNumber, z.ZodTemplateLiteral<`${number}d` | `${number}h` | `${number}m`>]>;
        reason: z.ZodString;
    }, z.core.$strict>, z.ZodObject<{
        runId: z.ZodString;
        at: z.ZodISODateTime;
        reason: z.ZodString;
    }, z.core.$strict>]>, z.ZodObject<{
        revision: z.ZodString;
        runId: z.ZodString;
        startAt: z.ZodISODateTime;
        newStartAt: z.ZodISODateTime;
        consequence: z.ZodString;
    }, z.core.$strict>, z.ZodObject<{
        runId: z.ZodString;
        startAt: z.ZodISODateTime;
    }, z.core.$strict>, Record<string, never>, readonly [import("@arki/failure").FailureDefinition<"contracts.random_source_unavailable", undefined>, import("@arki/failure").FailureDefinition<"failure.unexpected_defect", undefined>, import("@arki/failure").FailureDefinition<"journal.not_found", StandardSchemaV1<{
        detail: string;
    }, {
        detail: string;
    }>>, import("@arki/failure").FailureDefinition<"journal.invalid", StandardSchemaV1<{
        detail: string;
    }, {
        detail: string;
    }>>, import("@arki/failure").FailureDefinition<"journal.conflict", StandardSchemaV1<{
        detail: string;
    }, {
        detail: string;
    }>>, import("@arki/failure").FailureDefinition<"journal.workflow_busy", StandardSchemaV1<{
        name: string;
        key: string | null;
        limit: number;
        running: string[];
        limitName?: string | undefined;
        reason?: "full" | "paused" | undefined;
        detail: string;
    }, {
        name: string;
        key: string | null;
        limit: number;
        running: string[];
        limitName?: string | undefined;
        reason?: "full" | "paused" | undefined;
        detail: string;
    }>>, import("@arki/failure").FailureDefinition<"schema.invalid_input", StandardSchemaV1<unknown, {
        issues: readonly StandardSchemaV1.Issue[];
    }>>], Failure<"contracts.random_source_unavailable", undefined> | Failure<"failure.unexpected_defect", undefined> | Failure<"journal.conflict", {
        detail: string;
    }> | Failure<"journal.not_found", {
        detail: string;
    }> | Failure<"schema.invalid_input", {
        issues: readonly StandardSchemaV1.Issue[];
    }> | {
        runId: string;
        startAt: string;
    }>;
    replay: import("@arki/admin/module").Action<z.ZodObject<{
        runId: z.ZodString;
        overrides: z.ZodOptional<z.ZodObject<{
            scope: z.ZodOptional<z.ZodString>;
            tags: z.ZodOptional<z.ZodReadonly<z.ZodArray<z.ZodString>>>;
            metadata: z.ZodOptional<z.ZodReadonly<z.ZodRecord<z.ZodString, z.ZodUnknown>>>;
            maxAttempts: z.ZodOptional<z.ZodInt>;
            timeout: z.ZodOptional<z.ZodUnion<readonly [z.ZodNumber, z.ZodTemplateLiteral<`${number}d` | `${number}h` | `${number}m`>]>>;
            priority: z.ZodOptional<z.ZodInt32>;
            input: z.ZodOptional<z.ZodJSONSchema>;
            delay: z.ZodOptional<z.ZodUnion<readonly [z.ZodNumber, z.ZodTemplateLiteral<`${number}d` | `${number}h` | `${number}m`>]>>;
            ttl: z.ZodOptional<z.ZodUnion<readonly [z.ZodNumber, z.ZodTemplateLiteral<`${number}d` | `${number}h` | `${number}m`>]>>;
        }, z.core.$strict>>;
        reason: z.ZodString;
    }, z.core.$strict>, z.ZodObject<{
        revision: z.ZodString;
        runId: z.ZodString;
        name: z.ZodString;
        state: z.ZodEnum<{
            cancelled: "cancelled";
            compensating: "compensating";
            completed: "completed";
            expired: "expired";
            failed: "failed";
            parked: "parked";
            queued: "queued";
            running: "running";
        }>;
        overridden: z.ZodArray<z.ZodString>;
        consequence: z.ZodString;
    }, z.core.$strict>, z.ZodObject<{
        runId: z.ZodString;
        replayOf: z.ZodString;
        state: z.ZodEnum<{
            cancelled: "cancelled";
            compensating: "compensating";
            completed: "completed";
            expired: "expired";
            failed: "failed";
            parked: "parked";
            queued: "queued";
            running: "running";
        }>;
    }, z.core.$strict>, Record<string, never>, readonly [import("@arki/failure").FailureDefinition<"contracts.random_source_unavailable", undefined>, import("@arki/failure").FailureDefinition<"failure.unexpected_defect", undefined>, import("@arki/failure").FailureDefinition<"journal.not_found", StandardSchemaV1<{
        detail: string;
    }, {
        detail: string;
    }>>, import("@arki/failure").FailureDefinition<"journal.invalid", StandardSchemaV1<{
        detail: string;
    }, {
        detail: string;
    }>>, import("@arki/failure").FailureDefinition<"journal.conflict", StandardSchemaV1<{
        detail: string;
    }, {
        detail: string;
    }>>, import("@arki/failure").FailureDefinition<"journal.workflow_busy", StandardSchemaV1<{
        name: string;
        key: string | null;
        limit: number;
        running: string[];
        limitName?: string | undefined;
        reason?: "full" | "paused" | undefined;
        detail: string;
    }, {
        name: string;
        key: string | null;
        limit: number;
        running: string[];
        limitName?: string | undefined;
        reason?: "full" | "paused" | undefined;
        detail: string;
    }>>, import("@arki/failure").FailureDefinition<"schema.invalid_input", StandardSchemaV1<unknown, {
        issues: readonly StandardSchemaV1.Issue[];
    }>>], Failure<"contracts.random_source_unavailable", undefined> | Failure<"failure.unexpected_defect", undefined> | Failure<"journal.conflict", {
        detail: string;
    }> | Failure<"journal.invalid", {
        detail: string;
    }> | Failure<"journal.not_found", {
        detail: string;
    }> | Failure<"journal.workflow_busy", {
        name: string;
        key: string | null;
        limit: number;
        running: string[];
        limitName?: string | undefined;
        reason?: "full" | "paused" | undefined;
        detail: string;
    }> | Failure<"schema.invalid_input", {
        issues: readonly StandardSchemaV1.Issue[];
    }> | {
        runId: string;
        replayOf: string;
        state: "cancelled" | "compensating" | "completed" | "expired" | "failed" | "parked" | "queued" | "running";
    }>;
    pauseLimit: import("@arki/admin/module").Action<z.ZodObject<{
        name: z.ZodString;
        reason: z.ZodString;
    }, z.core.$strict>, z.ZodObject<{
        revision: z.ZodString;
        limit: z.ZodObject<{
            name: z.ZodString;
            workflows: z.ZodArray<z.ZodString>;
            code: z.ZodObject<{
                total: z.ZodNullable<z.ZodNumber>;
                perKey: z.ZodNullable<z.ZodNumber>;
            }, z.core.$strict>;
            override: z.ZodObject<{
                total: z.ZodNullable<z.ZodNumber>;
                perKey: z.ZodNullable<z.ZodNumber>;
            }, z.core.$strict>;
            keys: z.ZodArray<z.ZodObject<{
                key: z.ZodString;
                perKey: z.ZodNumber;
                until: z.ZodISODateTime;
            }, z.core.$strict>>;
            effective: z.ZodObject<{
                total: z.ZodNullable<z.ZodNumber>;
                perKey: z.ZodNullable<z.ZodNumber>;
            }, z.core.$strict>;
            paused: z.ZodBoolean;
            running: z.ZodNumber;
            queued: z.ZodNumber;
            version: z.ZodNumber;
        }, z.core.$strict>;
        consequence: z.ZodString;
    }, z.core.$strict>, z.ZodObject<{
        name: z.ZodString;
        workflows: z.ZodArray<z.ZodString>;
        code: z.ZodObject<{
            total: z.ZodNullable<z.ZodNumber>;
            perKey: z.ZodNullable<z.ZodNumber>;
        }, z.core.$strict>;
        override: z.ZodObject<{
            total: z.ZodNullable<z.ZodNumber>;
            perKey: z.ZodNullable<z.ZodNumber>;
        }, z.core.$strict>;
        keys: z.ZodArray<z.ZodObject<{
            key: z.ZodString;
            perKey: z.ZodNumber;
            until: z.ZodISODateTime;
        }, z.core.$strict>>;
        effective: z.ZodObject<{
            total: z.ZodNullable<z.ZodNumber>;
            perKey: z.ZodNullable<z.ZodNumber>;
        }, z.core.$strict>;
        paused: z.ZodBoolean;
        running: z.ZodNumber;
        queued: z.ZodNumber;
        version: z.ZodNumber;
    }, z.core.$strict>, Record<string, never>, readonly [import("@arki/failure").FailureDefinition<"contracts.random_source_unavailable", undefined>, import("@arki/failure").FailureDefinition<"failure.unexpected_defect", undefined>, import("@arki/failure").FailureDefinition<"journal.not_found", StandardSchemaV1<{
        detail: string;
    }, {
        detail: string;
    }>>, import("@arki/failure").FailureDefinition<"journal.invalid", StandardSchemaV1<{
        detail: string;
    }, {
        detail: string;
    }>>, import("@arki/failure").FailureDefinition<"journal.conflict", StandardSchemaV1<{
        detail: string;
    }, {
        detail: string;
    }>>, import("@arki/failure").FailureDefinition<"journal.workflow_busy", StandardSchemaV1<{
        name: string;
        key: string | null;
        limit: number;
        running: string[];
        limitName?: string | undefined;
        reason?: "full" | "paused" | undefined;
        detail: string;
    }, {
        name: string;
        key: string | null;
        limit: number;
        running: string[];
        limitName?: string | undefined;
        reason?: "full" | "paused" | undefined;
        detail: string;
    }>>, import("@arki/failure").FailureDefinition<"schema.invalid_input", StandardSchemaV1<unknown, {
        issues: readonly StandardSchemaV1.Issue[];
    }>>], Failure<"contracts.random_source_unavailable", undefined> | Failure<"failure.unexpected_defect", undefined> | Failure<"journal.conflict", {
        detail: string;
    }> | Failure<"journal.not_found", {
        detail: string;
    }> | Failure<"schema.invalid_input", {
        issues: readonly StandardSchemaV1.Issue[];
    }> | {
        name: string;
        code: import("../index.js").LimitValues;
        override: import("../index.js").LimitValues;
        effective: import("../index.js").LimitValues;
        paused: boolean;
        running: number;
        queued: number;
        version: number;
        workflows: string[];
        keys: {
            perKey: number;
            until: string;
            key: string;
        }[];
    }>;
    resumeLimit: import("@arki/admin/module").Action<z.ZodObject<{
        name: z.ZodString;
        reason: z.ZodString;
    }, z.core.$strict>, z.ZodObject<{
        revision: z.ZodString;
        limit: z.ZodObject<{
            name: z.ZodString;
            workflows: z.ZodArray<z.ZodString>;
            code: z.ZodObject<{
                total: z.ZodNullable<z.ZodNumber>;
                perKey: z.ZodNullable<z.ZodNumber>;
            }, z.core.$strict>;
            override: z.ZodObject<{
                total: z.ZodNullable<z.ZodNumber>;
                perKey: z.ZodNullable<z.ZodNumber>;
            }, z.core.$strict>;
            keys: z.ZodArray<z.ZodObject<{
                key: z.ZodString;
                perKey: z.ZodNumber;
                until: z.ZodISODateTime;
            }, z.core.$strict>>;
            effective: z.ZodObject<{
                total: z.ZodNullable<z.ZodNumber>;
                perKey: z.ZodNullable<z.ZodNumber>;
            }, z.core.$strict>;
            paused: z.ZodBoolean;
            running: z.ZodNumber;
            queued: z.ZodNumber;
            version: z.ZodNumber;
        }, z.core.$strict>;
        consequence: z.ZodString;
    }, z.core.$strict>, z.ZodObject<{
        name: z.ZodString;
        workflows: z.ZodArray<z.ZodString>;
        code: z.ZodObject<{
            total: z.ZodNullable<z.ZodNumber>;
            perKey: z.ZodNullable<z.ZodNumber>;
        }, z.core.$strict>;
        override: z.ZodObject<{
            total: z.ZodNullable<z.ZodNumber>;
            perKey: z.ZodNullable<z.ZodNumber>;
        }, z.core.$strict>;
        keys: z.ZodArray<z.ZodObject<{
            key: z.ZodString;
            perKey: z.ZodNumber;
            until: z.ZodISODateTime;
        }, z.core.$strict>>;
        effective: z.ZodObject<{
            total: z.ZodNullable<z.ZodNumber>;
            perKey: z.ZodNullable<z.ZodNumber>;
        }, z.core.$strict>;
        paused: z.ZodBoolean;
        running: z.ZodNumber;
        queued: z.ZodNumber;
        version: z.ZodNumber;
    }, z.core.$strict>, Record<string, never>, readonly [import("@arki/failure").FailureDefinition<"contracts.random_source_unavailable", undefined>, import("@arki/failure").FailureDefinition<"failure.unexpected_defect", undefined>, import("@arki/failure").FailureDefinition<"journal.not_found", StandardSchemaV1<{
        detail: string;
    }, {
        detail: string;
    }>>, import("@arki/failure").FailureDefinition<"journal.invalid", StandardSchemaV1<{
        detail: string;
    }, {
        detail: string;
    }>>, import("@arki/failure").FailureDefinition<"journal.conflict", StandardSchemaV1<{
        detail: string;
    }, {
        detail: string;
    }>>, import("@arki/failure").FailureDefinition<"journal.workflow_busy", StandardSchemaV1<{
        name: string;
        key: string | null;
        limit: number;
        running: string[];
        limitName?: string | undefined;
        reason?: "full" | "paused" | undefined;
        detail: string;
    }, {
        name: string;
        key: string | null;
        limit: number;
        running: string[];
        limitName?: string | undefined;
        reason?: "full" | "paused" | undefined;
        detail: string;
    }>>, import("@arki/failure").FailureDefinition<"schema.invalid_input", StandardSchemaV1<unknown, {
        issues: readonly StandardSchemaV1.Issue[];
    }>>], Failure<"contracts.random_source_unavailable", undefined> | Failure<"failure.unexpected_defect", undefined> | Failure<"journal.conflict", {
        detail: string;
    }> | Failure<"journal.not_found", {
        detail: string;
    }> | Failure<"schema.invalid_input", {
        issues: readonly StandardSchemaV1.Issue[];
    }> | {
        name: string;
        code: import("../index.js").LimitValues;
        override: import("../index.js").LimitValues;
        effective: import("../index.js").LimitValues;
        paused: boolean;
        running: number;
        queued: number;
        version: number;
        workflows: string[];
        keys: {
            perKey: number;
            until: string;
            key: string;
        }[];
    }>;
    overrideLimit: import("@arki/admin/module").Action<z.ZodUnion<readonly [z.ZodObject<{
        name: z.ZodString;
        key: z.ZodString;
        perKey: z.ZodInt;
        ttl: z.ZodOptional<z.ZodUnion<readonly [z.ZodNumber, z.ZodTemplateLiteral<`${number}d` | `${number}h` | `${number}m`>]>>;
        reason: z.ZodString;
    }, z.core.$strict>, z.ZodObject<{
        name: z.ZodString;
        total: z.ZodOptional<z.ZodInt>;
        perKey: z.ZodOptional<z.ZodInt>;
        reason: z.ZodString;
    }, z.core.$strict>]>, z.ZodObject<{
        revision: z.ZodString;
        limit: z.ZodObject<{
            name: z.ZodString;
            workflows: z.ZodArray<z.ZodString>;
            code: z.ZodObject<{
                total: z.ZodNullable<z.ZodNumber>;
                perKey: z.ZodNullable<z.ZodNumber>;
            }, z.core.$strict>;
            override: z.ZodObject<{
                total: z.ZodNullable<z.ZodNumber>;
                perKey: z.ZodNullable<z.ZodNumber>;
            }, z.core.$strict>;
            keys: z.ZodArray<z.ZodObject<{
                key: z.ZodString;
                perKey: z.ZodNumber;
                until: z.ZodISODateTime;
            }, z.core.$strict>>;
            effective: z.ZodObject<{
                total: z.ZodNullable<z.ZodNumber>;
                perKey: z.ZodNullable<z.ZodNumber>;
            }, z.core.$strict>;
            paused: z.ZodBoolean;
            running: z.ZodNumber;
            queued: z.ZodNumber;
            version: z.ZodNumber;
        }, z.core.$strict>;
        consequence: z.ZodString;
    }, z.core.$strict>, z.ZodObject<{
        name: z.ZodString;
        workflows: z.ZodArray<z.ZodString>;
        code: z.ZodObject<{
            total: z.ZodNullable<z.ZodNumber>;
            perKey: z.ZodNullable<z.ZodNumber>;
        }, z.core.$strict>;
        override: z.ZodObject<{
            total: z.ZodNullable<z.ZodNumber>;
            perKey: z.ZodNullable<z.ZodNumber>;
        }, z.core.$strict>;
        keys: z.ZodArray<z.ZodObject<{
            key: z.ZodString;
            perKey: z.ZodNumber;
            until: z.ZodISODateTime;
        }, z.core.$strict>>;
        effective: z.ZodObject<{
            total: z.ZodNullable<z.ZodNumber>;
            perKey: z.ZodNullable<z.ZodNumber>;
        }, z.core.$strict>;
        paused: z.ZodBoolean;
        running: z.ZodNumber;
        queued: z.ZodNumber;
        version: z.ZodNumber;
    }, z.core.$strict>, Record<string, never>, readonly [import("@arki/failure").FailureDefinition<"contracts.random_source_unavailable", undefined>, import("@arki/failure").FailureDefinition<"failure.unexpected_defect", undefined>, import("@arki/failure").FailureDefinition<"journal.not_found", StandardSchemaV1<{
        detail: string;
    }, {
        detail: string;
    }>>, import("@arki/failure").FailureDefinition<"journal.invalid", StandardSchemaV1<{
        detail: string;
    }, {
        detail: string;
    }>>, import("@arki/failure").FailureDefinition<"journal.conflict", StandardSchemaV1<{
        detail: string;
    }, {
        detail: string;
    }>>, import("@arki/failure").FailureDefinition<"journal.workflow_busy", StandardSchemaV1<{
        name: string;
        key: string | null;
        limit: number;
        running: string[];
        limitName?: string | undefined;
        reason?: "full" | "paused" | undefined;
        detail: string;
    }, {
        name: string;
        key: string | null;
        limit: number;
        running: string[];
        limitName?: string | undefined;
        reason?: "full" | "paused" | undefined;
        detail: string;
    }>>, import("@arki/failure").FailureDefinition<"schema.invalid_input", StandardSchemaV1<unknown, {
        issues: readonly StandardSchemaV1.Issue[];
    }>>], Failure<"contracts.random_source_unavailable", undefined> | Failure<"failure.unexpected_defect", undefined> | Failure<"journal.conflict", {
        detail: string;
    }> | Failure<"journal.invalid", {
        detail: string;
    }> | Failure<"journal.not_found", {
        detail: string;
    }> | Failure<"schema.invalid_input", {
        issues: readonly StandardSchemaV1.Issue[];
    }> | {
        name: string;
        code: import("../index.js").LimitValues;
        override: import("../index.js").LimitValues;
        effective: import("../index.js").LimitValues;
        paused: boolean;
        running: number;
        queued: number;
        version: number;
        workflows: string[];
        keys: {
            perKey: number;
            until: string;
            key: string;
        }[];
    }>;
    resetLimit: import("@arki/admin/module").Action<z.ZodObject<{
        name: z.ZodString;
        key: z.ZodOptional<z.ZodString>;
        reason: z.ZodString;
    }, z.core.$strict>, z.ZodObject<{
        revision: z.ZodString;
        limit: z.ZodObject<{
            name: z.ZodString;
            workflows: z.ZodArray<z.ZodString>;
            code: z.ZodObject<{
                total: z.ZodNullable<z.ZodNumber>;
                perKey: z.ZodNullable<z.ZodNumber>;
            }, z.core.$strict>;
            override: z.ZodObject<{
                total: z.ZodNullable<z.ZodNumber>;
                perKey: z.ZodNullable<z.ZodNumber>;
            }, z.core.$strict>;
            keys: z.ZodArray<z.ZodObject<{
                key: z.ZodString;
                perKey: z.ZodNumber;
                until: z.ZodISODateTime;
            }, z.core.$strict>>;
            effective: z.ZodObject<{
                total: z.ZodNullable<z.ZodNumber>;
                perKey: z.ZodNullable<z.ZodNumber>;
            }, z.core.$strict>;
            paused: z.ZodBoolean;
            running: z.ZodNumber;
            queued: z.ZodNumber;
            version: z.ZodNumber;
        }, z.core.$strict>;
        consequence: z.ZodString;
    }, z.core.$strict>, z.ZodObject<{
        name: z.ZodString;
        workflows: z.ZodArray<z.ZodString>;
        code: z.ZodObject<{
            total: z.ZodNullable<z.ZodNumber>;
            perKey: z.ZodNullable<z.ZodNumber>;
        }, z.core.$strict>;
        override: z.ZodObject<{
            total: z.ZodNullable<z.ZodNumber>;
            perKey: z.ZodNullable<z.ZodNumber>;
        }, z.core.$strict>;
        keys: z.ZodArray<z.ZodObject<{
            key: z.ZodString;
            perKey: z.ZodNumber;
            until: z.ZodISODateTime;
        }, z.core.$strict>>;
        effective: z.ZodObject<{
            total: z.ZodNullable<z.ZodNumber>;
            perKey: z.ZodNullable<z.ZodNumber>;
        }, z.core.$strict>;
        paused: z.ZodBoolean;
        running: z.ZodNumber;
        queued: z.ZodNumber;
        version: z.ZodNumber;
    }, z.core.$strict>, Record<string, never>, readonly [import("@arki/failure").FailureDefinition<"contracts.random_source_unavailable", undefined>, import("@arki/failure").FailureDefinition<"failure.unexpected_defect", undefined>, import("@arki/failure").FailureDefinition<"journal.not_found", StandardSchemaV1<{
        detail: string;
    }, {
        detail: string;
    }>>, import("@arki/failure").FailureDefinition<"journal.invalid", StandardSchemaV1<{
        detail: string;
    }, {
        detail: string;
    }>>, import("@arki/failure").FailureDefinition<"journal.conflict", StandardSchemaV1<{
        detail: string;
    }, {
        detail: string;
    }>>, import("@arki/failure").FailureDefinition<"journal.workflow_busy", StandardSchemaV1<{
        name: string;
        key: string | null;
        limit: number;
        running: string[];
        limitName?: string | undefined;
        reason?: "full" | "paused" | undefined;
        detail: string;
    }, {
        name: string;
        key: string | null;
        limit: number;
        running: string[];
        limitName?: string | undefined;
        reason?: "full" | "paused" | undefined;
        detail: string;
    }>>, import("@arki/failure").FailureDefinition<"schema.invalid_input", StandardSchemaV1<unknown, {
        issues: readonly StandardSchemaV1.Issue[];
    }>>], Failure<"contracts.random_source_unavailable", undefined> | Failure<"failure.unexpected_defect", undefined> | Failure<"journal.conflict", {
        detail: string;
    }> | Failure<"journal.not_found", {
        detail: string;
    }> | Failure<"schema.invalid_input", {
        issues: readonly StandardSchemaV1.Issue[];
    }> | {
        name: string;
        code: import("../index.js").LimitValues;
        override: import("../index.js").LimitValues;
        effective: import("../index.js").LimitValues;
        paused: boolean;
        running: number;
        queued: number;
        version: number;
        workflows: string[];
        keys: {
            perKey: number;
            until: string;
            key: string;
        }[];
    }>;
}>;
//# sourceMappingURL=workflows.d.ts.map