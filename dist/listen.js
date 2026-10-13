import { debugWorker } from './debug.js';
/**
 * Let the process exit while this timer waits. Node and Bun return a timer object
 * with `unref`; browsers, Deno's web API and Hermes return a number, which never
 * holds a process open, so there is nothing to do.
 */
export function unrefTimer(timer) {
    if (typeof timer === 'object' && timer !== null && 'unref' in timer && typeof timer.unref === 'function')
        timer.unref();
}
/**
 * Hear `channel` on a dedicated client of `pool`: `journal.worker(db, { listen: listenOnPool(db.$client, journal.wakeChannel) })`.
 * The first connection is made when the worker starts; if it fails, `start()` rejects.
 */
export function listenOnPool(pool, channel, opts) {
    const retryMs = opts?.retryMs ?? 1000;
    const quoted = `"${channel.replaceAll('"', '""')}"`;
    return async (onMessage) => {
        let stopped = false;
        let current;
        let timer;
        const connect = async () => {
            const client = await pool.connect();
            let released = false;
            const drop = (error) => {
                if (released)
                    return;
                released = true;
                if (current === client)
                    current = undefined;
                client.release(error ?? true);
            };
            client.on('notification', message => {
                if (message.channel === channel && message.payload !== undefined)
                    onMessage(message.payload);
            });
            client.on('error', error => {
                debugWorker.debug('listen {channel}: connection lost: {lost}', { channel, lost: error.message });
                drop(error);
                schedule();
            });
            try {
                await client.query(`LISTEN ${quoted}`);
            }
            catch (error) {
                drop(error instanceof Error ? error : new Error(String(error)));
                throw error;
            }
            if (stopped) {
                drop();
                return;
            }
            current = client;
            debugWorker.debug('listen {channel}: connected', { channel });
        };
        const schedule = () => {
            if (stopped || timer !== undefined)
                return;
            timer = setTimeout(() => {
                timer = undefined;
                connect().catch((error) => {
                    debugWorker.debug('listen {channel}: reconnect failed', {
                        channel,
                        error: error instanceof Error ? error.message : String(error),
                    });
                    schedule();
                });
            }, retryMs);
            unrefTimer(timer);
        };
        await connect();
        return async () => {
            stopped = true;
            if (timer !== undefined)
                clearTimeout(timer);
            const client = current;
            current = undefined;
            if (client === undefined)
                return;
            try {
                await client.query(`UNLISTEN ${quoted}`);
                client.release();
            }
            catch (error) {
                client.release(error instanceof Error ? error : true);
            }
        };
    };
}
//# sourceMappingURL=listen.js.map