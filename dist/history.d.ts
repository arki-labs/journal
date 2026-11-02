import type { SchemaFailure } from '@arki/failure';
import type { SchemaOutput, StandardSchemaV1 } from '@arki/schema';
import type { ForgetResult, ReplayResult, VerifyResult } from './api.js';
import type { EventLog, EventLogPosition, JoinedLog } from './event-log.js';
import type { JournalTables, StoredEventRow } from './pg.js';
import type { PgStore } from './store.js';
import type { AnyEventDef, DbHandle, EntityDef, EntityId, EntityTable, EventStorage, Projection, Recorded, Row, TransactionSource } from './types.js';
/** What the log functions need from the journal: the meta schema, the journal tables and its store. */
export type HistoryDeps<Meta extends StandardSchemaV1<unknown, Record<string, unknown>>> = {
    readonly metaSchema: Meta;
    readonly tables: JournalTables;
    /** Entity rows. `forget` still queries `tables` for the cursor lock and the job copies. */
    readonly store: PgStore;
    /** The built-in log: where `'stored'` events are. An entity with its own log reads that one. */
    readonly log: JoinedLog;
};
/**
 * Turns a stored log row into a recorded event, parsing data and meta with their current schemas. `id` is the row's
 * entity id as the caller types it. Workflows decode the events a wait takes with this too, so a wait reads an event as
 * replay and the worker read it.
 */
export declare function createEventDecoder<Meta extends StandardSchemaV1<unknown, Record<string, unknown>>>(metaSchema: Meta): <Id extends string>(row: StoredEventRow, def: AnyEventDef | undefined, id: Id) => Recorded<string, unknown, SchemaOutput<Meta>, Id> | SchemaFailure;
export declare function createHistory<Meta extends StandardSchemaV1<unknown, Record<string, unknown>>>(deps: HistoryDeps<Meta>): {
    decodeStoredEvent: <Id extends string>(row: StoredEventRow, def: AnyEventDef | undefined, id: Id) => SchemaFailure | Recorded<string, unknown, SchemaOutput<Meta>, Id>;
    assertLogSaysGone: <Tbl extends EntityTable, E extends AnyEventDef, Key extends string>(db: DbHandle, entity: EntityDef<string, Tbl, E, SchemaOutput<Meta>, Key>, id: EntityId<Tbl, Key>, latestLogVersion: number) => Promise<void | SchemaFailure>;
    replay: <Tbl extends EntityTable, E extends AnyEventDef, Key extends string>(db: DbHandle, entity: EntityDef<string, Tbl, E, SchemaOutput<Meta>, Key>, id: EntityId<Tbl, Key>, opts?: {
        readonly throughVersion?: number;
    }) => Promise<ReplayResult<Tbl, E, SchemaOutput<Meta>, Key> | SchemaFailure>;
    verify: <Tbl extends EntityTable, E extends AnyEventDef, Key extends string>(db: DbHandle, entity: EntityDef<string, Tbl, E, SchemaOutput<Meta>, Key>, id: EntityId<Tbl, Key>) => Promise<VerifyResult<Tbl, Key> | SchemaFailure>;
    repair: <Tbl extends EntityTable, E extends AnyEventDef, Key extends string>(db: DbHandle, entity: EntityDef<string, Tbl, E, SchemaOutput<Meta>, Key>, id: EntityId<Tbl, Key>) => Promise<Row<Tbl> | null | SchemaFailure>;
    forget: <Tbl extends EntityTable, E extends AnyEventDef, Key extends string>(db: DbHandle, entity: EntityDef<string, Tbl, E, SchemaOutput<Meta>, Key>, id: EntityId<Tbl, Key>) => Promise<ForgetResult<Tbl> | SchemaFailure>;
    rerun: <Tx extends TransactionSource<Tx>>(db: TransactionSource<Tx>, projection: Projection<SchemaOutput<Meta>, Tx>, opts?: {
        readonly after?: EventLogPosition | null;
        readonly batchSize?: number;
    }) => Promise<{
        readonly events: number;
    } | SchemaFailure>;
    copyLog: (db: DbHandle, entity: {
        readonly kind: string;
        readonly eventStorage: EventStorage;
    }, opts: {
        readonly to: 'stored' | EventLog;
        readonly batchSize?: number;
    }) => Promise<{
        readonly events: number;
    }>;
};
export type History<Meta extends StandardSchemaV1<unknown, Record<string, unknown>>> = ReturnType<typeof createHistory<Meta>>;
//# sourceMappingURL=history.d.ts.map