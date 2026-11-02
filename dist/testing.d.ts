/**
 * Test helper: an in-memory PGlite with a schema pushed, the fixture every
 * journal test rebuilds by hand. `@electric-sql/pglite` and `drizzle-kit` are
 * optional peers. Import this module only from tests. This is the one file
 * that may import them.
 */
import type { IdGenerationFailure } from '@arki/contracts';
import { PGlite } from '@electric-sql/pglite';
import type { JournalTables } from './pg.js';
import type { RetentionAge } from './retention.js';
import type { RootDb } from './types.js';
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
/** The database the harness opens when it is given none: the one `openJournalDb` returns. */
type PgliteDb = Awaited<ReturnType<typeof openJournalDb>>['db'];
/** What the harness needs from `setup`'s return: the journal tables, and the composed journal it drains. */
type HarnessRuntime<Db> = {
    readonly tables: JournalTables;
    readonly journal: {
        readonly drain: (db: Db, opts?: {
            readonly batchSize?: number;
        }) => Promise<number | IdGenerationFailure>;
    };
};
/**
 * The harness's own members, on `db`. `runtime` gives the newest runtime (`crash` replaces it), `crash` is the restart
 * `workflowHarness` wires up, and `close` ends the database it opened, if it opened one.
 */
declare function harnessMembers<Db extends RootDb>(db: Db, runtime: () => HarnessRuntime<Db>, crash: () => void, close: () => Promise<void>): {
    /** The database. It survives `crash()`. */
    db: Db;
    /**
     * Moves time forward by `age` (seconds, or `'30m'`, `'1h'`, `'2d'`): every stored time that the worker or the
     * sweeper compares with now moves back by that much. Timers, retries, leases, deadlines and retention come due.
     */
    tick: (age: RetentionAge) => Promise<void>;
    /**
     * Moves time forward to `at`, read from a row `tick` moves, such as a run's `wakeAt`: read it again after a tick. A
     * time that has passed moves nothing.
     */
    tickTo: (at: Date) => Promise<void>;
    /** The effect jobs a worker could claim now, in the order it would claim them. */
    dueJobs: () => Promise<{
        id: string;
        effect: string | null;
        type: string;
        runId: string | null;
    }[]>;
    /**
     * Runs exactly one due job, the first `pick` chooses, and no other: what a worker that is ahead of the rest does.
     * The job's own follow-up jobs stay due. Returns the job, or the failure the drain returned. Throws when none fits.
     */
    release: (pick: (job: Awaited<ReturnType<() => Promise<{
        id: string;
        effect: string | null;
        type: string;
        runId: string | null;
    }[]>>>[number]) => boolean) => Promise<{
        id: string;
        effect: string | null;
        type: string;
        runId: string | null;
    } | IdGenerationFailure>;
    /**
     * Runs the worker of the newest runtime until no job is due. Returns how many jobs it ran, or the failure a drain
     * returned. Throws when jobs are still due after 1000 drains.
     */
    drain: () => Promise<number | IdGenerationFailure>;
    /**
     * A process restart: the database keeps every row, and `setup` runs again, so the journal, its hooks and the
     * definitions are new. Read them from the harness after the crash. Work still awaiting on the old runtime is
     * abandoned the way a killed process abandons it: its job keeps its lease until the lease runs out (`tick` past it).
     */
    crash: () => void;
    /** Closes the database the harness opened. One the test gave stays open: it is the test's to close. */
    close: () => Promise<void>;
};
type HarnessMembers<Db extends RootDb> = ReturnType<typeof harnessMembers<Db>>;
/**
 * What `setup` returns: the journal tables, the composed journal, and anything else the test reads (its workflow
 * definitions). It may not use a name the harness gives (`db`, `tick`, `drain`, `crash`, `close`).
 */
type HarnessSetup<Db extends RootDb> = HarnessRuntime<Db> & Readonly<Partial<Record<keyof HarnessMembers<Db>, never>>>;
/** What `workflowHarness` gives: everything `setup` returned, each as its own member, and the harness's members. */
type WorkflowHarness<S extends HarnessSetup<Db>, Db extends RootDb> = Omit<S, keyof HarnessMembers<Db>> & HarnessMembers<Db>;
/**
 * A database and a workflow runtime for tests, with time and crashes under the test's control.
 *
 * `setup` builds the runtime: `initJournal`, the workflow definitions and the compose. It returns `tables`, `journal`
 * and the definitions the test uses; the harness shows each of them as its own member. `crash()` runs `setup` again on
 * the same database, as a restarted process would. `schema` is every table to push; default: the returned `tables`.
 *
 * `tick` and `tickTo` control the clock, and `dueJobs` and `release` run the due jobs one by one, so a test can put an
 * event, a wake and a timer in the order it wants to see.
 *
 * @example
 * const h = await workflowHarness({
 *   setup: () => {
 *     const tables = journalTables();
 *     const j = initJournal({ tables, meta: z.object({ actorId: z.string() }) });
 *     const nap = j.workflow('nap', { version: 1, input: z.object({}) }).sleep('wait', '1h').finish();
 *     return { tables, journal: j.compose({ workflows: [nap], workflowMeta: { actorId: 'system' } }), nap };
 *   },
 * });
 * await h.journal.run(h.db, h.nap.start, { input: {}, id: 'nap_1' }, { actorId: 'usr_1' });
 * await h.drain(); // parked on its timer
 * await h.tick('1h');
 * await h.drain(); // completed: see h.nap.read(h.db, 'nap_1')
 * await h.close();
 */
export declare function workflowHarness<S extends HarnessSetup<PgliteDb>>(options: {
    readonly setup: () => S;
    readonly schema?: Record<string, unknown>;
}): Promise<WorkflowHarness<S, PgliteDb>>;
/**
 * `workflowHarness` on a database the test opened, such as a real Postgres with two pools for a race. The schema is the
 * test's to push, and the database is the test's to close: `close()` does nothing.
 */
export declare function workflowHarnessOn<Db extends RootDb, S extends HarnessSetup<Db>>(db: Db, options: {
    readonly setup: () => S;
}): WorkflowHarness<S, Db>;
export {};
//# sourceMappingURL=testing.d.ts.map