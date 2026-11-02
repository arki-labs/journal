import type { IdGenerationFailure } from '@arki/contracts';
import type { Failure, SchemaFailure } from '@arki/failure';
import type { SchemaInput, SchemaOutput, StandardSchemaV1 } from '@arki/schema';
import type { CommandContext, NextEvents, WriteInput, WriteResult } from './api.js';
import type { JoinedLog } from './event-log.js';
import type { History } from './history.js';
import type { PgStore } from './store.js';
import type { AnyEventDef, BivariantFn, Effect, EntityDef, EntityId, EntityTable, PendingOf, Projection, Recorded, Trace, TransactionSource } from './types.js';
/** Insert order is the version order. `RETURNING` does not promise it, so restore it. */
export declare function sortedByVersion<Row extends {
    readonly version: number;
}>(rows: readonly Row[]): Row[];
/**
 * A `with-event` `startOn`: a run that starts in the transaction of the event. `start` writes through `host`, which is
 * the write's savepoint and this same write path, so the run, its first node and that node's job roll back with the
 * event. No body runs here. `meta` is what the run's events record, the app's `workflowMeta`, as for an `after-commit`
 * start. A failure `start` returns refuses the write; anything else it cannot do, it throws.
 */
export type EventStart<MetaIn, MetaOut, Tx extends TransactionSource<Tx>> = {
    readonly kind: string;
    readonly type: string;
    readonly meta: MetaIn;
    readonly start: BivariantFn<[
        host: Pick<CommandContext<MetaOut, Tx>, 'tx' | 'write'>,
        event: Recorded<string, unknown, MetaOut>
    ], Promise<SchemaFailure | undefined>>;
};
/** What a write needs from the journal. */
export type WriteDeps<Meta extends StandardSchemaV1<unknown, Record<string, unknown>>, Tx extends TransactionSource<Tx>> = {
    readonly metaSchema: Meta;
    /** Rows, the write order, jobs and the wake signal. A unique violation comes back from it as `CONFLICT`. */
    readonly store: PgStore;
    /** The built-in log: where `'stored'` events go, bound to the write's savepoint. */
    readonly log: JoinedLog;
    /** Inline projections only: they run inside the write. */
    readonly projections: readonly Projection<SchemaOutput<Meta>, Tx>[];
    /** Async projections: the write only wakes the worker when a recorded event matches one. */
    readonly asyncProjections: readonly Pick<Projection, 'types' | 'entities'>[];
    /** A write only queues one job per matching effect. It never runs an effect, so the effect's database type does not matter here. */
    readonly effects: readonly Pick<Effect<SchemaOutput<Meta>>, 'name' | 'types' | 'entities' | 'schedule'>[];
    /** The `with-event` `startOn`s: they run inside the write, right after the inline projections. */
    readonly eventStarts: readonly EventStart<SchemaInput<Meta>, SchemaOutput<Meta>, Tx>[];
    readonly history: Pick<History<Meta>, 'decodeStoredEvent' | 'assertLogSaysGone'>;
};
export declare function createWriter<Meta extends StandardSchemaV1<unknown, Record<string, unknown>>, Tx extends TransactionSource<Tx>>(deps: WriteDeps<Meta, Tx>): {
    write: <Tbl extends EntityTable, E extends AnyEventDef, Key extends string, Returned extends readonly (PendingOf<E> | SchemaFailure)[] | Failure>(tx: Tx, entity: EntityDef<string, Tbl, E, SchemaOutput<Meta>, Key>, id: EntityId<Tbl, Key>, input: WriteInput<Tbl, E, Meta, Tx, Returned>) => Promise<WriteResult<Tbl, E, SchemaOutput<Meta>, Key> | Extract<Returned, Failure> | SchemaFailure | IdGenerationFailure>;
    adopt: <Tbl extends EntityTable, E extends AnyEventDef, Key extends string>(tx: Tx, entity: EntityDef<string, Tbl, E, SchemaOutput<Meta>, Key>, id: EntityId<Tbl, Key>, input: WriteInput<Tbl, E, Meta, Tx>) => Promise<WriteResult<Tbl, E, SchemaOutput<Meta>, Key> | SchemaFailure | IdGenerationFailure>;
    writeWithValidatedMeta: <Tbl extends EntityTable, E extends AnyEventDef, Key extends string, Returned extends readonly (PendingOf<E> | SchemaFailure)[] | Failure>(tx: Tx, entity: EntityDef<string, Tbl, E, SchemaOutput<Meta>, Key>, id: EntityId<Tbl, Key>, getValidatedMeta: () => SchemaOutput<Meta> | SchemaFailure, events: NextEvents<Tbl, E, Tx, Returned>, trace: Trace, onJobs?: (count: number) => void, opts?: {
        readonly mode?: 'write' | 'adopt';
        readonly expectedVersion?: number;
        /** Sees each event `events` returned, before any is stored. A throw refuses the write. */
        readonly beforeEvent?: (event: PendingOf<E>) => void;
    }) => Promise<WriteResult<Tbl, E, SchemaOutput<Meta>, Key> | Extract<Returned, Failure> | SchemaFailure | IdGenerationFailure>;
};
export type Writer<Meta extends StandardSchemaV1<unknown, Record<string, unknown>>, Tx extends TransactionSource<Tx>> = ReturnType<typeof createWriter<Meta, Tx>>;
//# sourceMappingURL=write.d.ts.map