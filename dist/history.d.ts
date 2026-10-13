/**
 * Reading the log: decoding stored events, the log queries, history-completeness
 * checks, and `replay`, `verify`, `repair`, `rerun`.
 * May import `fold`, `storage`, leaf files, and result types from `api`.
 * Must not import `journal`, `write`, `command` or `worker`.
 */
import type { z } from 'zod';
import type { ForgetResult, ReplayResult, VerifyResult } from './api.js';
import type { JournalTables } from './pg.js';
import type { AnyEventDef, DbHandle, EntityDef, EntityId, EntityTable, Projection, Recorded, Row, TransactionSource } from './types.js';
/** What the log functions need from the journal: the meta schema and the journal tables. */
export type HistoryDeps<Meta extends z.ZodObject> = {
    readonly metaSchema: Meta;
    readonly tables: JournalTables;
};
export declare function createHistory<Meta extends z.ZodObject>(deps: HistoryDeps<Meta>): {
    decodeStoredEvent: <Id extends string>(row: {
        causeSeq: number | null;
        commandId: string | null;
        correlationId: string | null;
        data: unknown;
        entityId: string;
        erasedAt: Date | null;
        id: string;
        kind: string;
        meta: unknown;
        recordedAt: Date;
        schemaVersion: number;
        seq: number;
        type: string;
        version: number;
    }, def: AnyEventDef | undefined, id: Id) => Recorded<string, unknown, z.output<Meta>, Id>;
    highestVersion: (db: DbHandle, kind: string, id: string) => Promise<number>;
    assertLogSaysGone: <Tbl extends EntityTable, E extends AnyEventDef, Key extends string>(db: DbHandle, entity: EntityDef<string, Tbl, E, z.output<Meta>, Key>, id: EntityId<Tbl, Key>, latestLogVersion: number) => Promise<void>;
    replay: <Tbl extends EntityTable, E extends AnyEventDef, Key extends string>(db: DbHandle, entity: EntityDef<string, Tbl, E, z.output<Meta>, Key>, id: EntityId<Tbl, Key>, opts?: {
        readonly throughVersion?: number;
    }) => Promise<ReplayResult<Tbl, E, z.output<Meta>, Key>>;
    verify: <Tbl extends EntityTable, E extends AnyEventDef, Key extends string>(db: DbHandle, entity: EntityDef<string, Tbl, E, z.output<Meta>, Key>, id: EntityId<Tbl, Key>) => Promise<VerifyResult<Tbl, Key>>;
    repair: <Tbl extends EntityTable, E extends AnyEventDef, Key extends string>(db: DbHandle, entity: EntityDef<string, Tbl, E, z.output<Meta>, Key>, id: EntityId<Tbl, Key>) => Promise<Row<Tbl> | null>;
    forget: <Tbl extends EntityTable, E extends AnyEventDef, Key extends string>(db: DbHandle, entity: EntityDef<string, Tbl, E, z.output<Meta>, Key>, id: EntityId<Tbl, Key>) => Promise<ForgetResult<Tbl>>;
    rerun: <Tx extends TransactionSource<Tx>>(db: TransactionSource<Tx>, projection: Projection<z.output<Meta>, Tx>, opts?: {
        readonly afterSeq?: number;
        readonly batchSize?: number;
    }) => Promise<{
        readonly events: number;
    }>;
};
export type History<Meta extends z.ZodObject> = ReturnType<typeof createHistory<Meta>>;
//# sourceMappingURL=history.d.ts.map