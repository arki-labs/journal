import type { AnyEntity, DbHandle, Effect, EffectHandlers, EffectSchedule, Need, Needs, Projection, ProjectionHandlers, ProjectionOptions, Services, Tap, TapHandlers } from './types.js';
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
/** Give one tap its services, as `bindEffect` does for an effect. */
export declare function bindTap<Meta, AppDb>(tap: Tap<Meta, AppDb, Needs>, services: Services): Tap<Meta, AppDb>;
/**
 * Give one effect its services. The result needs nothing more, so the worker can run it.
 * `services` may hold more than this effect needs: each need is read by its name.
 * This is the only place a need meets its value. `j.compose` calls it with the app's
 * `services`; the Dot bridge calls it with the services of the feature that lists the effect.
 */
export declare function bindEffect<Meta, AppDb, Run>(effect: Effect<Meta, AppDb, Run, Needs>, services: Services): Effect<Meta, AppDb, Run>;
//# sourceMappingURL=handlers.d.ts.map