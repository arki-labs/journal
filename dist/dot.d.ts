/**
 * `@arki/dot` adapter, in three parts:
 *
 * - `journal(...)` is the infra part, for `.infra()`. It publishes `services.journal`, so
 *   features can write through it. With `{ j }` it composes the journal from the
 *   features' declarations. It reads them from the feature values, so it boots before the features.
 * - `journalHandlers(core, { effects, taps, workflows })` is an application contribution, for
 *   `.usecases(factories, journalHandlers(core, …))`. An effect is application code (D-8), so it
 *   sits with the usecases and gets what a usecase gets: the feature's needs (never an
 *   `entrypointOnly` one), its private infra and its domain services. `needsOf((_: Deps) => ['mailer'])`
 *   picks them, typed from the feature.
 * - `journalWorker(...)` is the only entrypoint, for `.entrypoints()`. It runs the effects, taps and
 *   async projections between `start` and `stop`, each already bound to the services of the
 *   feature that lists it.
 *
 * The split works because writes never need an effect's services: a write only queues
 * the effect's job. Inline projections run inside the write, and they get only the
 * transaction. So the journal is composed with `services: 'worker'`, and the worker
 * gives the services when it runs a handler.
 *
 * Where each part lives in a feature (D-9):
 *
 * - `journalProjections(...)` in `.infra(...)`: projections maintain the feature's read
 *   models, so they sit with its other infra.
 * - `journalHandlers(core, { effects, taps, workflows })` in `.usecases(...)`: the reactions a
 *   behaviour owns, next to the command that decides it.
 *
 * The app's `db` plugin must publish the root Drizzle database under the `db` key.
 * `@arki/dot` is an optional peer. Import this module only inside a Dot app.
 */
import type { AnyDefinedFeature, AnyFeatureCore, DepsOf, EntrypointBinder } from '@arki/dot/feature';
import type { ActionSource, CtxOf, DotConfigureContext, EmptyShape, NeedsShape, Service, WireNeeds } from '@arki/dot/unit';
import type { SchemaInput, StandardSchemaV1 } from '@arki/schema';
import type { Journal, JournalDefinitions } from './api.js';
import type { DbHandle, Effect, HandlerServices, JobRunner, JournalWorker, Need, Needs, Projection, RootDb, Services, ServicesFor, Tap, TransactionSource, WakeListener } from './types.js';
import type { WorkflowDef, WorkflowServices } from './workflow/define.js';
import { JOURNAL_ACTION_META_SCHEMA } from './action-meta.js';
export { JOURNAL_ACTION_META_SCHEMA } from './action-meta.js';
export declare const JOURNAL_PLUGIN_ERROR_CODES: {
    /**
     * A feature supplied an invalid Journal contribution.
     * @fix Declare a feature's reactions with journalHandlers(core, { effects, taps, workflows }) in .usecases(...), and its projections with journalProjections(...) in .infra(...), both from @arki/journal/dot.
     * @verify bun run test -- src/dot-feature.test.ts
     */
    readonly badSlice: 'ARKI_JOURNAL_PLUGIN_E001';
};
/** One effect in the app manifest: async work that the journal's job table feeds in. */
export type JournalDotAction = {
    readonly id: string;
    readonly binding: 'journal';
    readonly direction: 'in';
    readonly address: string;
    readonly metaSchema: typeof JOURNAL_ACTION_META_SCHEMA;
    /** `signals` is set on a workflow's action only: the signal names its `waitFor` nodes wait for. */
    readonly meta: {
        readonly entities: string[];
        readonly events: string[];
        readonly signals?: string[];
    };
};
/** What one feature hands to the journal, as declared: an effect or a tap may still have needs. */
export type JournalDeclarations<Meta = unknown, Tx = DbHandle, AppDb = RootDb> = {
    readonly projections: readonly Projection<Meta, Tx>[];
    readonly effects: readonly Effect<Meta, AppDb, Needs>[];
    readonly taps: readonly Tap<Meta, AppDb, Needs>[];
    readonly workflows: readonly WorkflowDef[];
};
/** What `journalHandlers(...)` binds to at the feature's boot: the feature's usecase-level services. */
export type JournalSlicePayload = {
    readonly services: Services;
};
/**
 * A feature before `.usecases()`: what `needsOf` and `journalHandlers` take. Its `DepsOf` is what a
 * usecase may ask for. After `.usecases()` the stage's `DepsOf` is what an entrypoint gets (the
 * `entrypointOnly` needs and the usecases), which a reaction must never see; that stage has no
 * `usecases` method, so it does not fit here.
 */
export type UsecaseCore = AnyFeatureCore & {
    readonly usecases: (...args: never) => unknown;
};
/**
 * The needs record of an effect, tap or workflow in a Dot feature. `select` picks the keys of the
 * feature's usecase-level deps (its needs, never an `entrypointOnly` one; its private infra; its
 * domain services), and each one is typed from the feature. It replaces `need<T>()` in a Dot feature:
 * the type is written once, at the feature, and read here from the selector's parameter annotation.
 *
 * ```ts
 * // reactions/send-receipt.ts: `import type { Deps }` only, so there is no import cycle.
 * import type { Deps } from '../feature';
 * export const sendReceipt = j.effect('send-receipt', order, needsOf((_: Deps) => ['mailer']), {
 *   OrderPlaced: (event, { mailer }) => mailer.sendReceipt(event.entityId),
 * });
 * ```
 *
 * `needsOf` calls `select` once and never reads its argument; the feature's value is not needed, so a
 * reaction module and its feature module can import each other in either order. `D` comes from the
 * annotation, so callers write no type arguments. A key the feature lacks, or an `entrypointOnly`
 * one, is a compile error. The selection holds at runtime too: `journalHandlers` checks each key when
 * the feature boots and fails the boot naming it.
 */
export declare function needsOf<D, const K extends readonly (keyof D & string)[]>(select: (deps: D) => K): {
    readonly [P in K[number]]: Need<D[P]>;
};
/**
 * What `journalHandlers(core, …)` puts in a feature's `.usecases(factories, …)`: an application contribution.
 * `handlers` is read before the features boot, by `journal({ j })`. `bind` runs at the feature's boot,
 * with the feature's usecase-level deps, and checks that each handler finds what it needs there.
 */
export type JournalHandlers<Meta = unknown, AppDb = RootDb, TServices = unknown> = {
    readonly kind: 'journal';
    readonly key: 'journal';
    readonly handlers: JournalDeclarations<Meta, DbHandle, AppDb>;
    /** The actions, named after the feature: an instance's effect ids carry its instance (`send#eu.run`). */
    readonly actionsOf: (feature: string) => readonly JournalDotAction[];
    readonly bind: (deps: TServices) => JournalSlicePayload;
};
/** A named compile error when the feature lacks a service its effects, taps or workflows need. */
type CoversNeeds<TDeps, TNeeded> = [TDeps] extends [TNeeded] ? unknown : {
    readonly 'JOURNAL: the feature does not give these effects, taps and workflows what they need': Exclude<keyof TNeeded, keyof TDeps>;
};
/**
 * A feature's reactions, for its `.usecases(...)`:
 *
 * ```ts
 * export const core = defineFeature('orders').needs({ … }).infra(mailer, journalProjections(placedCount));
 * const logic = core.usecases({}, journalHandlers(core, { effects: [sendReceipt] }));
 * ```
 *
 * Each effect, tap and workflow gets its needs from this feature, by name: a need (never an
 * `entrypointOnly` one), a private infra service or a domain service. Pick them with `needsOf((_: Deps) => […])`.
 * A missing one is a compile error here, naming it, and fails the feature's boot for callers that
 * skip the types. `journalWorker()` runs each handler with these services.
 *
 * Actions: one per effect (named after the feature's instance) and one per workflow
 * (`<name>@<version>.run`, its signals in the meta). A handler name may be listed by one feature
 * only: a second one fails the boot and names both features.
 */
export declare function journalHandlers<C extends UsecaseCore, Meta = unknown, AppDb = RootDb, const E extends readonly Effect<Meta, AppDb, Needs>[] = readonly [], const T extends readonly Tap<Meta, AppDb, Needs>[] = readonly [], const W extends readonly WorkflowDef[] = readonly []>(_core: C, handlers: {
    readonly effects?: E;
    readonly taps?: T;
    readonly workflows?: W;
} & CoversNeeds<DepsOf<C>, ServicesFor<E> & ServicesFor<T> & WorkflowServices<W>>): JournalHandlers<Meta, AppDb, ServicesFor<E> & ServicesFor<T> & WorkflowServices<W>>;
/** Marks the infra unit `journalProjections(...)` makes, so the journal can find it among a feature's units. */
export declare const JOURNAL_PROJECTIONS_KIND = "journal-projections";
/**
 * What `journalProjections(...)` puts in a feature's `.infra(...)`: a plugin
 * that boots nothing and provides nothing — its job is the static `handlers`
 * the journal reads before boot.
 */
export type JournalProjectionsPlugin<Meta = unknown, Tx = DbHandle> = ReturnType<typeof journalProjections<Meta, Tx>>;
/**
 * A `defineFeature` feature's projections, for its `.infra(...)`:
 * `defineFeature('orders').infra(store, journalProjections(customerStats))`.
 *
 * Projections run inside the write's transaction (or later, in the worker,
 * when async) and get only the transaction, so they need no services. The
 * unit shows in `dot explain` as `<feature>/journal-projections`.
 */
export declare function journalProjections<Meta = unknown, Tx = DbHandle>(...projections: readonly Projection<Meta, Tx>[]): Omit<import("@arki/dot/unit").Unit<WireNeeds<EmptyShape>, import("@arki/dot/unit").ProvidedValues<EmptyShape>, EmptyShape, "journal-projections", import("@arki/dot/unit").EmptyOwnership, import("@arki/dot/unit").EmptyPhases>, "factories" | "hooks" | "logging"> & import("@arki/dot/unit").LoggingSlot<import("@arki/dot/unit").DotLoggingHandle<undefined>> & import("@arki/dot/unit").FactoryContract<import("@arki/dot/unit").ProvidedValues<EmptyShape>> & {
    readonly factories: {};
    readonly hooks: import("@arki/dot/unit").PhaseHooks<never, {
        readonly configure: undefined;
        readonly start: undefined;
        readonly stop: undefined;
        readonly dispose: undefined;
    }, DotConfigureContext> & import("@arki/dot/unit").BootSlot<CtxOf<EmptyShape> & import("@arki/dot/unit").ProvidedValues<EmptyShape> & import("@arki/dot/unit").KernelCtx, undefined>;
} & import("@arki/dot/unit").InfraRole & {
    readonly kind: "journal-projections";
    readonly handlers: {
        readonly projections: readonly Projection<Meta, Tx>[];
        readonly effects: readonly [];
        readonly taps: readonly [];
        readonly workflows: readonly [];
    };
};
/** Direct mode: the app composed the journal itself. */
export type JournalDirectOptions<Meta extends StandardSchemaV1<unknown, Record<string, unknown>>, Tx extends TransactionSource<Tx>, AppDb extends RootDb> = {
    readonly journal: Journal<Meta, Tx, AppDb>;
};
/** Feature mode: the journal is composed from the features' `journalHandlers` declarations. */
export type JournalFeatureOptions<Meta extends StandardSchemaV1<unknown, Record<string, unknown>>, Tx extends TransactionSource<Tx>, AppDb extends RootDb> = {
    readonly j: Pick<JournalDefinitions<Meta, Tx, AppDb>, 'compose'>;
    /** The meta the workflow runner records its checkpoints with. Required when a feature declares workflows. */
    readonly workflowMeta?: SchemaInput<Meta>;
    /**
     * The folder `dot explain --as event-map` scans for procedure files, relative to the folder `dot` runs in.
     * Default `src/features`: the scan reads every `entrypoints/` folder under it.
     */
    readonly entrypointRoot?: string;
};
export type JournalPlugin<Meta extends StandardSchemaV1<unknown, Record<string, unknown>>, Tx extends TransactionSource<Tx>, AppDb extends RootDb> = ReturnType<typeof journalPlugin<Meta, Tx, AppDb>>;
/**
 * Feature mode: bound to the app's features when the app is built. Its `provides.journal`
 * is the handle a feature needs (`entrypointOnly(appJournal.provides.journal)`).
 */
export type JournalDriven<Meta extends StandardSchemaV1<unknown, Record<string, unknown>>, Tx extends TransactionSource<Tx>, AppDb extends RootDb> = ReturnType<typeof journalFromFeatures<Meta, Tx, AppDb>>;
declare function journalPlugin<Meta extends StandardSchemaV1<unknown, Record<string, unknown>>, Tx extends TransactionSource<Tx>, AppDb extends RootDb>(composed: Journal<Meta, Tx, AppDb>): Omit<import("@arki/dot/unit").Unit<WireNeeds<{
    db: Service<AppDb & DbHandle & {
        readonly rollback?: undefined;
    } & {
        transaction<T>(run: (tx: Tx) => Promise<T>): Promise<T>;
    }>;
}>, import("@arki/dot/unit").ProvidedValues<{
    journal: Journal<Meta, Tx, AppDb>;
}>, {
    db: Service<AppDb & DbHandle & {
        readonly rollback?: undefined;
    } & {
        transaction<T>(run: (tx: Tx) => Promise<T>): Promise<T>;
    }>;
}, "journal", import("@arki/dot/unit").EmptyOwnership, import("@arki/dot/unit").EmptyPhases>, "factories" | "hooks" | "logging"> & import("@arki/dot/unit").LoggingSlot<import("@arki/dot/unit").DotLoggingHandle<undefined>> & import("@arki/dot/unit").FactoryContract<import("@arki/dot/unit").ProvidedValues<{
    journal: Journal<Meta, Tx, AppDb>;
}>> & {
    readonly factories: {
        readonly journal: (ctx: never) => Journal<Meta, Tx, AppDb>;
    };
    readonly hooks: import("@arki/dot/unit").PhaseHooks<never, {
        readonly configure: undefined;
        readonly start: undefined;
        readonly stop: undefined;
        readonly dispose: undefined;
    }, DotConfigureContext> & import("@arki/dot/unit").BootSlot<CtxOf<{
        db: Service<AppDb & DbHandle & {
            readonly rollback?: undefined;
        } & {
            transaction<T>(run: (tx: Tx) => Promise<T>): Promise<T>;
        }>;
    }> & import("@arki/dot/unit").ProvidedValues<{
        journal: Journal<Meta, Tx, AppDb>;
    }> & import("@arki/dot/unit").KernelCtx, undefined>;
} & import("@arki/dot/unit").InfraRole;
declare function journalFromFeatures<Meta extends StandardSchemaV1<unknown, Record<string, unknown>>, Tx extends TransactionSource<Tx>, AppDb extends RootDb>({ j, workflowMeta, entrypointRoot }: JournalFeatureOptions<Meta, Tx, AppDb>): import("@arki/dot/feature").UnitBinder<"infra", import("@arki/dot/unit").PlainAuthoredUnit<{
    db: Service<AppDb & DbHandle & {
        readonly rollback?: undefined;
    } & {
        transaction<T>(run: (tx: Tx) => Promise<T>): Promise<T>;
    }>;
}, {
    journal: Journal<Meta, Tx, AppDb>;
}, "journal", undefined>, "journal">;
/**
 * The infra part, for `.infra()`: publishes the journal as `services.journal`.
 * It runs nothing in the background: serve `journalWorker()` for that.
 *
 * - `journal({ journal })`: the journal the app composed itself.
 * - `journal({ j })`: the journal composed from the `journalHandlers` slices of
 *   the features the app mounts. Effects and taps get their services from `journalWorker()`.
 */
export declare function journal<Meta extends StandardSchemaV1<unknown, Record<string, unknown>>, Tx extends TransactionSource<Tx>, AppDb extends RootDb>(options: JournalDirectOptions<Meta, Tx, AppDb>): JournalPlugin<Meta, Tx, AppDb>;
export declare function journal<Meta extends StandardSchemaV1<unknown, Record<string, unknown>>, Tx extends TransactionSource<Tx>, AppDb extends RootDb>(options: JournalFeatureOptions<Meta, Tx, AppDb>): JournalDriven<Meta, Tx, AppDb>;
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
        readonly jobs?: JobRunner;
    }): JournalWorker;
};
/** No `$`-prefixed keys: that prefix is the kernel's. */
type NoReservedKeys = Readonly<Record<`$${string}`, never>>;
/** The worker's own needs. A `jobs` source adds its own. */
type WorkerNeeds = {
    readonly db: Service<RootDb>;
    readonly journal: Service<WorkerHost>;
};
/**
 * A job runner built at boot, from the mounted features and the services it needs, for
 * `journalWorker({ jobs })`. `@arki/queue/dot`'s `outboxJobs()` makes one.
 */
export type JobsSource<TNeeds extends NeedsShape> = {
    /** Merged into the worker's needs: a missing one fails boot, not the first job. */
    readonly needs: TNeeds;
    /** The consumer actions the runner adds to the worker's manifest (e.g. `<job>.consume`). */
    readonly actions?: (features: readonly AnyDefinedFeature[]) => readonly ActionSource[];
    /** `services` is the worker's boot context: its needs, `db`, and the features' slice records. */
    build(features: readonly AnyDefinedFeature[], services: CtxOf<TNeeds> & {
        readonly db: RootDb;
    }): JobRunner | Promise<JobRunner>;
};
/**
 * The entrypoint, for `.entrypoints()`: one worker between `start` and `stop`, for the
 * journal that `journal(...)` published. Each effect and tap of a feature gets the
 * services of that feature. A process that serves no worker still writes: its jobs
 * wait for a process that does. With `jobs`, the worker also runs queue rows
 * (`@arki/queue/outbox`) through the runner the source builds at boot.
 */
export declare function journalWorker(options?: JournalWorkerOptions): EntrypointBinder<WireNeeds<WorkerNeeds>, EmptyShape>;
export declare function journalWorker<TNeeds extends NeedsShape & NoReservedKeys>(options: JournalWorkerOptions & {
    readonly jobs: JobsSource<TNeeds>;
}): EntrypointBinder<WireNeeds<WorkerNeeds & TNeeds>, EmptyShape>;
//# sourceMappingURL=dot.d.ts.map