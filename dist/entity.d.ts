import type { AnyEventDef, EntityDef, EntityId, EntityTable, Patch, Recorded, RecordedOf, ReducerRow, ReducerValues, Row } from './types.js';
/**
 * The keys that every `.create` reducer so far returns with a type that
 * excludes `undefined`. `CreateResults` is the union of their return types, so a key
 * one of them leaves out, or may set to `undefined`, is not in the set. With
 * no `.create` yet, the set is empty.
 *
 * `keyof CreateResults & string` keeps the mapped type from distributing over the
 * union: `keyof (A | B)` is the keys both have, and `CreateResults[P]` is the union
 * of what each branch holds there. A create returning `cond ? { note } : {}`
 * therefore promises nothing.
 */
export type GuaranteedCreateKeys<CreateResults> = [CreateResults] extends [never] ? never : {
    [P in keyof CreateResults & string]: undefined extends CreateResults[P] ? never : P;
}[keyof CreateResults & string];
/**
 * The state an `.on` reducer receives: the reducer-shaped row, with the keys
 * every `.create` reducer sets made required. A patch cannot unset a key and
 * `undefined` values are stripped, so a key a create sets stays set.
 */
export type OnReducerRow<Tbl extends EntityTable, Key extends string, CreateResults> = ReducerRow<Tbl, Key> & Required<Pick<ReducerValues<Tbl, Key>, GuaranteedCreateKeys<CreateResults> & keyof ReducerValues<Tbl, Key>>>;
/**
 * An entity under construction. Each `.create` / `.on` adds the event to the
 * union the entity accepts, so `events` cannot return an undeclared event.
 * `CreateResults` collects what the `.create` reducers return; see `OnReducerRow`.
 *
 * The rule: every `.create` comes before the first `.on`. After the first
 * `.on` the builder is `OnOnlyEntityBuilder`, which has no `.create`: a later
 * create could leave out a column that `.on` was promised.
 */
export type EntityBuilder<Kind extends string, Tbl extends EntityTable, EventDefs extends AnyEventDef, Meta, Key extends string = 'id', CreateResults = never> = OnOnlyEntityBuilder<Kind, Tbl, EventDefs, Meta, Key, CreateResults> & {
    /** A create reducer receives no row. It builds the first row from the event. */
    create<AddedEvent extends AnyEventDef, CreateResult extends ReducerValues<Tbl, Key>>(event: AddedEvent, reduce: (event: RecordedOf<AddedEvent, Meta, EntityId<Tbl, Key>>) => CreateResult): EntityBuilder<Kind, Tbl, EventDefs | AddedEvent, Meta, Key, CreateResults | CreateResult>;
};
/** An entity after its first `.on`: only more `.on` reducers may follow. */
export type OnOnlyEntityBuilder<Kind extends string, Tbl extends EntityTable, EventDefs extends AnyEventDef, Meta, Key extends string = 'id', CreateResults = never> = EntityDef<Kind, Tbl, EventDefs, Meta, Key> & {
    /**
     * An `.on` reducer always receives the reducer-shaped state: the insert shape plus
     * the key column and `version`. Columns with database defaults may be absent unless
     * every `.create` reducer sets them. It returns a patch that is merged onto the
     * state. Returning `null` deletes the row; the events stay.
     */
    on<AddedEvent extends AnyEventDef>(event: AddedEvent, reduce: (row: OnReducerRow<Tbl, Key, CreateResults>, event: RecordedOf<AddedEvent, Meta, EntityId<Tbl, Key>>) => Patch<Tbl, Key> | null): OnOnlyEntityBuilder<Kind, Tbl, EventDefs | AddedEvent, Meta, Key, CreateResults>;
};
export declare function defineEntity<Kind extends string, Tbl extends EntityTable, Meta, Key extends string>(kind: Kind, table: Tbl, key: Key): EntityBuilder<Kind, Tbl, never, Meta, Key>;
/** The reducer-shaped row: a state plus the key column and `version`. */
export declare function withEntityIdentity<Tbl extends EntityTable, Key extends string>(entity: EntityDef<string, Tbl, AnyEventDef, unknown, Key>, state: Row<Tbl> | ReducerValues<Tbl, Key>, id: EntityId<Tbl, Key>, version: number): ReducerRow<Tbl, Key>;
/**
 * Fold one event onto the in-memory state. Shared by write and replay, so
 * both produce the same value for every column a reducer set. The caller has
 * checked that a reducer exists for the event in this state. `reducerColumns`, when
 * given, collects the columns the reducers set: a create starts it afresh, a
 * patch adds its keys, a delete empties it.
 */
export declare function reduceOne<Tbl extends EntityTable, Meta, Key extends string>(entity: EntityDef<string, Tbl, AnyEventDef, Meta, Key>, state: Row<Tbl> | ReducerValues<Tbl, Key> | null, id: EntityId<Tbl, Key>, event: Recorded<string, unknown, Meta>, reducerColumns?: Set<string>): ReducerValues<Tbl, Key> | null;
//# sourceMappingURL=entity.d.ts.map