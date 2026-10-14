import type { AnyEntity, DbHandle, Effect, EffectHandlers, EffectSchedule, HandlerServices, Need, Needs, Projection, ProjectionHandlers, ProjectionOptions, Services, Tap, TapHandlers } from './types.js';
export declare function defineProjection<E extends AnyEntity<Meta>, Meta, Tx extends DbHandle>(name: string, entity: E | readonly E[], on: NoInfer<ProjectionHandlers<E, Meta, Tx>>, opts?: ProjectionOptions): Projection<Meta, Tx>;
/** Declare one thing an effect needs: `j.effect('order-mail', order, { mailer: need<Mailer>() }, { ... })`. */
export declare const need: <T>() => Need<T>;
/** Attach a schedule to an effect, checked once: a job row must be able to hold it. */
export declare function withSchedule<Meta, AppDb, Run, N extends Needs>(effect: Omit<Effect<Meta, AppDb, Run, N>, 'schedule' | 'withSchedule'>, schedule: EffectSchedule<Meta>): Effect<Meta, AppDb, Run, N>;
/** `j.effect` for one journal. Three arguments: the effect needs nothing. Four: the third lists its needs. */
export declare function effectFor<Meta, AppDb, Run>(): {
    <E extends AnyEntity<Meta>>(name: string, entity: E | readonly E[], on: NoInfer<EffectHandlers<E, Meta, AppDb, Run>>): Effect<Meta, AppDb, Run>;
    <E extends AnyEntity<Meta>, N extends Needs>(name: string, entity: E | readonly E[], needs: N, on: NoInfer<EffectHandlers<E, Meta, AppDb, Run, N>>): Effect<Meta, AppDb, Run, N>;
};
/** `j.tap` for one journal. Three arguments: the tap needs nothing. Four: the third lists its needs. */
export declare function tapFor<Meta, AppDb>(): {
    <E extends AnyEntity<Meta>>(name: string, entity: E | readonly E[], on: NoInfer<TapHandlers<E, Meta, AppDb>>): Tap<Meta, AppDb>;
    <E extends AnyEntity<Meta>, N extends Needs>(name: string, entity: E | readonly E[], needs: N, on: NoInfer<TapHandlers<E, Meta, AppDb, N>>): Tap<Meta, AppDb, N>;
};
/**
 * The value of each need of one handler, read from `services` by name. `services` may hold more.
 * Throws when one is missing: without this check the handler would start, and fail on `undefined`.
 */
export declare function givenServices(kind: 'effect' | 'tap', handler: {
    readonly name: string;
    readonly needs: Needs;
}, services: Services): Services;
/** Give one tap its services, as `bindEffect` does for an effect. */
export declare function bindTap<Meta, AppDb>(tap: Tap<Meta, AppDb, Needs>, services: Services): Tap<Meta, AppDb>;
/**
 * Give one effect its services. The result needs nothing more, so the worker can run it.
 * `services` may hold more than this effect needs: each need is read by its name.
 * This is the only place a need meets its value. `j.compose` calls it with the app's
 * `services`; a worker calls it with the services it was given (`HandlerServices`).
 */
export declare function bindEffect<Meta, AppDb, Run>(effect: Effect<Meta, AppDb, Run, Needs>, services: Services): Effect<Meta, AppDb, Run>;
/**
 * The effects and taps as they run: each bound to its services from `services`.
 * A handler `j.compose` already bound needs nothing, so it gets nothing. Throws on the first
 * missing service, so a worker refuses to start instead of failing job after job.
 */
export declare function bindHandlers<Meta, AppDb, Run>(handlers: {
    readonly effects: readonly Effect<Meta, AppDb, Run, Needs>[];
    readonly taps: readonly Tap<Meta, AppDb, Needs>[];
}, services: HandlerServices | undefined): {
    readonly effects: readonly Effect<Meta, AppDb, Run>[];
    readonly taps: readonly Tap<Meta, AppDb>[];
};
//# sourceMappingURL=handlers.d.ts.map