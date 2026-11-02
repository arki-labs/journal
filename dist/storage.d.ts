import type { SchemaFailure } from '@arki/failure';
import type { StandardSchemaV1 } from '@arki/schema';
import type { AnyEntity, EntityTable, RootDb, Row } from './types.js';
/** A select row has every column of its table. The check is real; the guard narrows. */
export declare function isRowOf<Tbl extends EntityTable>(table: Tbl, value: object): value is Row<Tbl>;
/**
 * With no row to compare against (a create and delete in one write, a replay of a missing row),
 * `assertStoredId` sees nothing, so the id is checked up front, before any database access: not
 * empty, within the key's length limit in code points (the column or the log would cut it), and,
 * for a `uuid` key, lower-case and hyphenated.
 */
export declare function assertExactId(entity: Pick<AnyEntity, 'kind' | 'uuidKey' | 'keyLimit'>, id: string): void;
export declare function assertStoredId(entity: Pick<AnyEntity, 'kind' | 'key'>, row: object | null, id: string): void;
export declare function toRecord(value: object): Record<string, unknown>;
export declare function showValue(value: unknown): string;
/**
 * The row the database returned must hold, for each of `columns`, the value the reducers produced.
 * Replay recomputes from reducer output, so a value the database rounds, trims or alters would make
 * replay and the table drift apart. Uses the same comparison as `verify`.
 */
export declare function assertStoredValues(entity: Pick<AnyEntity, 'kind'>, id: string, produced: object, saved: object, columns: Iterable<string>): void;
/** An object literal shape: prototype `Object.prototype` or `null`. A `Set`, `Map`, `Date` or class instance is not one. */
export declare function isPlainObject(value: unknown): value is Record<string, unknown>;
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
 * Sync parse that reports bad data instead of throwing it: replay and the round-trip
 * check branch on the result. Invalid input carries issues; async schemas and validator
 * defects remain canonical schema failures for the caller to propagate.
 */
export declare function safeParse<Output>(schema: StandardSchemaV1<unknown, Output>, value: unknown): {
    readonly success: true;
    readonly data: Output;
} | {
    readonly success: false;
    readonly error: SchemaFailure;
};
/**
 * Throws `UNSTABLE_SCHEMA` unless the value survives JSON storage and a second parse
 * unchanged. Replay depends on this. A value JSON cannot encode (a `bigint`, a cycle)
 * is the same failure, with the serializer's error as `cause`.
 */
export declare function assertRoundTrips(schema: StandardSchemaV1, value: unknown, kind: string, id: string, what: string): void | SchemaFailure;
export declare function assertRootDb(db: RootDb, verb: string): void;
//# sourceMappingURL=storage.d.ts.map