/** The longest wait, in seconds. A caller that needs longer should take the run id and read it later. */
export declare const SETTLE_LIMIT_SECONDS = 30;
/** The wait in milliseconds. A missing, non-numeric, non-positive or too long wait is misuse and throws `BAD_ARGUMENT`. */
export declare function waitMs(seconds: unknown, option: string, who: string): number;
/** A Drizzle transaction has `rollback()`; the root database does not. A wait in a transaction would hold it open. */
export declare function refuseTransaction(db: {
    readonly rollback?: unknown;
}, verb: string, who: string): void;
/**
 * Calls `attempt` until it returns something, `ms` pass or `signal` aborts. The first call is always made. The pause
 * starts at 10 ms and doubles to 250 ms. `undefined` from `attempt` means "not yet"; a result of `undefined` means the
 * wait ran out.
 */
export declare function pollUntil<Found>(ms: number, signal: AbortSignal | undefined, attempt: () => Promise<Found | undefined>): Promise<Found | undefined>;
//# sourceMappingURL=settle.d.ts.map