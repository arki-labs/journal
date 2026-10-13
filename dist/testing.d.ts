/**
 * Test helper: an in-memory PGlite with a schema pushed, the fixture every
 * journal test rebuilds by hand. `@electric-sql/pglite` and `drizzle-kit` are
 * optional peers. Import this module only from tests. This is the one file
 * that may import them.
 */
import { PGlite } from '@electric-sql/pglite';
/**
 * Open a fresh in-memory database with `schema` (the journal tables and the
 * app's tables) pushed. Returns the Drizzle database and the PGlite client;
 * call `client.close()` when the test file ends.
 */
export declare function openJournalDb(schema: Record<string, unknown>): Promise<{
    db: import("drizzle-orm/pglite").PgliteDatabase<import("drizzle-orm").EmptyRelations> & {
        $client: PGlite;
    };
    client: PGlite;
}>;
//# sourceMappingURL=testing.d.ts.map