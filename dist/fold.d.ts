/**
 * The fold that write and replay share: apply recorded events to a row in memory.
 * Also the two lookups by event type. Pure functions: no database access, no state.
 * May import `entity` and leaf files. Must not import `journal`, `api`, `write`,
 * `command`, `history`, `storage` or `worker`.
 */
import type { AnyEntity, AnyEventDef, EntityDef, EntityId, EntityTable, Recorded, RecordedOf, ReducerRow, Row } from './types.js';
type RecordedEvent<MetaOut> = Recorded<string, unknown, MetaOut>;
export declare const findEventDefinition: <MetaOut>(entities: readonly AnyEntity<MetaOut>[], kind: string, type: string) => AnyEventDef | undefined;
/**
 * Fold events onto a starting state. A create event on a row, or a non-create
 * event with no row, is `ROW_EXISTS` / `NO_ROW` during a write and
 * `REPLAY_FAILED` when reading the log back. `recreated` is true when the state
 * passed through `null` and ended non-null: the row is a new incarnation.
 */
export declare const fold: <Tbl extends EntityTable, Key extends string, MetaOut>(entity: EntityDef<string, Tbl, AnyEventDef, MetaOut, Key>, start: Row<Tbl> | null, id: EntityId<Tbl, Key>, history: readonly RecordedEvent<MetaOut>[], mode: 'write' | 'replay') => {
    readonly row: ReducerRow<Tbl, Key> | null;
    readonly recreated: boolean;
    /** The columns the reducers set in this fold (since the last create). */
    readonly reducerColumns: ReadonlySet<string>;
};
/**
 * Narrows a decoded event to the entity's own event union. It is a type guard, not
 * a filter for bad data: `decodeStoredEvent` has already thrown for a type the
 * entity does not declare. Do not use it to skip stored events that fail to decode.
 */
export declare const hasDeclaredEventType: <E extends AnyEventDef, Id extends string, MetaOut>(entity: EntityDef<string, EntityTable, E, MetaOut, string>, event: Recorded<string, unknown, MetaOut, Id>) => event is RecordedOf<E, MetaOut, Id>;
export {};
//# sourceMappingURL=fold.d.ts.map