import { z } from 'zod';
import type { StandardSchemaV1 } from '@arki/schema';
import type { JournalDefinitions } from '../api.js';
import type { JournalTables } from '../pg.js';
import type { DbHandle, TransactionSource } from '../types.js';
import type { HeldLimit, KnownLimit, LimitBlock, LimitKeyOverride, LimitView } from './limit-types.js';
/** Checks a stored key override. The type is the source; `schemas.test-d.ts` locks this schema to it both ways. */
export declare const limitKeyOverrideSchema: z.ZodReadonly<z.ZodObject<{
    perKey: z.ZodInt;
    until: z.ZodISODateTime;
}, z.core.$strip>>;
/**
 * The `journal.limit` entity: one row per limit an operator changed, in `journal_limits`. A limit nobody changed has
 * no row, and its code values apply.
 */
export declare function limitMachine<Meta extends StandardSchemaV1<unknown, Record<string, unknown>>, Tx extends TransactionSource<Tx> = DbHandle>(j: Pick<JournalDefinitions<Meta, Tx>, 'event' | 'entity'>, tables: Pick<JournalTables, 'limits'>): {
    limit: import("../entity.js").OnOnlyEntityBuilder<"journal.limit", import("drizzle-orm/pg-core").PgTableWithColumns<{
        name: "journal_limits";
        schema: string | undefined;
        columns: {
            name: import("drizzle-orm/pg-core").PgBuildColumn<"journal_limits", import("drizzle-orm/pg-core").SetIsPrimaryKey<import("drizzle-orm/pg-core").PgVarcharBuilder<[string, ...string[]]>>, {
                name: string;
                tableName: "journal_limits";
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
            paused: import("drizzle-orm/pg-core").PgBuildColumn<"journal_limits", import("drizzle-orm/pg-core").SetHasDefault<import("drizzle-orm/pg-core").SetNotNull<import("drizzle-orm/pg-core").PgBooleanBuilder>>, {
                name: string;
                tableName: "journal_limits";
                dataType: "boolean";
                data: boolean;
                driverParam: boolean;
                notNull: true;
                hasDefault: true;
                isPrimaryKey: false;
                isAutoincrement: false;
                hasRuntimeDefault: false;
                enumValues: undefined;
                identity: undefined;
                generated: undefined;
            }>;
            total: import("drizzle-orm/pg-core").PgBuildColumn<"journal_limits", import("drizzle-orm/pg-core").PgIntegerBuilder, {
                name: string;
                tableName: "journal_limits";
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
            perKey: import("drizzle-orm/pg-core").PgBuildColumn<"journal_limits", import("drizzle-orm/pg-core").PgIntegerBuilder, {
                name: string;
                tableName: "journal_limits";
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
            keys: import("drizzle-orm/pg-core").PgBuildColumn<"journal_limits", import("drizzle-orm/pg-core").SetHasDefault<import("drizzle-orm/pg-core").Set$Type<import("drizzle-orm/pg-core").SetNotNull<import("drizzle-orm/pg-core").PgJsonbBuilder>, Readonly<Record<string, LimitKeyOverride>>>>, {
                name: string;
                tableName: "journal_limits";
                dataType: "object json";
                data: Readonly<Record<string, LimitKeyOverride>>;
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
            version: import("drizzle-orm/pg-core").PgBuildColumn<"journal_limits", import("drizzle-orm/pg-core").SetHasDefault<import("drizzle-orm/pg-core").SetNotNull<import("drizzle-orm/pg-core").PgIntegerBuilder>>, {
                name: string;
                tableName: "journal_limits";
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
    }>, import("../types.js").EventDef<"LimitKeyOverridden", z.ZodObject<{
        actorId: z.ZodOptional<z.ZodString>;
        reason: z.ZodOptional<z.ZodString>;
        executionId: z.ZodOptional<z.ZodString>;
        perKey: z.ZodInt;
        until: z.ZodISODateTime;
        key: z.ZodString;
        expired: z.ZodReadonly<z.ZodArray<z.ZodString>>;
        at: z.ZodISODateTime;
    }, z.core.$strip>> | import("../types.js").EventDef<"LimitOverridden", z.ZodObject<{
        actorId: z.ZodOptional<z.ZodString>;
        reason: z.ZodOptional<z.ZodString>;
        executionId: z.ZodOptional<z.ZodString>;
        total: z.ZodOptional<z.ZodInt>;
        perKey: z.ZodOptional<z.ZodInt>;
        at: z.ZodISODateTime;
    }, z.core.$strip>> | import("../types.js").EventDef<"LimitPaused", z.ZodObject<{
        actorId: z.ZodOptional<z.ZodString>;
        reason: z.ZodOptional<z.ZodString>;
        executionId: z.ZodOptional<z.ZodString>;
        at: z.ZodISODateTime;
    }, z.core.$strip>> | import("../types.js").EventDef<"LimitReset", z.ZodObject<{
        actorId: z.ZodOptional<z.ZodString>;
        reason: z.ZodOptional<z.ZodString>;
        executionId: z.ZodOptional<z.ZodString>;
        key: z.ZodOptional<z.ZodString>;
        at: z.ZodISODateTime;
    }, z.core.$strip>> | import("../types.js").EventDef<"LimitResumed", z.ZodObject<{
        actorId: z.ZodOptional<z.ZodString>;
        reason: z.ZodOptional<z.ZodString>;
        executionId: z.ZodOptional<z.ZodString>;
        at: z.ZodISODateTime;
    }, z.core.$strip>>, import("@arki/schema").SchemaOutput<Meta>, "name", {
        paused: boolean;
        total: number | null;
        perKey: number | null;
        keys: {};
    } | {
        paused: boolean;
        total: null;
        perKey: null;
        keys: {
            [x: string]: LimitKeyOverride | {
                perKey: number;
                until: string;
            };
        };
    } | {
        total: null;
        perKey: null;
        keys: {};
        paused: true;
    }>;
    events: {
        LimitOverridden: import("../types.js").EventDef<"LimitOverridden", z.ZodObject<{
            actorId: z.ZodOptional<z.ZodString>;
            reason: z.ZodOptional<z.ZodString>;
            executionId: z.ZodOptional<z.ZodString>;
            total: z.ZodOptional<z.ZodInt>;
            perKey: z.ZodOptional<z.ZodInt>;
            at: z.ZodISODateTime;
        }, z.core.$strip>>;
        LimitKeyOverridden: import("../types.js").EventDef<"LimitKeyOverridden", z.ZodObject<{
            actorId: z.ZodOptional<z.ZodString>;
            reason: z.ZodOptional<z.ZodString>;
            executionId: z.ZodOptional<z.ZodString>;
            perKey: z.ZodInt;
            until: z.ZodISODateTime;
            key: z.ZodString;
            expired: z.ZodReadonly<z.ZodArray<z.ZodString>>;
            at: z.ZodISODateTime;
        }, z.core.$strip>>;
        LimitReset: import("../types.js").EventDef<"LimitReset", z.ZodObject<{
            actorId: z.ZodOptional<z.ZodString>;
            reason: z.ZodOptional<z.ZodString>;
            executionId: z.ZodOptional<z.ZodString>;
            key: z.ZodOptional<z.ZodString>;
            at: z.ZodISODateTime;
        }, z.core.$strip>>;
        LimitPaused: import("../types.js").EventDef<"LimitPaused", z.ZodObject<{
            actorId: z.ZodOptional<z.ZodString>;
            reason: z.ZodOptional<z.ZodString>;
            executionId: z.ZodOptional<z.ZodString>;
            at: z.ZodISODateTime;
        }, z.core.$strip>>;
        LimitResumed: import("../types.js").EventDef<"LimitResumed", z.ZodObject<{
            actorId: z.ZodOptional<z.ZodString>;
            reason: z.ZodOptional<z.ZodString>;
            executionId: z.ZodOptional<z.ZodString>;
            at: z.ZodISODateTime;
        }, z.core.$strip>>;
    };
};
/** The key override of `key` on a stored row, if one is set and has not expired. An expired one is ignored. */
export declare function liveKeyOverride(keys: Readonly<Record<string, LimitKeyOverride>> | undefined, key: string, now: Date): LimitKeyOverride | undefined;
/** The advisory lock of a limit. A start takes it shared, an operator verb exclusive, so a verb waits for the starts. */
export declare const limitLockId: (name: string) => string;
export declare const lockExclusive: (tx: Pick<DbHandle, 'execute'>, id: string) => import("drizzle-orm/pg-core").PgAsyncRaw<unknown>;
type Reader = Pick<DbHandle, 'select'>;
type Locker = Pick<DbHandle, 'select' | 'execute'>;
/**
 * What a promotion leaves out of its next look: a run it tried that cannot start now (`id`), or every queued run that
 * holds a limit found paused or full, with `key` when only that key's `perKey` is full. Those would be refused too.
 */
export type PromoteSkip = {
    readonly id: string;
} | {
    readonly limit: HeldLimit;
    readonly key: string | null;
};
/** The start gate's reads: which limit blocks a start, the runs that hold a limit, and a limit as an operator sees it. */
export declare function createLimitGate(tables: Pick<JournalTables, 'workflowRuns' | 'limits'>): {
    blocking: (tx: Locker, start: {
        readonly held: readonly HeldLimit[];
        readonly key: string | null;
        readonly gated: boolean;
    }) => Promise<LimitBlock | undefined>;
    tryBlocking: (tx: Locker, start: {
        readonly held: readonly HeldLimit[];
        readonly key: string | null;
        readonly gated: boolean;
    }) => Promise<"locked" | LimitBlock | undefined>;
    holdersIn: (tx: Reader, block: LimitBlock, key: string | null, scope: string | null) => Promise<string[]>;
    oldestQueued: (tx: Reader, among: readonly Pick<HeldLimit, 'name' | 'workflow'>[], key: string | null, skips: readonly PromoteSkip[]) => Promise<string | undefined>;
    view: (db: Reader, known: KnownLimit) => Promise<LimitView>;
};
/** The keys of a stored row whose override has run out by `now`: a new key override drops them from the row. */
export declare const expiredKeys: (keys: Readonly<Record<string, LimitKeyOverride>> | undefined, now: Date) => string[];
export {};
//# sourceMappingURL=limits.d.ts.map