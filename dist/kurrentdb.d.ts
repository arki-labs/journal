/**
 * `kurrentEvents`: an event log in KurrentDB (formerly EventStoreDB). It shares no transaction with
 * the app database, so its entities are forwarded: the write commits the row and a `forward` job,
 * and the worker appends the events here afterwards. One entity is one stream, `<kind>-<entityId>`
 * (with `prefix` in front), so KurrentDB's `$ce-<kind>` category streams group a kind.
 */
import type { KurrentDBClient } from '@kurrent/kurrentdb-client';
import type { ForwardedLog } from './event-log.js';
/**
 * Appends use the stream's expected revision, so one batch is all or nothing and a rival write is
 * refused. `$all` is KurrentDB's commit order, so it is the global order as it is. No `erase`:
 * KurrentDB cannot rewrite an event in place, so `forget` is refused on its entities.
 * `prefix` puts this log's streams under one name, for several apps or tests on one cluster.
 */
export declare function kurrentEvents(deps: {
    readonly client: KurrentDBClient;
    readonly prefix?: string;
}): ForwardedLog;
//# sourceMappingURL=kurrentdb.d.ts.map