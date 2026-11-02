import type { ResponseCache } from '@arki/http/idempotency';
import type { JournalTables } from './pg.js';
import type { DbHandle } from './types.js';
/**
 * A response cache on the root database. Unresolved reservations never expire. Only a completed,
 * expired replay can be taken over; finish atomically checks ownership and starts retention.
 */
export declare function responseCache(db: DbHandle, tables: Pick<JournalTables, 'receipts'>): ResponseCache;
//# sourceMappingURL=http.d.ts.map