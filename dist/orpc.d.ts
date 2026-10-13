/**
 * - A `CommandError` becomes the `ORPCError` with the same code and message.
 * - A `JournalError` with code `CONFLICT` becomes an `ORPCError('CONFLICT')`, a 409 the client can retry.
 * - Anything else is returned unchanged: the app decides what it means.
 *
 * The original error is NOT attached as `cause`. The journal's message names the entity kind and
 * id, and a host may log or serialize a cause. A host that wants the original logs it itself,
 * in a middleware placed inside this one.
 */
export declare function toORPCError(error: unknown): unknown;
/**
 * The middleware form of `toORPCError`. Add it once to the app's procedure
 * builders, and no procedure needs a try/catch around a command.
 *
 * Order: put it INSIDE the app's own error middleware, so after it in the
 * chain: `os.use(appErrors).use(commandErrors())`. A rejected rule is then
 * already an `ORPCError` when the app's middleware sees it, and passes. Placed
 * before it, the app's middleware sees a plain error first and answers 500.
 */
export declare function commandErrors(): import("@orpc/server").DecoratedMiddleware<Record<never, never>, Record<never, never>, unknown, any, any, Record<never, never>>;
//# sourceMappingURL=orpc.d.ts.map