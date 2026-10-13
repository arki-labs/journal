/**
 * The write path: the write algorithm, version ordering of inserted events, and
 * telling an append conflict from other database errors.
 * May import `api`, `fold`, `history`, `storage`, `transaction-guard` and leaf files.
 * Must not import `journal`, `command` or `worker`.
 */
import type { z } from 'zod';
import type { NextEvents, WriteInput, WriteResult } from './api.js';
import type { History } from './history.js';
import type { JournalTables } from './pg.js';
import type { AnyEventDef, Effect, EntityDef, EntityId, EntityTable, Projection, Trace, TransactionSource } from './types.js';
/** Insert order is the version order. `RETURNING` does not promise it, so restore it. */
export declare function sortedByVersion<Row extends {
    readonly version: number;
}>(rows: readonly Row[]): Row[];
/** What a write needs from the journal. */
export type WriteDeps<Meta extends z.ZodObject, Tx extends TransactionSource<Tx>> = {
    readonly metaSchema: Meta;
    readonly tables: JournalTables;
    /** Inline projections only: they run inside the write. */
    readonly projections: readonly Projection<z.output<Meta>, Tx>[];
    /** Async projections: the write only wakes the worker when a recorded event matches one. */
    readonly asyncProjections: readonly Pick<Projection, 'types' | 'entities'>[];
    /** A write only queues one job per matching effect. It never runs an effect, so the effect's database type does not matter here. */
    readonly effects: readonly Pick<Effect<z.output<Meta>>, 'name' | 'types' | 'entities' | 'schedule'>[];
    readonly history: Pick<History<Meta>, 'decodeStoredEvent' | 'highestVersion' | 'assertLogSaysGone'>;
    /** Notified at commit with the seq range of every nonempty append. */
    readonly wakeChannel: string;
};
export declare function createWriter<Meta extends z.ZodObject, Tx extends TransactionSource<Tx>>(deps: WriteDeps<Meta, Tx>): {
    write: <Tbl extends EntityTable, E extends AnyEventDef, Key extends string>(tx: Tx, entity: EntityDef<string, Tbl, E, z.output<Meta>, Key>, id: EntityId<Tbl, Key>, input: WriteInput<Tbl, E, Meta, Tx>) => Promise<WriteResult<Tbl, E, z.output<Meta>, Key>>;
    adopt: <Tbl extends EntityTable, E extends AnyEventDef, Key extends string>(tx: Tx, entity: EntityDef<string, Tbl, E, z.output<Meta>, Key>, id: EntityId<Tbl, Key>, input: WriteInput<Tbl, E, Meta, Tx>) => Promise<WriteResult<Tbl, E, z.output<Meta>, Key>>;
    writeWithValidatedMeta: <Tbl extends EntityTable, E extends AnyEventDef, Key extends string>(tx: Tx, entity: EntityDef<string, Tbl, E, z.output<Meta>, Key>, id: EntityId<Tbl, Key>, getValidatedMeta: () => z.output<Meta>, events: NextEvents<Tbl, E, Tx>, trace: Trace, onJobs?: (count: number) => void, opts?: {
        readonly mode?: 'write' | 'adopt';
        readonly expectedVersion?: number;
    }) => Promise<WriteResult<Tbl, E, z.output<Meta>, Key>>;
};
export type Writer<Meta extends z.ZodObject, Tx extends TransactionSource<Tx>> = ReturnType<typeof createWriter<Meta, Tx>>;
//# sourceMappingURL=write.d.ts.map