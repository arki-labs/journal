/** The log as seen on `db`: bound to it when the log joins transactions. */
export const logOn = (log, db) => log.canJoinTransaction ? log.bind(db) : log;
/** The log's global order. Async projections and `rerun` walk it; a log without one cannot serve them. */
export function globalOrderOf(log, what) {
    if (log.all === undefined)
        throw new Error(`journal: ${what} needs an event log with a global order`);
    return log.all;
}
export function routeOf(storage, builtIn) {
    if (storage === 'transient')
        return { mode: 'transient' };
    if (storage === 'stored')
        return { mode: 'joined', log: builtIn };
    return storage.canJoinTransaction ? { mode: 'joined', log: storage } : { mode: 'forwarded', log: storage };
}
/** A forwarded entity's job stream: its forward jobs run one after another, in version order. */
export const streamOf = (kind, entityId) => `${kind}/${entityId}`;
//# sourceMappingURL=event-log.js.map