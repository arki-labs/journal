/** A hook. `next` runs the rest of the chain and the work itself. It gives no result and takes no input. */
export type Around<Ctx> = (ctx: Ctx, next: () => Promise<void>) => Promise<void>;
/** What the app sees: register only. */
export type HookPoint<Ctx> = {
    /** Wrap every run. Throws `BAD_DEFINITION` once the journal has run a command, a drain or a worker. */
    around(hook: Around<Ctx>): void;
};
export declare function createHookPoint<Ctx extends object>(what: 'command' | 'effect'): {
    point: HookPoint<Ctx>;
    freeze: () => void;
    run: <T>(ctx: Ctx, work: () => Promise<T>) => Promise<T>;
};
export type HookPointInternal<Ctx extends object> = ReturnType<typeof createHookPoint<Ctx>>;
//# sourceMappingURL=hooks.d.ts.map