import type { JournalTables } from '../pg.js';
import type { DbHandle } from '../types.js';
/** The results of a run with each event wait's pointer replaced by the event read from the log. Other results are as they were. */
export declare function withWaitEvents(db: DbHandle, tables: Pick<JournalTables, 'events'>, runId: string, nodes: readonly {
    readonly name: string;
    readonly kind: string;
}[], results: Readonly<Record<string, unknown>>): Promise<Readonly<Record<string, unknown>>>;
//# sourceMappingURL=wait-results.d.ts.map