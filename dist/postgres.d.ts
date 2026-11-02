import type { ForwardedLog } from './event-log.js';
import type { EventLogTables } from './pg.js';
import type { DbHandle } from './types.js';
/**
 * Events here are appended by many workers at once, and the app's seq is stamped before the
 * append, so neither seq nor commit time is an order a reader can follow safely. The order is
 * `(transaction_id, seq)`, read only below the oldest transaction still open (the snapshot's
 * `xmin`). Every transaction below it has ended, and every later one gets a higher id, so no row
 * can ever commit behind what a read returned. Cost: one long transaction anywhere on that Postgres
 * server holds async projections back until it ends.
 */
export declare function postgresEvents(deps: {
    readonly db: DbHandle;
    readonly tables: EventLogTables;
}): ForwardedLog;
//# sourceMappingURL=postgres.d.ts.map