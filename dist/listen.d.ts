/**
 * `listenOnPool`: the `WakeListener` for a `pg` pool. It borrows one client from
 * the pool for as long as the worker runs, `LISTEN`s on the channel, and forwards
 * each payload. A dropped connection is released and replaced after `retryMs`;
 * notifications sent while it was gone are lost, which taps accept and polling
 * covers for jobs. Typed by shape, so this file imports no driver.
 * Leaf file: may import `debug` and `types` only.
 */
import type { WakeListener } from './types.js';
/**
 * Let the process exit while this timer waits. Node and Bun return a timer object
 * with `unref`; browsers, Deno's web API and Hermes return a number, which never
 * holds a process open, so there is nothing to do.
 */
export declare function unrefTimer(timer: unknown): void;
/** The part of a `pg` pool client a listener uses. */
export type ListenClient = {
    query(text: string): Promise<unknown>;
    on(event: 'notification', listener: (message: {
        readonly channel: string;
        readonly payload?: string;
    }) => void): unknown;
    on(event: 'error', listener: (error: Error) => void): unknown;
    release(error?: Error | boolean): void;
};
/** The part of a `pg` pool a listener uses: `new pg.Pool(...)`, or a Drizzle node-postgres database's `$client`. */
export type ListenPool = {
    connect(): Promise<ListenClient>;
};
/**
 * Hear `channel` on a dedicated client of `pool`: `journal.worker(db, { listen: listenOnPool(db.$client, journal.wakeChannel) })`.
 * The first connection is made when the worker starts; if it fails, `start()` rejects.
 */
export declare function listenOnPool(pool: ListenPool, channel: string, opts?: {
    readonly retryMs?: number;
}): WakeListener;
//# sourceMappingURL=listen.d.ts.map