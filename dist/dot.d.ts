/**
 * `@arki/dot` adapter.
 *
 * - `journal(...)` is the plugin. It publishes the journal as `services.journal`
 *   and runs one worker per plugin instance between `start` and `stop`.
 * - `journalHandlers(...)` is the feature slice. A feature lists its projections
 *   and effects with it, and `journal({ j, tables, features })` collects them.
 *
 * The app's `db` plugin must publish the root Drizzle database under the `db` key.
 *
 * `@arki/dot` is an optional peer. Import this module only inside a Dot app.
 * Feature slices are read by shape: this file never imports `@arki/feature`.
 */
import type { z } from 'zod';
import type { Plugin, Token } from '@arki/dot/plugin';
import type { Journal, JournalDefinitions } from './api.js';
import type { JournalTables } from './pg.js';
import type { DbHandle, Effect, Needs, Projection, RootDb, ServicesFor, Tap, TransactionSource, WakeListener } from './types.js';
export declare const JOURNAL_ACTION_META_SCHEMA = "@arki/journal/action-meta@1";
export declare const JOURNAL_PLUGIN_ERROR_CODES: {
    readonly badSlice: 'JOURNAL_PLUGIN_E001';
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
/** What one feature hands to the journal. Its effects already hold the feature's services. */
export type JournalHandlers<Meta = unknown, Tx = DbHandle, AppDb = RootDb> = {
    readonly projections: readonly Projection<Meta, Tx>[];
    readonly effects: readonly Effect<Meta, AppDb>[];
    readonly taps: readonly Tap<Meta, AppDb>[];
};
/**
 * The `@arki/feature` slice contract a `journalHandlers(...)` declaration produces.
 * `TServices` is what the feature's effects need: the feature must declare it in `needs`.
 */
export type JournalFeatureSlice<Meta = unknown, Tx = DbHandle, AppDb = RootDb, TServices = unknown> = {
    readonly key: 'journal';
    readonly actions: readonly JournalDotAction[];
    readonly resolve: (services: TServices) => JournalHandlers<Meta, Tx, AppDb>;
};
/**
 * Declare a feature's projections and effects as a boot-time slice
 * (`defineFeature(..., { use: [journalHandlers({ projections, effects })] })`).
 * The payload lands under `journal` in the feature's slice token, where
 * `journal({ j, tables, features })` collects it.
 *
 * An effect with needs (`j.effect(name, entity, { mailer: need<Mailer>() }, on)`) gets
 * them from the booted services of this feature, by name. The feature must declare
 * each one in its own `needs`: the slice's `resolve` does not type-check otherwise.
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
type WorkerOptions = {
    /** Run the async lane in this process. Default `true`. */
    readonly worker?: boolean;
    readonly pollMs?: number;
    readonly batchSize?: number;
    readonly leaseSeconds?: number;
    /** See `journal.worker`: required when the journal has taps, unless `taps: false`. */
    readonly listen?: WakeListener;
    readonly taps?: boolean;
};
/** Direct mode: the app composed the journal itself. */
export type JournalDirectOptions<Meta extends z.ZodObject, Tx extends TransactionSource<Tx>, AppDb extends RootDb> = WorkerOptions & {
    readonly journal: Journal<Meta, Tx, AppDb>;
};
/** Feature mode: the plugin composes the journal from the features' `journalHandlers` slices. */
export type JournalFeatureOptions<Meta extends z.ZodObject, Tx extends TransactionSource<Tx>, AppDb extends RootDb> = WorkerOptions & {
    readonly j: Pick<JournalDefinitions<Meta, Tx, AppDb>, 'compose'>;
    readonly tables: JournalTables;
    /** `tokens(features)` from `@arki/feature/dot`. A feature without a journal slice adds nothing. */
    readonly features: readonly Token<object, string>[];
};
/**
 * `RootDb` again on purpose: a Drizzle transaction fits `AppDb` by shape, and must not fit here.
 * `TransactionSource<Tx>`: the worker's database runs the commands of effects, so it opens `Tx`.
 */
export type JournalPlugin<Meta extends z.ZodObject, Tx extends TransactionSource<Tx>, AppDb extends RootDb> = Plugin<{
    db: AppDb & RootDb & TransactionSource<Tx>;
}, {
    journal: Journal<Meta, Tx, AppDb>;
}>;
export declare function journal<Meta extends z.ZodObject, Tx extends TransactionSource<Tx>, AppDb extends RootDb>(options: JournalDirectOptions<Meta, Tx, AppDb>): JournalPlugin<Meta, Tx, AppDb>;
export declare function journal<Meta extends z.ZodObject, Tx extends TransactionSource<Tx>, AppDb extends RootDb>(options: JournalFeatureOptions<Meta, Tx, AppDb>): JournalPlugin<Meta, Tx, AppDb>;
export {};
//# sourceMappingURL=dot.d.ts.map