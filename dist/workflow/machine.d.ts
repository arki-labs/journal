import { z } from 'zod';
import type { StandardSchemaV1 } from '@arki/schema';
import type { JournalDefinitions } from '../api.js';
import type { JournalTables } from '../pg.js';
import type { DbHandle, TransactionSource } from '../types.js';
import type { WorkflowShape } from './shape.js';
/** The branches of a `parallel` node. The nested shape is typed by `WorkflowShape` so the schema can refer to itself. */
type BranchesSchema = z.ZodOptional<z.ZodReadonly<z.ZodArray<z.ZodReadonly<z.ZodObject<{
    name: z.ZodString;
    shape: z.ZodType<WorkflowShape>;
}>>>>>;
/** Checks a stored `WorkflowShape`. The type is the source; `schemas.test-d.ts` locks this schema to it both ways. */
export declare const shapeSchema: z.ZodReadonly<z.ZodObject<{
    nodes: z.ZodReadonly<z.ZodArray<z.ZodReadonly<z.ZodObject<{
        name: z.ZodString;
        kind: z.ZodEnum<{
            child: "child";
            command: "command";
            eventWait: "eventWait";
            map: "map";
            parallel: "parallel";
            sleep: "sleep";
            step: "step";
            waitFor: "waitFor";
        }>;
        undo: z.ZodBoolean;
        onCancel: z.ZodOptional<z.ZodEnum<{
            cancel: "cancel";
            detach: "detach";
        }>>;
        signal: z.ZodOptional<z.ZodString>;
        command: z.ZodOptional<z.ZodString>;
        undoCommand: z.ZodOptional<z.ZodString>;
        on: z.ZodOptional<z.ZodReadonly<z.ZodArray<z.ZodReadonly<z.ZodObject<{
            label: z.ZodString;
            entity: z.ZodString;
            events: z.ZodReadonly<z.ZodArray<z.ZodString>>;
        }, z.core.$strip>>>>>;
        wait: z.ZodOptional<z.ZodEnum<{
            all: "all";
            any: "any";
        }>>;
        branches: BranchesSchema;
    }, z.core.$strip>>>>;
}, z.core.$strip>>;
/** Who asked, why, and from which Foreman execution, on an event an operator verb wrote. The run's events are the audit. */
export declare const byOperator: {
    actorId: z.ZodOptional<z.ZodString>;
    reason: z.ZodOptional<z.ZodString>;
    executionId: z.ZodOptional<z.ZodString>;
};
export declare function workflowMachine<Meta extends StandardSchemaV1<unknown, Record<string, unknown>>, Tx extends TransactionSource<Tx> = DbHandle>(j: Pick<JournalDefinitions<Meta, Tx>, 'event' | 'entity' | 'projection'>, tables: Pick<JournalTables, 'workflowRuns' | 'workflowSteps'>): {
    run: import("../entity.js").OnOnlyEntityBuilder<"workflow.run", import("drizzle-orm/pg-core").PgTableWithColumns<{
        name: "workflow_runs";
        schema: string | undefined;
        columns: {
            id: import("drizzle-orm/pg-core").PgBuildColumn<"workflow_runs", import("drizzle-orm/pg-core").SetIsPrimaryKey<import("drizzle-orm/pg-core").PgVarcharBuilder<[string, ...string[]]>>, {
                name: string;
                tableName: "workflow_runs";
                dataType: "string";
                data: string;
                driverParam: string;
                notNull: true;
                hasDefault: false;
                isPrimaryKey: false;
                isAutoincrement: false;
                hasRuntimeDefault: false;
                enumValues: undefined;
                identity: undefined;
                generated: undefined;
            }>;
            name: import("drizzle-orm/pg-core").PgBuildColumn<"workflow_runs", import("drizzle-orm/pg-core").SetNotNull<import("drizzle-orm/pg-core").PgVarcharBuilder<[string, ...string[]]>>, {
                name: string;
                tableName: "workflow_runs";
                dataType: "string";
                data: string;
                driverParam: string;
                notNull: true;
                hasDefault: false;
                isPrimaryKey: false;
                isAutoincrement: false;
                hasRuntimeDefault: false;
                enumValues: undefined;
                identity: undefined;
                generated: undefined;
            }>;
            workflowVersion: import("drizzle-orm/pg-core").PgBuildColumn<"workflow_runs", import("drizzle-orm/pg-core").SetNotNull<import("drizzle-orm/pg-core").PgIntegerBuilder>, {
                name: string;
                tableName: "workflow_runs";
                dataType: "number int32";
                data: number;
                driverParam: string | number;
                notNull: true;
                hasDefault: false;
                isPrimaryKey: false;
                isAutoincrement: false;
                hasRuntimeDefault: false;
                enumValues: undefined;
                identity: undefined;
                generated: undefined;
            }>;
            shape: import("drizzle-orm/pg-core").PgBuildColumn<"workflow_runs", import("drizzle-orm/pg-core").Set$Type<import("drizzle-orm/pg-core").SetNotNull<import("drizzle-orm/pg-core").PgJsonbBuilder>, WorkflowShape>, {
                name: string;
                tableName: "workflow_runs";
                dataType: "object json";
                data: WorkflowShape;
                driverParam: unknown;
                notNull: true;
                hasDefault: false;
                isPrimaryKey: false;
                isAutoincrement: false;
                hasRuntimeDefault: false;
                enumValues: undefined;
                identity: undefined;
                generated: undefined;
            }>;
            shapeHash: import("drizzle-orm/pg-core").PgBuildColumn<"workflow_runs", import("drizzle-orm/pg-core").SetNotNull<import("drizzle-orm/pg-core").PgVarcharBuilder<[string, ...string[]]>>, {
                name: string;
                tableName: "workflow_runs";
                dataType: "string";
                data: string;
                driverParam: string;
                notNull: true;
                hasDefault: false;
                isPrimaryKey: false;
                isAutoincrement: false;
                hasRuntimeDefault: false;
                enumValues: undefined;
                identity: undefined;
                generated: undefined;
            }>;
            input: import("drizzle-orm/pg-core").PgBuildColumn<"workflow_runs", import("drizzle-orm/pg-core").SetNotNull<import("drizzle-orm/pg-core").PgJsonbBuilder>, {
                name: string;
                tableName: "workflow_runs";
                dataType: "object json";
                data: unknown;
                driverParam: unknown;
                notNull: true;
                hasDefault: false;
                isPrimaryKey: false;
                isAutoincrement: false;
                hasRuntimeDefault: false;
                enumValues: undefined;
                identity: undefined;
                generated: undefined;
            }>;
            state: import("drizzle-orm/pg-core").PgBuildColumn<"workflow_runs", import("drizzle-orm/pg-core").Set$Type<import("drizzle-orm/pg-core").SetNotNull<import("drizzle-orm/pg-core").PgVarcharBuilder<[string, ...string[]]>>, "cancelled" | "compensating" | "completed" | "expired" | "failed" | "parked" | "queued" | "running">, {
                name: string;
                tableName: "workflow_runs";
                dataType: "string";
                data: "cancelled" | "compensating" | "completed" | "expired" | "failed" | "parked" | "queued" | "running";
                driverParam: string;
                notNull: true;
                hasDefault: false;
                isPrimaryKey: false;
                isAutoincrement: false;
                hasRuntimeDefault: false;
                enumValues: undefined;
                identity: undefined;
                generated: undefined;
            }>;
            node: import("drizzle-orm/pg-core").PgBuildColumn<"workflow_runs", import("drizzle-orm/pg-core").PgVarcharBuilder<[string, ...string[]]>, {
                name: string;
                tableName: "workflow_runs";
                dataType: "string";
                data: string;
                driverParam: string;
                notNull: false;
                hasDefault: false;
                isPrimaryKey: false;
                isAutoincrement: false;
                hasRuntimeDefault: false;
                enumValues: undefined;
                identity: undefined;
                generated: undefined;
            }>;
            results: import("drizzle-orm/pg-core").PgBuildColumn<"workflow_runs", import("drizzle-orm/pg-core").SetHasDefault<import("drizzle-orm/pg-core").Set$Type<import("drizzle-orm/pg-core").SetNotNull<import("drizzle-orm/pg-core").PgJsonbBuilder>, Readonly<Record<string, unknown>>>>, {
                name: string;
                tableName: "workflow_runs";
                dataType: "object json";
                data: Readonly<Record<string, unknown>>;
                driverParam: unknown;
                notNull: true;
                hasDefault: true;
                isPrimaryKey: false;
                isAutoincrement: false;
                hasRuntimeDefault: false;
                enumValues: undefined;
                identity: undefined;
                generated: undefined;
            }>;
            output: import("drizzle-orm/pg-core").PgBuildColumn<"workflow_runs", import("drizzle-orm/pg-core").PgJsonbBuilder, {
                name: string;
                tableName: "workflow_runs";
                dataType: "object json";
                data: unknown;
                driverParam: unknown;
                notNull: false;
                hasDefault: false;
                isPrimaryKey: false;
                isAutoincrement: false;
                hasRuntimeDefault: false;
                enumValues: undefined;
                identity: undefined;
                generated: undefined;
            }>;
            wakeAt: import("drizzle-orm/pg-core").PgBuildColumn<"workflow_runs", import("drizzle-orm/pg-core").PgTimestampBuilder, {
                name: string;
                tableName: "workflow_runs";
                dataType: "object date";
                data: Date;
                driverParam: string;
                notNull: false;
                hasDefault: false;
                isPrimaryKey: false;
                isAutoincrement: false;
                hasRuntimeDefault: false;
                enumValues: undefined;
                identity: undefined;
                generated: undefined;
            }>;
            deadlineAt: import("drizzle-orm/pg-core").PgBuildColumn<"workflow_runs", import("drizzle-orm/pg-core").PgTimestampBuilder, {
                name: string;
                tableName: "workflow_runs";
                dataType: "object date";
                data: Date;
                driverParam: string;
                notNull: false;
                hasDefault: false;
                isPrimaryKey: false;
                isAutoincrement: false;
                hasRuntimeDefault: false;
                enumValues: undefined;
                identity: undefined;
                generated: undefined;
            }>;
            waitingFor: import("drizzle-orm/pg-core").PgBuildColumn<"workflow_runs", import("drizzle-orm/pg-core").PgVarcharBuilder<[string, ...string[]]>, {
                name: string;
                tableName: "workflow_runs";
                dataType: "string";
                data: string;
                driverParam: string;
                notNull: false;
                hasDefault: false;
                isPrimaryKey: false;
                isAutoincrement: false;
                hasRuntimeDefault: false;
                enumValues: undefined;
                identity: undefined;
                generated: undefined;
            }>;
            parentId: import("drizzle-orm/pg-core").PgBuildColumn<"workflow_runs", import("drizzle-orm/pg-core").PgVarcharBuilder<[string, ...string[]]>, {
                name: string;
                tableName: "workflow_runs";
                dataType: "string";
                data: string;
                driverParam: string;
                notNull: false;
                hasDefault: false;
                isPrimaryKey: false;
                isAutoincrement: false;
                hasRuntimeDefault: false;
                enumValues: undefined;
                identity: undefined;
                generated: undefined;
            }>;
            parentPath: import("drizzle-orm/pg-core").PgBuildColumn<"workflow_runs", import("drizzle-orm/pg-core").PgVarcharBuilder<[string, ...string[]]>, {
                name: string;
                tableName: "workflow_runs";
                dataType: "string";
                data: string;
                driverParam: string;
                notNull: false;
                hasDefault: false;
                isPrimaryKey: false;
                isAutoincrement: false;
                hasRuntimeDefault: false;
                enumValues: undefined;
                identity: undefined;
                generated: undefined;
            }>;
            concurrencyKey: import("drizzle-orm/pg-core").PgBuildColumn<"workflow_runs", import("drizzle-orm/pg-core").PgVarcharBuilder<[string, ...string[]]>, {
                name: string;
                tableName: "workflow_runs";
                dataType: "string";
                data: string;
                driverParam: string;
                notNull: false;
                hasDefault: false;
                isPrimaryKey: false;
                isAutoincrement: false;
                hasRuntimeDefault: false;
                enumValues: undefined;
                identity: undefined;
                generated: undefined;
            }>;
            scope: import("drizzle-orm/pg-core").PgBuildColumn<"workflow_runs", import("drizzle-orm/pg-core").PgVarcharBuilder<[string, ...string[]]>, {
                name: string;
                tableName: "workflow_runs";
                dataType: "string";
                data: string;
                driverParam: string;
                notNull: false;
                hasDefault: false;
                isPrimaryKey: false;
                isAutoincrement: false;
                hasRuntimeDefault: false;
                enumValues: undefined;
                identity: undefined;
                generated: undefined;
            }>;
            tags: import("drizzle-orm/pg-core").PgBuildColumn<"workflow_runs", import("drizzle-orm/pg-core").SetHasDefault<import("drizzle-orm/pg-core").SetNotNull<import("drizzle-orm/pg-core").SetDimensions<import("drizzle-orm/pg-core").PgTextBuilder<[string, ...string[]]>, 1>>>, {
                name: string;
                tableName: "workflow_runs";
                dataType: "string";
                data: string[];
                driverParam: string | string[];
                notNull: true;
                hasDefault: true;
                isPrimaryKey: false;
                isAutoincrement: false;
                hasRuntimeDefault: false;
                enumValues: undefined;
                identity: undefined;
                generated: undefined;
            }>;
            metadata: import("drizzle-orm/pg-core").PgBuildColumn<"workflow_runs", import("drizzle-orm/pg-core").SetHasDefault<import("drizzle-orm/pg-core").Set$Type<import("drizzle-orm/pg-core").SetNotNull<import("drizzle-orm/pg-core").PgJsonbBuilder>, Readonly<Record<string, unknown>>>>, {
                name: string;
                tableName: "workflow_runs";
                dataType: "object json";
                data: Readonly<Record<string, unknown>>;
                driverParam: unknown;
                notNull: true;
                hasDefault: true;
                isPrimaryKey: false;
                isAutoincrement: false;
                hasRuntimeDefault: false;
                enumValues: undefined;
                identity: undefined;
                generated: undefined;
            }>;
            rootId: import("drizzle-orm/pg-core").PgBuildColumn<"workflow_runs", import("drizzle-orm/pg-core").PgVarcharBuilder<[string, ...string[]]>, {
                name: string;
                tableName: "workflow_runs";
                dataType: "string";
                data: string;
                driverParam: string;
                notNull: false;
                hasDefault: false;
                isPrimaryKey: false;
                isAutoincrement: false;
                hasRuntimeDefault: false;
                enumValues: undefined;
                identity: undefined;
                generated: undefined;
            }>;
            fieldChanges: import("drizzle-orm/pg-core").PgBuildColumn<"workflow_runs", import("drizzle-orm/pg-core").SetHasDefault<import("drizzle-orm/pg-core").SetNotNull<import("drizzle-orm/pg-core").PgIntegerBuilder>>, {
                name: string;
                tableName: "workflow_runs";
                dataType: "number int32";
                data: number;
                driverParam: string | number;
                notNull: true;
                hasDefault: true;
                isPrimaryKey: false;
                isAutoincrement: false;
                hasRuntimeDefault: false;
                enumValues: undefined;
                identity: undefined;
                generated: undefined;
            }>;
            transitions: import("drizzle-orm/pg-core").PgBuildColumn<"workflow_runs", import("drizzle-orm/pg-core").SetHasDefault<import("drizzle-orm/pg-core").SetNotNull<import("drizzle-orm/pg-core").PgIntegerBuilder>>, {
                name: string;
                tableName: "workflow_runs";
                dataType: "number int32";
                data: number;
                driverParam: string | number;
                notNull: true;
                hasDefault: true;
                isPrimaryKey: false;
                isAutoincrement: false;
                hasRuntimeDefault: false;
                enumValues: undefined;
                identity: undefined;
                generated: undefined;
            }>;
            startAt: import("drizzle-orm/pg-core").PgBuildColumn<"workflow_runs", import("drizzle-orm/pg-core").PgTimestampBuilder, {
                name: string;
                tableName: "workflow_runs";
                dataType: "object date";
                data: Date;
                driverParam: string;
                notNull: false;
                hasDefault: false;
                isPrimaryKey: false;
                isAutoincrement: false;
                hasRuntimeDefault: false;
                enumValues: undefined;
                identity: undefined;
                generated: undefined;
            }>;
            ttlAt: import("drizzle-orm/pg-core").PgBuildColumn<"workflow_runs", import("drizzle-orm/pg-core").PgTimestampBuilder, {
                name: string;
                tableName: "workflow_runs";
                dataType: "object date";
                data: Date;
                driverParam: string;
                notNull: false;
                hasDefault: false;
                isPrimaryKey: false;
                isAutoincrement: false;
                hasRuntimeDefault: false;
                enumValues: undefined;
                identity: undefined;
                generated: undefined;
            }>;
            ttlMs: import("drizzle-orm/pg-core").PgBuildColumn<"workflow_runs", import("drizzle-orm/pg-core").PgBigInt53Builder, {
                name: string;
                tableName: "workflow_runs";
                dataType: "number int53";
                data: number;
                driverParam: string | number;
                notNull: false;
                hasDefault: false;
                isPrimaryKey: false;
                isAutoincrement: false;
                hasRuntimeDefault: false;
                enumValues: undefined;
                identity: undefined;
                generated: undefined;
            }>;
            batchId: import("drizzle-orm/pg-core").PgBuildColumn<"workflow_runs", import("drizzle-orm/pg-core").PgVarcharBuilder<[string, ...string[]]>, {
                name: string;
                tableName: "workflow_runs";
                dataType: "string";
                data: string;
                driverParam: string;
                notNull: false;
                hasDefault: false;
                isPrimaryKey: false;
                isAutoincrement: false;
                hasRuntimeDefault: false;
                enumValues: undefined;
                identity: undefined;
                generated: undefined;
            }>;
            replayOf: import("drizzle-orm/pg-core").PgBuildColumn<"workflow_runs", import("drizzle-orm/pg-core").PgVarcharBuilder<[string, ...string[]]>, {
                name: string;
                tableName: "workflow_runs";
                dataType: "string";
                data: string;
                driverParam: string;
                notNull: false;
                hasDefault: false;
                isPrimaryKey: false;
                isAutoincrement: false;
                hasRuntimeDefault: false;
                enumValues: undefined;
                identity: undefined;
                generated: undefined;
            }>;
            maxAttempts: import("drizzle-orm/pg-core").PgBuildColumn<"workflow_runs", import("drizzle-orm/pg-core").PgIntegerBuilder, {
                name: string;
                tableName: "workflow_runs";
                dataType: "number int32";
                data: number;
                driverParam: string | number;
                notNull: false;
                hasDefault: false;
                isPrimaryKey: false;
                isAutoincrement: false;
                hasRuntimeDefault: false;
                enumValues: undefined;
                identity: undefined;
                generated: undefined;
            }>;
            stepTimeoutMs: import("drizzle-orm/pg-core").PgBuildColumn<"workflow_runs", import("drizzle-orm/pg-core").PgIntegerBuilder, {
                name: string;
                tableName: "workflow_runs";
                dataType: "number int32";
                data: number;
                driverParam: string | number;
                notNull: false;
                hasDefault: false;
                isPrimaryKey: false;
                isAutoincrement: false;
                hasRuntimeDefault: false;
                enumValues: undefined;
                identity: undefined;
                generated: undefined;
            }>;
            priority: import("drizzle-orm/pg-core").PgBuildColumn<"workflow_runs", import("drizzle-orm/pg-core").PgIntegerBuilder, {
                name: string;
                tableName: "workflow_runs";
                dataType: "number int32";
                data: number;
                driverParam: string | number;
                notNull: false;
                hasDefault: false;
                isPrimaryKey: false;
                isAutoincrement: false;
                hasRuntimeDefault: false;
                enumValues: undefined;
                identity: undefined;
                generated: undefined;
            }>;
            limits: import("drizzle-orm/pg-core").PgBuildColumn<"workflow_runs", import("drizzle-orm/pg-core").SetHasDefault<import("drizzle-orm/pg-core").SetNotNull<import("drizzle-orm/pg-core").SetDimensions<import("drizzle-orm/pg-core").PgTextBuilder<[string, ...string[]]>, 1>>>, {
                name: string;
                tableName: "workflow_runs";
                dataType: "string";
                data: string[];
                driverParam: string | string[];
                notNull: true;
                hasDefault: true;
                isPrimaryKey: false;
                isAutoincrement: false;
                hasRuntimeDefault: false;
                enumValues: undefined;
                identity: undefined;
                generated: undefined;
            }>;
            cancelledAt: import("drizzle-orm/pg-core").PgBuildColumn<"workflow_runs", import("drizzle-orm/pg-core").PgTimestampBuilder, {
                name: string;
                tableName: "workflow_runs";
                dataType: "object date";
                data: Date;
                driverParam: string;
                notNull: false;
                hasDefault: false;
                isPrimaryKey: false;
                isAutoincrement: false;
                hasRuntimeDefault: false;
                enumValues: undefined;
                identity: undefined;
                generated: undefined;
            }>;
            cancelReason: import("drizzle-orm/pg-core").PgBuildColumn<"workflow_runs", import("drizzle-orm/pg-core").PgTextBuilder<[string, ...string[]]>, {
                name: string;
                tableName: "workflow_runs";
                dataType: "string";
                data: string;
                driverParam: string;
                notNull: false;
                hasDefault: false;
                isPrimaryKey: false;
                isAutoincrement: false;
                hasRuntimeDefault: false;
                enumValues: undefined;
                identity: undefined;
                generated: undefined;
            }>;
            startedAt: import("drizzle-orm/pg-core").PgBuildColumn<"workflow_runs", import("drizzle-orm/pg-core").SetNotNull<import("drizzle-orm/pg-core").PgTimestampBuilder>, {
                name: string;
                tableName: "workflow_runs";
                dataType: "object date";
                data: Date;
                driverParam: string;
                notNull: true;
                hasDefault: false;
                isPrimaryKey: false;
                isAutoincrement: false;
                hasRuntimeDefault: false;
                enumValues: undefined;
                identity: undefined;
                generated: undefined;
            }>;
            finishedAt: import("drizzle-orm/pg-core").PgBuildColumn<"workflow_runs", import("drizzle-orm/pg-core").PgTimestampBuilder, {
                name: string;
                tableName: "workflow_runs";
                dataType: "object date";
                data: Date;
                driverParam: string;
                notNull: false;
                hasDefault: false;
                isPrimaryKey: false;
                isAutoincrement: false;
                hasRuntimeDefault: false;
                enumValues: undefined;
                identity: undefined;
                generated: undefined;
            }>;
            keepUntil: import("drizzle-orm/pg-core").PgBuildColumn<"workflow_runs", import("drizzle-orm/pg-core").PgTimestampBuilder, {
                name: string;
                tableName: "workflow_runs";
                dataType: "object date";
                data: Date;
                driverParam: string;
                notNull: false;
                hasDefault: false;
                isPrimaryKey: false;
                isAutoincrement: false;
                hasRuntimeDefault: false;
                enumValues: undefined;
                identity: undefined;
                generated: undefined;
            }>;
            version: import("drizzle-orm/pg-core").PgBuildColumn<"workflow_runs", import("drizzle-orm/pg-core").SetHasDefault<import("drizzle-orm/pg-core").SetNotNull<import("drizzle-orm/pg-core").PgIntegerBuilder>>, {
                name: string;
                tableName: "workflow_runs";
                dataType: "number int32";
                data: number;
                driverParam: string | number;
                notNull: true;
                hasDefault: true;
                isPrimaryKey: false;
                isAutoincrement: false;
                hasRuntimeDefault: false;
                enumValues: undefined;
                identity: undefined;
                generated: undefined;
            }>;
        };
        dialect: 'pg';
    }>, import("../types.js").EventDef<"CancelRequested", z.ZodObject<{
        reason: z.ZodString;
        actorId: z.ZodNullable<z.ZodString>;
        executionId: z.ZodOptional<z.ZodString>;
        at: z.ZodISODateTime;
    }, z.core.$strip>> | import("../types.js").EventDef<"ChildrenPlanned", z.ZodObject<{
        actorId: z.ZodOptional<z.ZodString>;
        reason: z.ZodOptional<z.ZodString>;
        executionId: z.ZodOptional<z.ZodString>;
        path: z.ZodString;
        base: z.ZodString;
        def: z.ZodObject<{
            name: z.ZodString;
            version: z.ZodInt;
        }, z.core.$strip>;
        children: z.ZodArray<z.ZodObject<{
            id: z.ZodString;
            input: z.ZodUnknown;
            def: z.ZodOptional<z.ZodObject<{
                name: z.ZodString;
                version: z.ZodInt;
            }, z.core.$strip>>;
        }, z.core.$strip>>;
        start: z.ZodOptional<z.ZodInt>;
        at: z.ZodISODateTime;
    }, z.core.$strip>> | import("../types.js").EventDef<"CompensationStarted", z.ZodObject<{
        at: z.ZodISODateTime;
    }, z.core.$strip>> | import("../types.js").EventDef<"DeadlineReached", z.ZodObject<{
        at: z.ZodISODateTime;
    }, z.core.$strip>> | import("../types.js").EventDef<"JobRetried", z.ZodObject<{
        actorId: z.ZodOptional<z.ZodString>;
        reason: z.ZodOptional<z.ZodString>;
        executionId: z.ZodOptional<z.ZodString>;
        jobId: z.ZodString;
        node: z.ZodNullable<z.ZodString>;
        at: z.ZodISODateTime;
    }, z.core.$strip>> | import("../types.js").EventDef<"MetadataChanged", z.ZodObject<{
        actorId: z.ZodOptional<z.ZodString>;
        reason: z.ZodOptional<z.ZodString>;
        executionId: z.ZodOptional<z.ZodString>;
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
        at: z.ZodISODateTime;
    }, z.core.$strip>> | import("../types.js").EventDef<"NodeCompleted", z.ZodObject<{
        path: z.ZodString;
        phase: z.ZodEnum<{
            do: "do";
            undo: "undo";
        }>;
        result: z.ZodUnknown;
        resolvedBy: z.ZodNullable<z.ZodString>;
        at: z.ZodISODateTime;
        reason: z.ZodOptional<z.ZodString>;
        executionId: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>> | import("../types.js").EventDef<"NodeFailed", z.ZodObject<{
        path: z.ZodString;
        phase: z.ZodEnum<{
            do: "do";
            undo: "undo";
        }>;
        attempt: z.ZodInt;
        error: z.ZodString;
        at: z.ZodISODateTime;
    }, z.core.$strip>> | import("../types.js").EventDef<"NodeScheduled", z.ZodObject<{
        actorId: z.ZodOptional<z.ZodString>;
        reason: z.ZodOptional<z.ZodString>;
        executionId: z.ZodOptional<z.ZodString>;
        path: z.ZodString;
        phase: z.ZodEnum<{
            do: "do";
            undo: "undo";
        }>;
        attempt: z.ZodInt;
        key: z.ZodString;
        jobId: z.ZodNullable<z.ZodString>;
        at: z.ZodISODateTime;
        resolution: z.ZodOptional<z.ZodObject<{
            result: z.ZodUnknown;
        }, z.core.$strip>>;
        priority: z.ZodOptional<z.ZodInt32>;
    }, z.core.$strip>> | import("../types.js").EventDef<"NodeSkipped", z.ZodObject<{
        path: z.ZodString;
        phase: z.ZodEnum<{
            do: "do";
            undo: "undo";
        }>;
        cause: z.ZodEnum<{
            compensating: "compensating";
            detached: "detached";
            expired: "expired";
            "no-undo": "no-undo";
            operator: "operator";
            when: "when";
        }>;
        reason: z.ZodString;
        actorId: z.ZodNullable<z.ZodString>;
        at: z.ZodISODateTime;
        executionId: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>> | import("../types.js").EventDef<"Parked", z.ZodObject<{
        node: z.ZodString;
        waitingFor: z.ZodNullable<z.ZodString>;
        wakeAt: z.ZodNullable<z.ZodISODateTime>;
        priority: z.ZodOptional<z.ZodInt32>;
        at: z.ZodISODateTime;
    }, z.core.$strip>> | import("../types.js").EventDef<"RunCancelled", z.ZodObject<{
        at: z.ZodISODateTime;
        keepUntil: z.ZodNullable<z.ZodISODateTime>;
    }, z.core.$strip>> | import("../types.js").EventDef<"RunCompleted", z.ZodObject<{
        output: z.ZodUnknown;
        at: z.ZodISODateTime;
        keepUntil: z.ZodNullable<z.ZodISODateTime>;
    }, z.core.$strip>> | import("../types.js").EventDef<"RunDequeued", z.ZodObject<{
        at: z.ZodISODateTime;
    }, z.core.$strip>> | import("../types.js").EventDef<"RunExpired", z.ZodObject<{
        at: z.ZodISODateTime;
        keepUntil: z.ZodNullable<z.ZodISODateTime>;
    }, z.core.$strip>> | import("../types.js").EventDef<"RunFailed", z.ZodObject<{
        error: z.ZodString;
        at: z.ZodISODateTime;
        keepUntil: z.ZodNullable<z.ZodISODateTime>;
    }, z.core.$strip>> | import("../types.js").EventDef<"RunQueued", z.ZodObject<{
        limitName: z.ZodString;
        reason: z.ZodEnum<{
            full: "full";
            paused: "paused";
        }>;
        ttlAt: z.ZodNullable<z.ZodISODateTime>;
        priority: z.ZodOptional<z.ZodInt32>;
        at: z.ZodISODateTime;
    }, z.core.$strip>> | import("../types.js").EventDef<"RunRescheduled", z.ZodObject<{
        actorId: z.ZodOptional<z.ZodString>;
        reason: z.ZodOptional<z.ZodString>;
        executionId: z.ZodOptional<z.ZodString>;
        startAt: z.ZodISODateTime;
        ttlAt: z.ZodNullable<z.ZodISODateTime>;
        deadlineAt: z.ZodNullable<z.ZodISODateTime>;
        at: z.ZodISODateTime;
    }, z.core.$strip>> | import("../types.js").EventDef<"RunStarted", z.ZodObject<{
        actorId: z.ZodOptional<z.ZodString>;
        reason: z.ZodOptional<z.ZodString>;
        executionId: z.ZodOptional<z.ZodString>;
        name: z.ZodString;
        workflowVersion: z.ZodInt;
        shape: z.ZodReadonly<z.ZodObject<{
            nodes: z.ZodReadonly<z.ZodArray<z.ZodReadonly<z.ZodObject<{
                name: z.ZodString;
                kind: z.ZodEnum<{
                    child: "child";
                    command: "command";
                    eventWait: "eventWait";
                    map: "map";
                    parallel: "parallel";
                    sleep: "sleep";
                    step: "step";
                    waitFor: "waitFor";
                }>;
                undo: z.ZodBoolean;
                onCancel: z.ZodOptional<z.ZodEnum<{
                    cancel: "cancel";
                    detach: "detach";
                }>>;
                signal: z.ZodOptional<z.ZodString>;
                command: z.ZodOptional<z.ZodString>;
                undoCommand: z.ZodOptional<z.ZodString>;
                on: z.ZodOptional<z.ZodReadonly<z.ZodArray<z.ZodReadonly<z.ZodObject<{
                    label: z.ZodString;
                    entity: z.ZodString;
                    events: z.ZodReadonly<z.ZodArray<z.ZodString>>;
                }, z.core.$strip>>>>>;
                wait: z.ZodOptional<z.ZodEnum<{
                    all: "all";
                    any: "any";
                }>>;
                branches: BranchesSchema;
            }, z.core.$strip>>>>;
        }, z.core.$strip>>;
        shapeHash: z.ZodString;
        input: z.ZodUnknown;
        deadlineAt: z.ZodNullable<z.ZodISODateTime>;
        parentId: z.ZodNullable<z.ZodString>;
        parentPath: z.ZodNullable<z.ZodString>;
        concurrencyKey: z.ZodNullable<z.ZodString>;
        scope: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        tags: z.ZodOptional<z.ZodReadonly<z.ZodArray<z.ZodString>>>;
        metadata: z.ZodOptional<z.ZodReadonly<z.ZodRecord<z.ZodString, z.ZodUnknown>>>;
        rootId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        startAt: z.ZodOptional<z.ZodNullable<z.ZodISODateTime>>;
        ttlAt: z.ZodOptional<z.ZodNullable<z.ZodISODateTime>>;
        ttlMs: z.ZodOptional<z.ZodNullable<z.ZodInt>>;
        maxAttempts: z.ZodOptional<z.ZodInt>;
        stepTimeoutMs: z.ZodOptional<z.ZodInt>;
        priority: z.ZodOptional<z.ZodInt32>;
        limits: z.ZodOptional<z.ZodReadonly<z.ZodArray<z.ZodString>>>;
        triggerSeq: z.ZodOptional<z.ZodInt>;
        results: z.ZodOptional<z.ZodReadonly<z.ZodRecord<z.ZodString, z.ZodUnknown>>>;
        batchId: z.ZodOptional<z.ZodString>;
        replayOf: z.ZodOptional<z.ZodString>;
        at: z.ZodISODateTime;
    }, z.core.$strip>> | import("../types.js").EventDef<"RunTagged", z.ZodObject<{
        actorId: z.ZodOptional<z.ZodString>;
        reason: z.ZodOptional<z.ZodString>;
        executionId: z.ZodOptional<z.ZodString>;
        tags: z.ZodReadonly<z.ZodArray<z.ZodString>>;
        at: z.ZodISODateTime;
    }, z.core.$strip>> | import("../types.js").EventDef<"SignalReceived", z.ZodObject<{
        actorId: z.ZodOptional<z.ZodString>;
        reason: z.ZodOptional<z.ZodString>;
        executionId: z.ZodOptional<z.ZodString>;
        name: z.ZodString;
        deliveryId: z.ZodString;
        at: z.ZodISODateTime;
    }, z.core.$strip>> | import("../types.js").EventDef<"TimerFired", z.ZodObject<{
        node: z.ZodString;
        at: z.ZodISODateTime;
    }, z.core.$strip>> | import("../types.js").EventDef<"WaitEventTaken", z.ZodObject<{
        node: z.ZodString;
        label: z.ZodString;
        seq: z.ZodInt;
        deliveryId: z.ZodString;
        at: z.ZodISODateTime;
    }, z.core.$strip>>, import("@arki/schema").SchemaOutput<Meta>, "id", {
        name: string;
        workflowVersion: number;
        shape: Readonly<{
            nodes: readonly Readonly<{
                name: string;
                kind: "child" | "command" | "eventWait" | "map" | "parallel" | "sleep" | "step" | "waitFor";
                undo: boolean;
                onCancel?: "cancel" | "detach" | undefined;
                signal?: string | undefined;
                command?: string | undefined;
                undoCommand?: string | undefined;
                on?: readonly Readonly<{
                    label: string;
                    entity: string;
                    events: readonly string[];
                }>[] | undefined;
                wait?: "all" | "any" | undefined;
                branches?: readonly Readonly<{
                    name: string;
                    shape: WorkflowShape;
                }>[] | undefined;
            }>[];
        }>;
        shapeHash: string;
        input: unknown;
        state: "running";
        results: {
            [x: string]: unknown;
        };
        deadlineAt: Date | null;
        parentId: string | null;
        parentPath: string | null;
        concurrencyKey: string | null;
        scope: string | null;
        tags: string[];
        metadata: Readonly<Record<string, unknown>>;
        rootId: string | null;
        fieldChanges: number;
        transitions: number;
        startAt: Date | null;
        ttlAt: Date | null;
        ttlMs: number | null;
        batchId: string | null;
        replayOf: string | null;
        maxAttempts: number | null;
        stepTimeoutMs: number | null;
        priority: number | null;
        limits: string[];
        startedAt: Date;
    }>;
    steps: import("../types.js").Projection<import("@arki/schema").SchemaOutput<Meta>, Tx>;
    events: {
        RunStarted: import("../types.js").EventDef<"RunStarted", z.ZodObject<{
            actorId: z.ZodOptional<z.ZodString>;
            reason: z.ZodOptional<z.ZodString>;
            executionId: z.ZodOptional<z.ZodString>;
            name: z.ZodString;
            workflowVersion: z.ZodInt;
            shape: z.ZodReadonly<z.ZodObject<{
                nodes: z.ZodReadonly<z.ZodArray<z.ZodReadonly<z.ZodObject<{
                    name: z.ZodString;
                    kind: z.ZodEnum<{
                        child: "child";
                        command: "command";
                        eventWait: "eventWait";
                        map: "map";
                        parallel: "parallel";
                        sleep: "sleep";
                        step: "step";
                        waitFor: "waitFor";
                    }>;
                    undo: z.ZodBoolean;
                    onCancel: z.ZodOptional<z.ZodEnum<{
                        cancel: "cancel";
                        detach: "detach";
                    }>>;
                    signal: z.ZodOptional<z.ZodString>;
                    command: z.ZodOptional<z.ZodString>;
                    undoCommand: z.ZodOptional<z.ZodString>;
                    on: z.ZodOptional<z.ZodReadonly<z.ZodArray<z.ZodReadonly<z.ZodObject<{
                        label: z.ZodString;
                        entity: z.ZodString;
                        events: z.ZodReadonly<z.ZodArray<z.ZodString>>;
                    }, z.core.$strip>>>>>;
                    wait: z.ZodOptional<z.ZodEnum<{
                        all: "all";
                        any: "any";
                    }>>;
                    branches: BranchesSchema;
                }, z.core.$strip>>>>;
            }, z.core.$strip>>;
            shapeHash: z.ZodString;
            input: z.ZodUnknown;
            deadlineAt: z.ZodNullable<z.ZodISODateTime>;
            parentId: z.ZodNullable<z.ZodString>;
            parentPath: z.ZodNullable<z.ZodString>;
            concurrencyKey: z.ZodNullable<z.ZodString>;
            scope: z.ZodOptional<z.ZodNullable<z.ZodString>>;
            tags: z.ZodOptional<z.ZodReadonly<z.ZodArray<z.ZodString>>>;
            metadata: z.ZodOptional<z.ZodReadonly<z.ZodRecord<z.ZodString, z.ZodUnknown>>>;
            rootId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
            startAt: z.ZodOptional<z.ZodNullable<z.ZodISODateTime>>;
            ttlAt: z.ZodOptional<z.ZodNullable<z.ZodISODateTime>>;
            ttlMs: z.ZodOptional<z.ZodNullable<z.ZodInt>>;
            maxAttempts: z.ZodOptional<z.ZodInt>;
            stepTimeoutMs: z.ZodOptional<z.ZodInt>;
            priority: z.ZodOptional<z.ZodInt32>;
            limits: z.ZodOptional<z.ZodReadonly<z.ZodArray<z.ZodString>>>;
            triggerSeq: z.ZodOptional<z.ZodInt>;
            results: z.ZodOptional<z.ZodReadonly<z.ZodRecord<z.ZodString, z.ZodUnknown>>>;
            batchId: z.ZodOptional<z.ZodString>;
            replayOf: z.ZodOptional<z.ZodString>;
            at: z.ZodISODateTime;
        }, z.core.$strip>>;
        RunQueued: import("../types.js").EventDef<"RunQueued", z.ZodObject<{
            limitName: z.ZodString;
            reason: z.ZodEnum<{
                full: "full";
                paused: "paused";
            }>;
            ttlAt: z.ZodNullable<z.ZodISODateTime>;
            priority: z.ZodOptional<z.ZodInt32>;
            at: z.ZodISODateTime;
        }, z.core.$strip>>;
        RunDequeued: import("../types.js").EventDef<"RunDequeued", z.ZodObject<{
            at: z.ZodISODateTime;
        }, z.core.$strip>>;
        NodeScheduled: import("../types.js").EventDef<"NodeScheduled", z.ZodObject<{
            actorId: z.ZodOptional<z.ZodString>;
            reason: z.ZodOptional<z.ZodString>;
            executionId: z.ZodOptional<z.ZodString>;
            path: z.ZodString;
            phase: z.ZodEnum<{
                do: "do";
                undo: "undo";
            }>;
            attempt: z.ZodInt;
            key: z.ZodString;
            jobId: z.ZodNullable<z.ZodString>;
            at: z.ZodISODateTime;
            resolution: z.ZodOptional<z.ZodObject<{
                result: z.ZodUnknown;
            }, z.core.$strip>>;
            priority: z.ZodOptional<z.ZodInt32>;
        }, z.core.$strip>>;
        NodeCompleted: import("../types.js").EventDef<"NodeCompleted", z.ZodObject<{
            path: z.ZodString;
            phase: z.ZodEnum<{
                do: "do";
                undo: "undo";
            }>;
            result: z.ZodUnknown;
            resolvedBy: z.ZodNullable<z.ZodString>;
            at: z.ZodISODateTime;
            reason: z.ZodOptional<z.ZodString>;
            executionId: z.ZodOptional<z.ZodString>;
        }, z.core.$strip>>;
        NodeSkipped: import("../types.js").EventDef<"NodeSkipped", z.ZodObject<{
            path: z.ZodString;
            phase: z.ZodEnum<{
                do: "do";
                undo: "undo";
            }>;
            cause: z.ZodEnum<{
                compensating: "compensating";
                detached: "detached";
                expired: "expired";
                "no-undo": "no-undo";
                operator: "operator";
                when: "when";
            }>;
            reason: z.ZodString;
            actorId: z.ZodNullable<z.ZodString>;
            at: z.ZodISODateTime;
            executionId: z.ZodOptional<z.ZodString>;
        }, z.core.$strip>>;
        NodeFailed: import("../types.js").EventDef<"NodeFailed", z.ZodObject<{
            path: z.ZodString;
            phase: z.ZodEnum<{
                do: "do";
                undo: "undo";
            }>;
            attempt: z.ZodInt;
            error: z.ZodString;
            at: z.ZodISODateTime;
        }, z.core.$strip>>;
        Parked: import("../types.js").EventDef<"Parked", z.ZodObject<{
            node: z.ZodString;
            waitingFor: z.ZodNullable<z.ZodString>;
            wakeAt: z.ZodNullable<z.ZodISODateTime>;
            priority: z.ZodOptional<z.ZodInt32>;
            at: z.ZodISODateTime;
        }, z.core.$strip>>;
        ChildrenPlanned: import("../types.js").EventDef<"ChildrenPlanned", z.ZodObject<{
            actorId: z.ZodOptional<z.ZodString>;
            reason: z.ZodOptional<z.ZodString>;
            executionId: z.ZodOptional<z.ZodString>;
            path: z.ZodString;
            base: z.ZodString;
            def: z.ZodObject<{
                name: z.ZodString;
                version: z.ZodInt;
            }, z.core.$strip>;
            children: z.ZodArray<z.ZodObject<{
                id: z.ZodString;
                input: z.ZodUnknown;
                def: z.ZodOptional<z.ZodObject<{
                    name: z.ZodString;
                    version: z.ZodInt;
                }, z.core.$strip>>;
            }, z.core.$strip>>;
            start: z.ZodOptional<z.ZodInt>;
            at: z.ZodISODateTime;
        }, z.core.$strip>>;
        JobRetried: import("../types.js").EventDef<"JobRetried", z.ZodObject<{
            actorId: z.ZodOptional<z.ZodString>;
            reason: z.ZodOptional<z.ZodString>;
            executionId: z.ZodOptional<z.ZodString>;
            jobId: z.ZodString;
            node: z.ZodNullable<z.ZodString>;
            at: z.ZodISODateTime;
        }, z.core.$strip>>;
        SignalReceived: import("../types.js").EventDef<"SignalReceived", z.ZodObject<{
            actorId: z.ZodOptional<z.ZodString>;
            reason: z.ZodOptional<z.ZodString>;
            executionId: z.ZodOptional<z.ZodString>;
            name: z.ZodString;
            deliveryId: z.ZodString;
            at: z.ZodISODateTime;
        }, z.core.$strip>>;
        WaitEventTaken: import("../types.js").EventDef<"WaitEventTaken", z.ZodObject<{
            node: z.ZodString;
            label: z.ZodString;
            seq: z.ZodInt;
            deliveryId: z.ZodString;
            at: z.ZodISODateTime;
        }, z.core.$strip>>;
        TimerFired: import("../types.js").EventDef<"TimerFired", z.ZodObject<{
            node: z.ZodString;
            at: z.ZodISODateTime;
        }, z.core.$strip>>;
        DeadlineReached: import("../types.js").EventDef<"DeadlineReached", z.ZodObject<{
            at: z.ZodISODateTime;
        }, z.core.$strip>>;
        CancelRequested: import("../types.js").EventDef<"CancelRequested", z.ZodObject<{
            reason: z.ZodString;
            actorId: z.ZodNullable<z.ZodString>;
            executionId: z.ZodOptional<z.ZodString>;
            at: z.ZodISODateTime;
        }, z.core.$strip>>;
        CompensationStarted: import("../types.js").EventDef<"CompensationStarted", z.ZodObject<{
            at: z.ZodISODateTime;
        }, z.core.$strip>>;
        MetadataChanged: import("../types.js").EventDef<"MetadataChanged", z.ZodObject<{
            actorId: z.ZodOptional<z.ZodString>;
            reason: z.ZodOptional<z.ZodString>;
            executionId: z.ZodOptional<z.ZodString>;
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
            at: z.ZodISODateTime;
        }, z.core.$strip>>;
        RunTagged: import("../types.js").EventDef<"RunTagged", z.ZodObject<{
            actorId: z.ZodOptional<z.ZodString>;
            reason: z.ZodOptional<z.ZodString>;
            executionId: z.ZodOptional<z.ZodString>;
            tags: z.ZodReadonly<z.ZodArray<z.ZodString>>;
            at: z.ZodISODateTime;
        }, z.core.$strip>>;
        RunCompleted: import("../types.js").EventDef<"RunCompleted", z.ZodObject<{
            output: z.ZodUnknown;
            at: z.ZodISODateTime;
            keepUntil: z.ZodNullable<z.ZodISODateTime>;
        }, z.core.$strip>>;
        RunFailed: import("../types.js").EventDef<"RunFailed", z.ZodObject<{
            error: z.ZodString;
            at: z.ZodISODateTime;
            keepUntil: z.ZodNullable<z.ZodISODateTime>;
        }, z.core.$strip>>;
        RunCancelled: import("../types.js").EventDef<"RunCancelled", z.ZodObject<{
            at: z.ZodISODateTime;
            keepUntil: z.ZodNullable<z.ZodISODateTime>;
        }, z.core.$strip>>;
        RunExpired: import("../types.js").EventDef<"RunExpired", z.ZodObject<{
            at: z.ZodISODateTime;
            keepUntil: z.ZodNullable<z.ZodISODateTime>;
        }, z.core.$strip>>;
        RunRescheduled: import("../types.js").EventDef<"RunRescheduled", z.ZodObject<{
            actorId: z.ZodOptional<z.ZodString>;
            reason: z.ZodOptional<z.ZodString>;
            executionId: z.ZodOptional<z.ZodString>;
            startAt: z.ZodISODateTime;
            ttlAt: z.ZodNullable<z.ZodISODateTime>;
            deadlineAt: z.ZodNullable<z.ZodISODateTime>;
            at: z.ZodISODateTime;
        }, z.core.$strip>>;
    };
};
/**
 * The status of a step as a SQL expression, for a query on `workflow_steps`. A `scheduled` step is `running` while
 * its current job (`job_id`) is alive and holds a lease, the same test `outbox.ts` uses for a running job. Any other
 * stored status is returned as it is. Nothing writes `running` to the step row, so a crashed worker's step is
 * `scheduled` again as soon as its lease runs out.
 */
export declare const stepStatusSql: (tables: Pick<JournalTables, 'workflowSteps' | 'jobs'>) => import("drizzle-orm").SQL<"done" | "failed" | "running" | "scheduled" | "skipped">;
export {};
//# sourceMappingURL=machine.d.ts.map