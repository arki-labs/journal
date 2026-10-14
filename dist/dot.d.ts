/**
 * `@arki/dot` adapter, in two parts:
 *
 * - `journal(...)` is the driven part, for `.use()`. It publishes `services.journal`, so
 *   features can write through it. With `{ j, tables }` it composes the journal from the
 *   features' `journalHandlers` declarations. It reads them from the feature values, so it
 *   boots before the features.
 * - `journalWorker(...)` is the driving part, for `.serve()`. It runs the effects, taps and
 *   async projections between `start` and `stop`. It gives each effect and tap the services
 *   of the feature that lists it.
 *
 * The split works because writes never need an effect's services: a write only queues
 * the effect's job. Inline projections run inside the write, and they get only the
 * transaction. So the journal is composed with `services: 'worker'`, and the worker
 * gives the services when it runs a handler.
 *
 * The app's `db` plugin must publish the root Drizzle database under the `db` key.
 * `@arki/dot` is an optional peer. Import this module only inside a Dot app.
 */
import type { z } from 'zod';
import type { Driven, Driver } from '@arki/dot/feature';
import type { EmptyShape, Plugin } from '@arki/dot/plugin';
import type { Journal, JournalDefinitions } from './api.js';
import type { JournalTables } from './pg.js';
import type { DbHandle, Effect, HandlerServices, JournalWorker, Needs, Projection, RootDb, Services, ServicesFor, Tap, TransactionSource, WakeListener } from './types.js';
export declare const JOURNAL_ACTION_META_SCHEMA = "@arki/journal/action-meta@1";
export declare const JOURNAL_PLUGIN_ERROR_CODES: {
    readonly badSlice: 'ARKI_JOURNAL_PLUGIN_E001';
};
/** One effect in the app manifest: async work that the journal's job table feeds in. */
export type JournalDotAction = {
    readonly id: string;
    readonly binding: 'journal';
    readonly direction: 'in';
    readonly address: string;
    readonly metaSchema: typeof JOURNAL_ACTION_META_SCHEMA;
    readonly meta: {
        readonly entities: string[];
        readonly events: string[];
    };
};
/** What one feature hands to the journal, as declared: an effect or a tap may still have needs. */
export type JournalDeclarations<Meta = unknown, Tx = DbHandle, AppDb = RootDb> = {
    readonly projections: readonly Projection<Meta, Tx>[];
    readonly effects: readonly Effect<Meta, AppDb, unknown, Needs>[];
    readonly taps: readonly Tap<Meta, AppDb, Needs>[];
};
/** What a feature's `journal` slice publishes at boot: its services, for its effects and taps. */
export type JournalSlicePayload = {
    readonly services: Services;
};
/**
 * The feature slice a `journalHandlers(...)` declaration produces.
 * `handlers` is read before the features boot, by `journal({ j, tables })`.
 * `resolve` runs at the feature's boot. `TServices` is what the feature's effects and
 * taps need: the feature must declare it in `needs`.
 */
export type JournalFeatureSlice<Meta = unknown, Tx = DbHandle, AppDb = RootDb, TServices = unknown> = {
    readonly key: 'journal';
    readonly actions: readonly JournalDotAction[];
    readonly handlers: JournalDeclarations<Meta, Tx, AppDb>;
    readonly resolve: (services: TServices) => JournalSlicePayload;
};
/**
 * Declare a feature's projections, effects and taps
 * (`feature('orders', { use: [journalHandlers({ projections, effects })] })`).
 * `journal({ j, tables })` reads them from the feature value and composes the journal.
 *
 * An effect with needs (`j.effect(name, entity, { mailer: need<Mailer>() }, on)`) gets
 * them from the booted services of this feature, by name, when `journalWorker()` runs it.
 * The feature must declare each one in its own `needs`: the slice's `resolve` does not
 * type-check otherwise, and throws at the feature's boot when the types were bypassed.
 * Two features may use the same need name for two different services.
 *
 * Actions: one per effect. Projections add none: they run inside the write, not
 * at an app boundary.
 */
export declare function journalHandlers<Meta = unknown, Tx = DbHandle, AppDb = RootDb, const E extends readonly Effect<Meta, AppDb, unknown, Needs>[] = readonly [], const T extends readonly Tap<Meta, AppDb, Needs>[] = readonly []>(handlers: {
    readonly projections?: readonly Projection<Meta, Tx>[];
    readonly effects?: E;
    readonly taps?: T;
}): JournalFeatureSlice<Meta, Tx, AppDb, ServicesFor<E> & ServicesFor<T>>;
/** Direct mode: the app composed the journal itself. */
export type JournalDirectOptions<Meta extends z.ZodObject, Tx extends TransactionSource<Tx>, AppDb extends RootDb> = {
    readonly journal: Journal<Meta, Tx, AppDb>;
};
/** Feature mode: the journal is composed from the features' `journalHandlers` declarations. */
export type JournalFeatureOptions<Meta extends z.ZodObject, Tx extends TransactionSource<Tx>, AppDb extends RootDb> = {
    readonly j: Pick<JournalDefinitions<Meta, Tx, AppDb>, 'compose'>;
    readonly tables: JournalTables;
};
/**
 * `RootDb` again on purpose: a Drizzle transaction fits `AppDb` by shape, and must not fit here.
 * `TransactionSource<Tx>`: the worker's database runs the commands of effects, so it opens `Tx`.
 */
type JournalNeeds<Tx extends TransactionSource<Tx>, AppDb extends RootDb> = {
    db: AppDb & RootDb & TransactionSource<Tx>;
};
export type JournalPlugin<Meta extends z.ZodObject, Tx extends TransactionSource<Tx>, AppDb extends RootDb> = Plugin<JournalNeeds<Tx, AppDb>, {
    journal: Journal<Meta, Tx, AppDb>;
}>;
/** Feature mode: bound to the app's features when the app is built. */
export type JournalDriven<Meta extends z.ZodObject, Tx extends TransactionSource<Tx>, AppDb extends RootDb> = Driven<JournalNeeds<Tx, AppDb>, {
    journal: Journal<Meta, Tx, AppDb>;
}>;
/**
 * The driven part, for `.use()`: publishes the journal as `services.journal`.
 * It runs nothing in the background: serve `journalWorker()` for that.
 *
 * - `journal({ journal })`: the journal the app composed itself.
 * - `journal({ j, tables })`: the journal composed from the `journalHandlers` slices of
 *   the features the app mounts. Effects and taps get their services from `journalWorker()`.
 */
export declare function journal<Meta extends z.ZodObject, Tx extends TransactionSource<Tx>, AppDb extends RootDb>(options: JournalDirectOptions<Meta, Tx, AppDb>): JournalPlugin<Meta, Tx, AppDb>;
export declare function journal<Meta extends z.ZodObject, Tx extends TransactionSource<Tx>, AppDb extends RootDb>(options: JournalFeatureOptions<Meta, Tx, AppDb>): JournalDriven<Meta, Tx, AppDb>;
export type JournalWorkerOptions = {
    readonly pollMs?: number;
    readonly batchSize?: number;
    readonly leaseSeconds?: number;
    /** See `journal.worker`: required when the journal has taps, unless `taps: false`. */
    readonly listen?: WakeListener;
    readonly taps?: boolean;
};
/**
 * What the worker needs of `services.journal`: any journal fits. The database type
 * is checked where the journal is mounted (`journal(...)` needs the same `db`).
 */
type WorkerHost = {
    worker(db: RootDb, opts?: JournalWorkerOptions & {
        readonly services?: HandlerServices;
    }): JournalWorker;
};
/**
 * The driving part, for `.serve()`: one worker between `start` and `stop`, for the
 * journal that `journal(...)` published. Each effect and tap of a feature gets the
 * services of that feature. A process that serves no worker still writes: its jobs
 * wait for a process that does.
 */
export declare function journalWorker(options?: JournalWorkerOptions): Driver<{
    db: RootDb;
    journal: WorkerHost;
}, EmptyShape>;
export {};
//# sourceMappingURL=dot.d.ts.map