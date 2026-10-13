/**
 * The entity row and stored values: load and save the row, exact-id checks, value
 * comparison, the JSON round-trip check, freezing, and the root-database guard.
 * Imports only leaf files (`types`, `errors`). Must not import `journal`, `api`,
 * `write`, `command`, `history` or `worker`.
 */
import type { z } from 'zod';
import type { AnyEntity, AnyEventDef, DbHandle, EntityDef, EntityId, EntityTable, ReducerRow, RootDb, Row } from './types.js';
/** A select row has every column of its table. The check is real; the guard narrows. */
export declare function isRowOf<Tbl extends EntityTable>(table: Tbl, value: object): value is Row<Tbl>;
type EntityRowSource = Pick<AnyEntity, 'table' | 'keyColumn'>;
export declare function loadRow(db: DbHandle, entity: EntityRowSource, id: string, lock: boolean): Promise<object | null>;
/**
 * With no row to compare against (a create and delete in one write, a replay of a missing row),
 * `assertStoredId` sees nothing, so the id is checked up front, before any database access: not
 * empty, within the key's length limit in code points (the column or the log would cut it), and,
 * for a `uuid` key, lower-case and hyphenated.
 */
export declare function assertExactId(entity: Pick<AnyEntity, 'kind' | 'uuidKey' | 'keyLimit'>, id: string): void;
export declare function assertStoredId(entity: Pick<AnyEntity, 'kind' | 'key'>, row: object | null, id: string): void;
/** Insert, update or delete the row so it matches `next`. Returns the stored row. */
export declare function saveReplayed<Tbl extends EntityTable, Key extends string>(db: DbHandle, entity: EntityDef<string, Tbl, AnyEventDef, unknown, Key>, id: EntityId<Tbl, Key>, current: object | null, next: ReducerRow<Tbl, Key> | null): Promise<Row<Tbl> | null>;
export declare function toRecord(value: object): Record<string, unknown>;
export declare function showValue(value: unknown): string;
/**
 * The row the database returned must hold, for each of `columns`, the value the reducers produced.
 * Replay recomputes from reducer output, so a value the database rounds, trims or alters would make
 * replay and the table drift apart. Uses the same comparison as `verify`.
 */
export declare function assertStoredValues(entity: Pick<AnyEntity, 'kind'>, id: string, produced: object, saved: object, columns: Iterable<string>): void;
/**
 * Freeze a plain object or array and everything inside it. A `Date` is frozen
 * itself; its internals are not touched. Anything else is left alone.
 */
export declare function deepFreeze<T>(value: T): T;
/**
 * Deep equality for stored rows: `verify` compares what replay produced with what the table holds.
 * Strict: primitives, `Date`, value objects, arrays and plain objects only. A value object is a class
 * instance with an `equals` method, such as a Temporal value from a custom column: it equals another
 * instance of the same class when its `equals` says so. A `Map`, `Set`, other class instance or typed
 * array is never equal to anything, because JSON storage would lose its contents.
 */
export declare function sameValue(a: unknown, b: unknown): boolean;
/**
 * Throws `UNSTABLE_SCHEMA` unless the value survives JSON storage and a second parse
 * unchanged. Replay depends on this. A value JSON cannot encode (a `bigint`, a cycle)
 * is the same failure, with the serializer's error as `cause`.
 */
export declare function assertRoundTrips(schema: z.ZodType, value: unknown, kind: string, id: string, what: string): void;
export declare function assertRootDb(db: RootDb, verb: string): void;
export {};
//# sourceMappingURL=storage.d.ts.map