import { reduceOne, withEntityIdentity } from './entity.js';
import { JournalError } from './errors.js';
export const findEventDefinition = (entities, kind, type) => entities.find(entity => entity.kind === kind)?.events.get(type);
/**
 * Fold events onto a starting state. A create event on a row, or a non-create
 * event with no row, is `ROW_EXISTS` / `NO_ROW` during a write and
 * `REPLAY_FAILED` when reading the log back. `recreated` is true when the state
 * passed through `null` and ended non-null: the row is a new incarnation.
 */
export const fold = (entity, start, id, history, mode) => {
    let state = start;
    let deleted = false;
    const reducerColumns = new Set();
    for (const event of history) {
        const reducers = entity.reducers.get(event.type);
        // A write names the exact refusal. A replay reports each one as REPLAY_FAILED and says why.
        const at = `event "${event.type}" at version ${event.version}`;
        if (reducers === undefined) {
            throw mode === 'write'
                ? new JournalError('UNKNOWN_EVENT', entity.kind, id, at)
                : new JournalError('REPLAY_FAILED', entity.kind, id, `${at} has no reducer on this entity`);
        }
        if (state !== null && reducers.on === undefined) {
            throw mode === 'write'
                ? new JournalError('ROW_EXISTS', entity.kind, id, at)
                : new JournalError('REPLAY_FAILED', entity.kind, id, `${at} has no .on reducer, but the history has a row at that point`);
        }
        if (state === null && reducers.create === undefined) {
            throw mode === 'write'
                ? new JournalError('NO_ROW', entity.kind, id, at)
                : new JournalError('REPLAY_FAILED', entity.kind, id, `${at} has no .create reducer, but the history has no row at that point`);
        }
        state = reduceOne(entity, state, id, event, reducerColumns);
        if (state === null)
            deleted = true;
    }
    if (state === null)
        return { row: null, recreated: false, reducerColumns };
    const last = history.at(-1);
    const version = last === undefined ? (start === null ? 0 : start.version) : last.version;
    return { row: withEntityIdentity(entity, state, id, version), recreated: deleted, reducerColumns };
};
/**
 * Narrows a decoded event to the entity's own event union. It is a type guard, not
 * a filter for bad data: `decodeStoredEvent` has already thrown for a type the
 * entity does not declare. Do not use it to skip stored events that fail to decode.
 */
export const hasDeclaredEventType = (entity, event) => entity.events.has(event.type);
//# sourceMappingURL=fold.js.map