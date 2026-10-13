import { getTableColumns, getTableName } from 'drizzle-orm';
import { getTableConfig, PgColumn } from 'drizzle-orm/pg-core';
import { JournalError } from './errors.js';
import { assertStoredName } from './id.js';
/** The two facts `KeyColumn` states: the column holds a string and is not null. */
function isKeyColumn(column) {
    const [dataType] = column.dataType.split(' ');
    return dataType === 'string' && column.notNull;
}
/**
 * The supported key types: `text`, `varchar`, `varchar(n)` and `uuid`. The first three compare
 * as exact strings. A `uuid` ignores case, so its ids must also use the canonical spelling
 * (lower-case, hyphenated); `assertExactId` checks that on every call.
 */
const EXACT_KEY_TYPE = /^(?:text|uuid|varchar(?:\s*\(\s*\d+\s*\))?)$/;
/** A column's SQL type in comparable form: trimmed and lower-case. */
function sqlTypeOf(column) {
    return column.getSQLType().trim().toLowerCase();
}
/** The journal's own limit: `journal_events.entity_id` holds 256 characters. */
const LOG_KEY_LIMIT = 256;
/**
 * The longest id the key may hold, in code points: `varchar(n)` allows `min(n, 256)`, `text` and
 * `varchar` allow the log's 256, and a `uuid` is fixed at 36.
 */
function keyLimitOf(column) {
    const sqlType = sqlTypeOf(column);
    if (sqlType === 'uuid')
        return { max: 36, source: 'column' };
    const length = /\(\s*(\d+)\s*\)/.exec(sqlType)?.[1];
    if (length !== undefined && Number(length) <= LOG_KEY_LIMIT)
        return { max: Number(length), source: 'column' };
    return { max: LOG_KEY_LIMIT, source: 'journal' };
}
/**
 * Whether `column` identifies one row on its own: it is the primary key, or
 * carries a unique constraint, or is the only column of a table-level primary
 * key, unique constraint or unique index. Table-level constraints and indexes
 * hold their own column objects (an index wraps them), so they are matched by
 * SQL name; an SQL expression in an index has no name and never matches.
 */
function isUniqueOn(table, column) {
    if (column.primary || column.isUnique)
        return true;
    const only = (columns) => {
        const [first] = columns;
        return (columns.length === 1 &&
            typeof first === 'object' &&
            first !== null &&
            'name' in first &&
            first.name === column.name);
    };
    const config = getTableConfig(table);
    return (config.primaryKeys.some(pk => only(pk.columns)) ||
        config.uniqueConstraints.some(constraint => only(constraint.columns)) ||
        // A unique index with a `where` is unique only inside that subset, so it is no key.
        config.indexes.some(index => index.config.unique && index.config.where === undefined && only(index.config.columns)));
}
/** The column `table` holds under `key`, checked to be a usable entity key. */
function keyColumnOf(kind, table, key) {
    const columns = getTableColumns(table);
    const column = columns[key];
    if (!(column instanceof PgColumn)) {
        throw new JournalError('BAD_DEFINITION', 'entity', kind, `journal: entity "${kind}": table "${getTableName(table)}" has no column "${key}"`);
    }
    const [dataType] = column.dataType.split(' ');
    const sqlType = sqlTypeOf(column);
    if (dataType !== 'custom' && !isKeyColumn(column)) {
        throw new JournalError('BAD_DEFINITION', 'entity', kind, dataType === 'string'
            ? `journal: entity "${kind}": key column "${key}" must be not null`
            : `journal: entity "${kind}": key column "${key}" must hold a string, it holds ${column.dataType}`);
    }
    if (!EXACT_KEY_TYPE.test(sqlType)) {
        throw new JournalError('BAD_DEFINITION', 'entity', kind, `journal: entity "${kind}": key column "${key}" has SQL type "${sqlType}"; the key must be text, varchar or uuid, because other types can treat two different strings as the same key`);
    }
    if (!isKeyColumn(column)) {
        throw new JournalError('BAD_DEFINITION', 'entity', kind, `journal: entity "${kind}": key column "${key}" is a custom column type; a key must be a plain text, varchar or uuid column, because a custom type's mapping can change the string`);
    }
    if (!isUniqueOn(table, column)) {
        throw new JournalError('BAD_DEFINITION', 'entity', kind, `journal: entity "${kind}": key column "${key}" must be the primary key or carry a unique constraint`);
    }
    return column;
}
export function defineEntity(kind, table, key) {
    assertStoredName('entity kind', kind);
    const keyColumn = keyColumnOf(kind, table, key);
    const uuidKey = sqlTypeOf(keyColumn) === 'uuid';
    const keyLimit = keyLimitOf(keyColumn);
    return builder(kind, table, key, keyColumn, uuidKey, keyLimit, new Map(), new Map(), null);
}
function builder(kind, table, key, keyColumn, uuidKey, keyLimit, events, reducers, 
/** The first `.on` event type, once one is declared. `.create` is refused after it. */
firstOn) {
    const declare = (event, next, sealedBy) => builder(kind, table, key, keyColumn, uuidKey, keyLimit, new Map([...events, [event.type, event]]), new Map([...reducers, [event.type, next]]), sealedBy);
    const create = (event, reduce) => {
        if (firstOn !== null) {
            throw new JournalError('BAD_DEFINITION', 'entity', kind, `journal: entity "${kind}": declare .create(${event.type}) before any .on; .on(${firstOn}) came first`);
        }
        const current = reducers.get(event.type) ?? {};
        if (current.create !== undefined) {
            throw new JournalError('BAD_DEFINITION', 'entity', kind, `journal: entity "${kind}" already declares a create reducer for "${event.type}"`);
        }
        return declare(event, { ...current, create: reduce }, null);
    };
    const on = (event, reduce) => {
        const current = reducers.get(event.type) ?? {};
        if (current.on !== undefined) {
            throw new JournalError('BAD_DEFINITION', 'entity', kind, `journal: entity "${kind}" already declares an on reducer for "${event.type}"`);
        }
        return declare(event, { ...current, on: reduce }, firstOn ?? event.type);
    };
    return { kind, table, key, keyColumn, uuidKey, keyLimit, events, reducers, create, on };
}
/**
 * A copy of `value` without the own keys that hold `undefined`. In a patch,
 * `undefined` means "unchanged". In a create result it means "not set": the
 * database default applies, and the key is not part of the journal's state.
 */
function definedOnly(value) {
    const out = { ...value };
    for (const key in out) {
        if (Object.hasOwn(out, key) && out[key] === undefined)
            delete out[key];
    }
    return out;
}
function hasKey(value, key) {
    return key in value;
}
/**
 * `{ [key]: id }` typed by the key. TypeScript types a computed key as an
 * index signature; the guard above narrows it back to the one key.
 */
function keyed(key, id) {
    const out = { [key]: id };
    if (!hasKey(out, key))
        throw new Error(`journal: key "${key}" was not set`);
    return out;
}
/** The reducer-shaped row: a state plus the key column and `version`. */
export function withEntityIdentity(entity, state, id, version) {
    return { ...state, ...keyed(entity.key, id), version };
}
/**
 * Fold one event onto the in-memory state. Shared by write and replay, so
 * both produce the same value for every column a reducer set. The caller has
 * checked that a reducer exists for the event in this state. `reducerColumns`, when
 * given, collects the columns the reducers set: a create starts it afresh, a
 * patch adds its keys, a delete empties it.
 */
export function reduceOne(entity, state, id, event, reducerColumns) {
    const reducers = entity.reducers.get(event.type);
    if (state === null) {
        if (reducers?.create === undefined)
            throw new Error(`journal: entity "${entity.kind}" has no create reducer for "${event.type}"`);
        const created = definedOnly(reducers.create(event));
        reducerColumns?.clear();
        for (const key of Object.keys(created))
            reducerColumns?.add(key);
        return created;
    }
    if (reducers?.on === undefined)
        throw new Error(`journal: entity "${entity.kind}" has no on reducer for "${event.type}"`);
    const patch = reducers.on(withEntityIdentity(entity, state, id, event.version - 1), event);
    if (patch === null) {
        reducerColumns?.clear();
        return null;
    }
    const defined = definedOnly(patch);
    for (const key of Object.keys(defined))
        reducerColumns?.add(key);
    return { ...state, ...defined };
}
//# sourceMappingURL=entity.js.map