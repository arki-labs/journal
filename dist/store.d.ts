/**
 * The journal's Postgres storage, split by concern: entity rows, the write order (append lock
 * and seq), receipts, effect jobs and the wake signal; and the built-in event log. `bind(db)` gives every part on one handle, so a write
 * reads its own uncommitted changes. Each part turns a unique violation into the journal's
 * `CONFLICT` itself, so callers never see a driver error for a lost race.
 * May import `storage` and leaf files. Must not import `journal`, `api`, `write`,
 * `command`, `history` or `worker`.
 */
import type { PgInsertValue, PgUpdateSetSource } from 'drizzle-orm/pg-core';
import type { EventLogPosition, EventLogWrites } from './event-log.js';
import type { JournalTables } from './pg.js';
import type { AnyEntity, AnyEventDef, DbHandle, EntityDef, EntityId, EntityTable, ReducerRow, Row } from './types.js';
type EntityRowSource = Pick<AnyEntity, 'table' | 'keyColumn'>;
export declare function createPgStore(deps: {
    readonly tables: JournalTables;
    readonly wakeChannel: string;
}): {
    bind: (db: DbHandle) => {
        rows: {
            load: (entity: EntityRowSource, id: string, lock: boolean) => Promise<object | null>;
            /** A unique violation is `CONFLICT`: two creates of one id raced, or a column value is already taken. */
            insert: <Tbl extends EntityTable, Key extends string>(entity: EntityDef<string, Tbl, AnyEventDef, unknown, Key>, id: EntityId<Tbl, Key>, values: ReducerRow<Tbl, Key>) => Promise<Row<Tbl>>;
            /**
             * Set `values` on the row. With `atVersion`, only while the row is still at that version:
             * `undefined` means it moved. Without it, the caller holds the row lock.
             */
            update: <Tbl extends EntityTable, Key extends string>(entity: EntityDef<string, Tbl, AnyEventDef, unknown, Key>, id: EntityId<Tbl, Key>, values: PgUpdateSetSource<EntityTable>, atVersion?: number) => Promise<Row<Tbl> | undefined>;
            /** Delete the row. With `atVersion`, only while the row is still at that version. False when nothing was deleted. */
            remove: (entity: Pick<AnyEntity, 'kind' | 'table' | 'keyColumn'>, id: string, atVersion?: number) => Promise<boolean>;
            saveReplayed: <Tbl extends EntityTable, Key extends string>(entity: EntityDef<string, Tbl, AnyEventDef, unknown, Key>, id: EntityId<Tbl, Key>, current: object | null, next: ReducerRow<Tbl, Key> | null) => Promise<Row<Tbl> | null>;
        };
        seq: {
            /** See `APPEND_LOCK_NAMESPACE`. Re-entrant inside one transaction, so nested commands take it once. */
            lock: () => Promise<void>;
            /**
             * `count` stamps: `seq` from the events table's own sequence and `recordedAt` from the
             * transaction's `now()`, in one round trip, decoded by the columns themselves. Taken under the
             * lock, before any append, so seq order is commit order in both modes. A transient event's seq
             * is spent without a row; `causeSeq` has no foreign key, so a seq with no row is safe to point at.
             */
            stamp: (count: number) => import("drizzle-orm/pg-core").PgAsyncSelectBase<undefined, {
                seq: import("drizzle-orm").SQL<number>;
                recordedAt: import("drizzle-orm").SQL<Date>;
            }, "partial", {}, false, never, {
                seq: number;
                recordedAt: Date;
            }[], {
                seq: import("drizzle-orm").DrizzleTypeError<"You cannot reference this field without assigning it an alias first - use `.as(<alias>)`">;
                recordedAt: import("drizzle-orm").DrizzleTypeError<"You cannot reference this field without assigning it an alias first - use `.as(<alias>)`">;
            }>;
        };
        receipts: {
            /**
             * Take the key, or find the receipt that holds it: `undefined` when this run took it. The
             * insert waits on an uncommitted holder, so a concurrent repeat sees its outcome.
             */
            claim: (receipt: Pick<JournalTables['receipts']['$inferInsert'], 'key' | 'command' | 'input' | 'commandId'>) => Promise<{
                key: string;
                command: string;
                input: unknown;
                result: {
                    readonly value?: unknown;
                } | null;
                commandId: string;
                recordedAt: Date;
                owner: string | null;
                expiresAt: Date | null;
                response: unknown;
            } | undefined>;
            settle: (key: string, result: NonNullable<JournalTables['receipts']['$inferInsert']['result']>) => Promise<void>;
        };
        jobs: {
            enqueue: (queued: readonly PgInsertValue<JournalTables['jobs']>[]) => Promise<void>;
            /** The last version a forward job of `stream` still carries, dead ones included. `null`: none pending. */
            pendingTop: (stream: string) => Promise<number | null>;
        };
        wake: (range: {
            readonly from: number;
            readonly to: number;
        }) => Promise<void>;
    };
};
/** The journal's storage. Built once per journal from its tables. */
export type PgStore = ReturnType<typeof createPgStore>;
/**
 * The built-in event log: `journal_events`, in the app database. It joins the row's transaction,
 * keeps one global order (`seq`, as text positions) and rewrites events in place for `forget`.
 */
export declare function createBuiltInEventLog(deps: {
    readonly tables: Pick<JournalTables, 'events'>;
}): {
    readonly canJoinTransaction: true;
    readonly bind: (db: DbHandle) => {
        stream: (kind: string, entityId: string, filter?: {
            readonly types?: readonly string[];
            readonly afterVersion?: number;
            readonly limit?: number;
        }) => Omit<import("drizzle-orm/pg-core").PgAsyncSelectBase<"journal_events", {
            seq: import("drizzle-orm/pg-core").PgBuildColumn<"journal_events", import("drizzle-orm/pg-core").SetIsPrimaryKey<import("drizzle-orm/pg-core").PgBigSerial53Builder>, {
                name: string;
                tableName: "journal_events";
                dataType: "number int53";
                data: number;
                driverParam: number;
                notNull: true;
                hasDefault: true;
                isPrimaryKey: false;
                isAutoincrement: false;
                hasRuntimeDefault: false;
                enumValues: undefined;
                identity: undefined;
                generated: undefined;
            }>;
            id: import("drizzle-orm/pg-core").PgBuildColumn<"journal_events", import("drizzle-orm/pg-core").SetNotNull<import("drizzle-orm/pg-core").PgVarcharBuilder<[string, ...string[]]>>, {
                name: string;
                tableName: "journal_events";
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
            kind: import("drizzle-orm/pg-core").PgBuildColumn<"journal_events", import("drizzle-orm/pg-core").SetNotNull<import("drizzle-orm/pg-core").PgVarcharBuilder<[string, ...string[]]>>, {
                name: string;
                tableName: "journal_events";
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
            entityId: import("drizzle-orm/pg-core").PgBuildColumn<"journal_events", import("drizzle-orm/pg-core").SetNotNull<import("drizzle-orm/pg-core").PgVarcharBuilder<[string, ...string[]]>>, {
                name: string;
                tableName: "journal_events";
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
            version: import("drizzle-orm/pg-core").PgBuildColumn<"journal_events", import("drizzle-orm/pg-core").SetNotNull<import("drizzle-orm/pg-core").PgIntegerBuilder>, {
                name: string;
                tableName: "journal_events";
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
            type: import("drizzle-orm/pg-core").PgBuildColumn<"journal_events", import("drizzle-orm/pg-core").SetNotNull<import("drizzle-orm/pg-core").PgVarcharBuilder<[string, ...string[]]>>, {
                name: string;
                tableName: "journal_events";
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
            data: import("drizzle-orm/pg-core").PgBuildColumn<"journal_events", import("drizzle-orm/pg-core").SetNotNull<import("drizzle-orm/pg-core").PgJsonbBuilder>, {
                name: string;
                tableName: "journal_events";
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
            meta: import("drizzle-orm/pg-core").PgBuildColumn<"journal_events", import("drizzle-orm/pg-core").SetNotNull<import("drizzle-orm/pg-core").PgJsonbBuilder>, {
                name: string;
                tableName: "journal_events";
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
            recordedAt: import("drizzle-orm/pg-core").PgBuildColumn<"journal_events", import("drizzle-orm/pg-core").SetHasDefault<import("drizzle-orm/pg-core").SetNotNull<import("drizzle-orm/pg-core").PgTimestampBuilder>>, {
                name: string;
                tableName: "journal_events";
                dataType: "object date";
                data: Date;
                driverParam: string;
                notNull: true;
                hasDefault: true;
                isPrimaryKey: false;
                isAutoincrement: false;
                hasRuntimeDefault: false;
                enumValues: undefined;
                identity: undefined;
                generated: undefined;
            }>;
            commandId: import("drizzle-orm/pg-core").PgBuildColumn<"journal_events", import("drizzle-orm/pg-core").PgVarcharBuilder<[string, ...string[]]>, {
                name: string;
                tableName: "journal_events";
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
            causeSeq: import("drizzle-orm/pg-core").PgBuildColumn<"journal_events", import("drizzle-orm/pg-core").PgBigInt53Builder, {
                name: string;
                tableName: "journal_events";
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
            correlationId: import("drizzle-orm/pg-core").PgBuildColumn<"journal_events", import("drizzle-orm/pg-core").PgVarcharBuilder<[string, ...string[]]>, {
                name: string;
                tableName: "journal_events";
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
            erasedAt: import("drizzle-orm/pg-core").PgBuildColumn<"journal_events", import("drizzle-orm/pg-core").PgTimestampBuilder, {
                name: string;
                tableName: "journal_events";
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
            schemaVersion: import("drizzle-orm/pg-core").PgBuildColumn<"journal_events", import("drizzle-orm/pg-core").SetHasDefault<import("drizzle-orm/pg-core").SetNotNull<import("drizzle-orm/pg-core").PgIntegerBuilder>>, {
                name: string;
                tableName: "journal_events";
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
        }, "single", Record<"journal_events", "not-null">, false, "limit" | "orderBy" | "where", {
            seq: number;
            id: string;
            kind: string;
            entityId: string;
            version: number;
            type: string;
            data: unknown;
            meta: unknown;
            recordedAt: Date;
            commandId: string | null;
            causeSeq: number | null;
            correlationId: string | null;
            erasedAt: Date | null;
            schemaVersion: number;
        }[], {
            seq: import("drizzle-orm/pg-core").PgBuildColumn<"journal_events", import("drizzle-orm/pg-core").SetIsPrimaryKey<import("drizzle-orm/pg-core").PgBigSerial53Builder>, {
                name: string;
                tableName: "journal_events";
                dataType: "number int53";
                data: number;
                driverParam: number;
                notNull: true;
                hasDefault: true;
                isPrimaryKey: false;
                isAutoincrement: false;
                hasRuntimeDefault: false;
                enumValues: undefined;
                identity: undefined;
                generated: undefined;
            }>;
            id: import("drizzle-orm/pg-core").PgBuildColumn<"journal_events", import("drizzle-orm/pg-core").SetNotNull<import("drizzle-orm/pg-core").PgVarcharBuilder<[string, ...string[]]>>, {
                name: string;
                tableName: "journal_events";
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
            kind: import("drizzle-orm/pg-core").PgBuildColumn<"journal_events", import("drizzle-orm/pg-core").SetNotNull<import("drizzle-orm/pg-core").PgVarcharBuilder<[string, ...string[]]>>, {
                name: string;
                tableName: "journal_events";
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
            entityId: import("drizzle-orm/pg-core").PgBuildColumn<"journal_events", import("drizzle-orm/pg-core").SetNotNull<import("drizzle-orm/pg-core").PgVarcharBuilder<[string, ...string[]]>>, {
                name: string;
                tableName: "journal_events";
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
            version: import("drizzle-orm/pg-core").PgBuildColumn<"journal_events", import("drizzle-orm/pg-core").SetNotNull<import("drizzle-orm/pg-core").PgIntegerBuilder>, {
                name: string;
                tableName: "journal_events";
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
            type: import("drizzle-orm/pg-core").PgBuildColumn<"journal_events", import("drizzle-orm/pg-core").SetNotNull<import("drizzle-orm/pg-core").PgVarcharBuilder<[string, ...string[]]>>, {
                name: string;
                tableName: "journal_events";
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
            data: import("drizzle-orm/pg-core").PgBuildColumn<"journal_events", import("drizzle-orm/pg-core").SetNotNull<import("drizzle-orm/pg-core").PgJsonbBuilder>, {
                name: string;
                tableName: "journal_events";
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
            meta: import("drizzle-orm/pg-core").PgBuildColumn<"journal_events", import("drizzle-orm/pg-core").SetNotNull<import("drizzle-orm/pg-core").PgJsonbBuilder>, {
                name: string;
                tableName: "journal_events";
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
            recordedAt: import("drizzle-orm/pg-core").PgBuildColumn<"journal_events", import("drizzle-orm/pg-core").SetHasDefault<import("drizzle-orm/pg-core").SetNotNull<import("drizzle-orm/pg-core").PgTimestampBuilder>>, {
                name: string;
                tableName: "journal_events";
                dataType: "object date";
                data: Date;
                driverParam: string;
                notNull: true;
                hasDefault: true;
                isPrimaryKey: false;
                isAutoincrement: false;
                hasRuntimeDefault: false;
                enumValues: undefined;
                identity: undefined;
                generated: undefined;
            }>;
            commandId: import("drizzle-orm/pg-core").PgBuildColumn<"journal_events", import("drizzle-orm/pg-core").PgVarcharBuilder<[string, ...string[]]>, {
                name: string;
                tableName: "journal_events";
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
            causeSeq: import("drizzle-orm/pg-core").PgBuildColumn<"journal_events", import("drizzle-orm/pg-core").PgBigInt53Builder, {
                name: string;
                tableName: "journal_events";
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
            correlationId: import("drizzle-orm/pg-core").PgBuildColumn<"journal_events", import("drizzle-orm/pg-core").PgVarcharBuilder<[string, ...string[]]>, {
                name: string;
                tableName: "journal_events";
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
            erasedAt: import("drizzle-orm/pg-core").PgBuildColumn<"journal_events", import("drizzle-orm/pg-core").PgTimestampBuilder, {
                name: string;
                tableName: "journal_events";
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
            schemaVersion: import("drizzle-orm/pg-core").PgBuildColumn<"journal_events", import("drizzle-orm/pg-core").SetHasDefault<import("drizzle-orm/pg-core").SetNotNull<import("drizzle-orm/pg-core").PgIntegerBuilder>>, {
                name: string;
                tableName: "journal_events";
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
        }>, "limit" | "orderBy" | "where">;
        highestVersion: (kind: string, entityId: string) => Promise<number>;
        all: {
            /**
             * Reads the top first, then only up to it. Seq order is commit order, so every event at or
             * below a committed top is visible: `next` can move to the top without skipping one.
             */
            after: (position: EventLogPosition | null, filter: {
                readonly kinds?: readonly string[];
                readonly types?: readonly string[];
                readonly limit: number;
            }) => Promise<{
                events: never[];
                next: EventLogPosition | null;
            } | {
                events: {
                    seq: number;
                    id: string;
                    kind: string;
                    entityId: string;
                    version: number;
                    type: string;
                    data: unknown;
                    meta: unknown;
                    recordedAt: Date;
                    commandId: string | null;
                    causeSeq: number | null;
                    correlationId: string | null;
                    erasedAt: Date | null;
                    schemaVersion: number;
                    position: EventLogPosition;
                }[];
                next: EventLogPosition;
            }>;
            top: () => Promise<EventLogPosition | null>;
            distance: (from: EventLogPosition | null, to: EventLogPosition | null) => number;
        };
        append: (batch: Parameters<EventLogWrites['append']>[0]) => Promise<void>;
        erase: (at: {
            readonly kind: string;
            readonly entityId: string;
            readonly version: number;
        }, patch: {
            readonly data: unknown;
            readonly schemaVersion: number;
        }) => Promise<{
            readonly erasedAt: Date;
        }>;
        /**
         * The committed events in one seq range that the wake signal announced. Taps read this, so
         * they follow the built-in log only.
         */
        seqRange: (range: {
            readonly from: number;
            readonly to: number;
        }, filter: {
            readonly kinds: readonly string[];
            readonly types: readonly string[];
        }) => Omit<import("drizzle-orm/pg-core").PgAsyncSelectBase<"journal_events", {
            seq: import("drizzle-orm/pg-core").PgBuildColumn<"journal_events", import("drizzle-orm/pg-core").SetIsPrimaryKey<import("drizzle-orm/pg-core").PgBigSerial53Builder>, {
                name: string;
                tableName: "journal_events";
                dataType: "number int53";
                data: number;
                driverParam: number;
                notNull: true;
                hasDefault: true;
                isPrimaryKey: false;
                isAutoincrement: false;
                hasRuntimeDefault: false;
                enumValues: undefined;
                identity: undefined;
                generated: undefined;
            }>;
            id: import("drizzle-orm/pg-core").PgBuildColumn<"journal_events", import("drizzle-orm/pg-core").SetNotNull<import("drizzle-orm/pg-core").PgVarcharBuilder<[string, ...string[]]>>, {
                name: string;
                tableName: "journal_events";
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
            kind: import("drizzle-orm/pg-core").PgBuildColumn<"journal_events", import("drizzle-orm/pg-core").SetNotNull<import("drizzle-orm/pg-core").PgVarcharBuilder<[string, ...string[]]>>, {
                name: string;
                tableName: "journal_events";
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
            entityId: import("drizzle-orm/pg-core").PgBuildColumn<"journal_events", import("drizzle-orm/pg-core").SetNotNull<import("drizzle-orm/pg-core").PgVarcharBuilder<[string, ...string[]]>>, {
                name: string;
                tableName: "journal_events";
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
            version: import("drizzle-orm/pg-core").PgBuildColumn<"journal_events", import("drizzle-orm/pg-core").SetNotNull<import("drizzle-orm/pg-core").PgIntegerBuilder>, {
                name: string;
                tableName: "journal_events";
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
            type: import("drizzle-orm/pg-core").PgBuildColumn<"journal_events", import("drizzle-orm/pg-core").SetNotNull<import("drizzle-orm/pg-core").PgVarcharBuilder<[string, ...string[]]>>, {
                name: string;
                tableName: "journal_events";
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
            data: import("drizzle-orm/pg-core").PgBuildColumn<"journal_events", import("drizzle-orm/pg-core").SetNotNull<import("drizzle-orm/pg-core").PgJsonbBuilder>, {
                name: string;
                tableName: "journal_events";
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
            meta: import("drizzle-orm/pg-core").PgBuildColumn<"journal_events", import("drizzle-orm/pg-core").SetNotNull<import("drizzle-orm/pg-core").PgJsonbBuilder>, {
                name: string;
                tableName: "journal_events";
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
            recordedAt: import("drizzle-orm/pg-core").PgBuildColumn<"journal_events", import("drizzle-orm/pg-core").SetHasDefault<import("drizzle-orm/pg-core").SetNotNull<import("drizzle-orm/pg-core").PgTimestampBuilder>>, {
                name: string;
                tableName: "journal_events";
                dataType: "object date";
                data: Date;
                driverParam: string;
                notNull: true;
                hasDefault: true;
                isPrimaryKey: false;
                isAutoincrement: false;
                hasRuntimeDefault: false;
                enumValues: undefined;
                identity: undefined;
                generated: undefined;
            }>;
            commandId: import("drizzle-orm/pg-core").PgBuildColumn<"journal_events", import("drizzle-orm/pg-core").PgVarcharBuilder<[string, ...string[]]>, {
                name: string;
                tableName: "journal_events";
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
            causeSeq: import("drizzle-orm/pg-core").PgBuildColumn<"journal_events", import("drizzle-orm/pg-core").PgBigInt53Builder, {
                name: string;
                tableName: "journal_events";
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
            correlationId: import("drizzle-orm/pg-core").PgBuildColumn<"journal_events", import("drizzle-orm/pg-core").PgVarcharBuilder<[string, ...string[]]>, {
                name: string;
                tableName: "journal_events";
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
            erasedAt: import("drizzle-orm/pg-core").PgBuildColumn<"journal_events", import("drizzle-orm/pg-core").PgTimestampBuilder, {
                name: string;
                tableName: "journal_events";
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
            schemaVersion: import("drizzle-orm/pg-core").PgBuildColumn<"journal_events", import("drizzle-orm/pg-core").SetHasDefault<import("drizzle-orm/pg-core").SetNotNull<import("drizzle-orm/pg-core").PgIntegerBuilder>>, {
                name: string;
                tableName: "journal_events";
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
        }, "single", Record<"journal_events", "not-null">, false, "orderBy" | "where", {
            seq: number;
            id: string;
            kind: string;
            entityId: string;
            version: number;
            type: string;
            data: unknown;
            meta: unknown;
            recordedAt: Date;
            commandId: string | null;
            causeSeq: number | null;
            correlationId: string | null;
            erasedAt: Date | null;
            schemaVersion: number;
        }[], {
            seq: import("drizzle-orm/pg-core").PgBuildColumn<"journal_events", import("drizzle-orm/pg-core").SetIsPrimaryKey<import("drizzle-orm/pg-core").PgBigSerial53Builder>, {
                name: string;
                tableName: "journal_events";
                dataType: "number int53";
                data: number;
                driverParam: number;
                notNull: true;
                hasDefault: true;
                isPrimaryKey: false;
                isAutoincrement: false;
                hasRuntimeDefault: false;
                enumValues: undefined;
                identity: undefined;
                generated: undefined;
            }>;
            id: import("drizzle-orm/pg-core").PgBuildColumn<"journal_events", import("drizzle-orm/pg-core").SetNotNull<import("drizzle-orm/pg-core").PgVarcharBuilder<[string, ...string[]]>>, {
                name: string;
                tableName: "journal_events";
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
            kind: import("drizzle-orm/pg-core").PgBuildColumn<"journal_events", import("drizzle-orm/pg-core").SetNotNull<import("drizzle-orm/pg-core").PgVarcharBuilder<[string, ...string[]]>>, {
                name: string;
                tableName: "journal_events";
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
            entityId: import("drizzle-orm/pg-core").PgBuildColumn<"journal_events", import("drizzle-orm/pg-core").SetNotNull<import("drizzle-orm/pg-core").PgVarcharBuilder<[string, ...string[]]>>, {
                name: string;
                tableName: "journal_events";
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
            version: import("drizzle-orm/pg-core").PgBuildColumn<"journal_events", import("drizzle-orm/pg-core").SetNotNull<import("drizzle-orm/pg-core").PgIntegerBuilder>, {
                name: string;
                tableName: "journal_events";
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
            type: import("drizzle-orm/pg-core").PgBuildColumn<"journal_events", import("drizzle-orm/pg-core").SetNotNull<import("drizzle-orm/pg-core").PgVarcharBuilder<[string, ...string[]]>>, {
                name: string;
                tableName: "journal_events";
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
            data: import("drizzle-orm/pg-core").PgBuildColumn<"journal_events", import("drizzle-orm/pg-core").SetNotNull<import("drizzle-orm/pg-core").PgJsonbBuilder>, {
                name: string;
                tableName: "journal_events";
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
            meta: import("drizzle-orm/pg-core").PgBuildColumn<"journal_events", import("drizzle-orm/pg-core").SetNotNull<import("drizzle-orm/pg-core").PgJsonbBuilder>, {
                name: string;
                tableName: "journal_events";
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
            recordedAt: import("drizzle-orm/pg-core").PgBuildColumn<"journal_events", import("drizzle-orm/pg-core").SetHasDefault<import("drizzle-orm/pg-core").SetNotNull<import("drizzle-orm/pg-core").PgTimestampBuilder>>, {
                name: string;
                tableName: "journal_events";
                dataType: "object date";
                data: Date;
                driverParam: string;
                notNull: true;
                hasDefault: true;
                isPrimaryKey: false;
                isAutoincrement: false;
                hasRuntimeDefault: false;
                enumValues: undefined;
                identity: undefined;
                generated: undefined;
            }>;
            commandId: import("drizzle-orm/pg-core").PgBuildColumn<"journal_events", import("drizzle-orm/pg-core").PgVarcharBuilder<[string, ...string[]]>, {
                name: string;
                tableName: "journal_events";
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
            causeSeq: import("drizzle-orm/pg-core").PgBuildColumn<"journal_events", import("drizzle-orm/pg-core").PgBigInt53Builder, {
                name: string;
                tableName: "journal_events";
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
            correlationId: import("drizzle-orm/pg-core").PgBuildColumn<"journal_events", import("drizzle-orm/pg-core").PgVarcharBuilder<[string, ...string[]]>, {
                name: string;
                tableName: "journal_events";
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
            erasedAt: import("drizzle-orm/pg-core").PgBuildColumn<"journal_events", import("drizzle-orm/pg-core").PgTimestampBuilder, {
                name: string;
                tableName: "journal_events";
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
            schemaVersion: import("drizzle-orm/pg-core").PgBuildColumn<"journal_events", import("drizzle-orm/pg-core").SetHasDefault<import("drizzle-orm/pg-core").SetNotNull<import("drizzle-orm/pg-core").PgIntegerBuilder>>, {
                name: string;
                tableName: "journal_events";
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
        }>, "orderBy" | "where">;
    };
};
/** The built-in log, with the seq-range read only taps use. */
export type BuiltInEventLog = ReturnType<typeof createBuiltInEventLog>;
export {};
//# sourceMappingURL=store.d.ts.map