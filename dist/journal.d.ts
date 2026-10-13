import { z } from 'zod';
import type { JournalDefinitions } from './api.js';
import type { DbHandle, RootDb, TransactionSource } from './types.js';
/**
 * `initJournal({ meta })` types `write`'s `tx`, `events`' `{ tx }` and
 * projection handlers with the structural `DbHandle`. `initJournal.tx<AppTx>()
 * .create({ meta })` uses the app's own Drizzle transaction type instead, so
 * repositories typed against it fit. `initJournal.db<AppDb>()` names the
 * app's root database type: effects get it as `ctx.db`, and `drain` and
 * `worker` then need it. Both are type-only steps and chain in either order.
 */
export declare const initJournal: {
    (): JournalDefinitions<z.ZodObject<{}, z.core.$strip>, DbHandle, RootDb>;
    <Meta extends z.ZodObject>(options: {
        readonly meta: Meta;
    }): JournalDefinitions<Meta, DbHandle, RootDb>;
} & {
    tx: <Tx extends TransactionSource<Tx>>() => {
        create: {
            (): JournalDefinitions<z.ZodObject<{}, z.core.$strip>, Tx, RootDb>;
            <Meta extends z.ZodObject>(options: {
                readonly meta: Meta;
            }): JournalDefinitions<Meta, Tx, RootDb>;
        };
        db: <AppDb extends RootDb>() => {
            create: {
                (): JournalDefinitions<z.ZodObject<{}, z.core.$strip>, Tx, AppDb>;
                <Meta extends z.ZodObject>(options: {
                    readonly meta: Meta;
                }): JournalDefinitions<Meta, Tx, AppDb>;
            };
        };
    };
    db: <AppDb extends RootDb>() => {
        create: {
            (): JournalDefinitions<z.ZodObject<{}, z.core.$strip>, DbHandle, AppDb>;
            <Meta extends z.ZodObject>(options: {
                readonly meta: Meta;
            }): JournalDefinitions<Meta, DbHandle, AppDb>;
        };
        tx: <Tx extends TransactionSource<Tx>>() => {
            create: {
                (): JournalDefinitions<z.ZodObject<{}, z.core.$strip>, Tx, AppDb>;
                <Meta extends z.ZodObject>(options: {
                    readonly meta: Meta;
                }): JournalDefinitions<Meta, Tx, AppDb>;
            };
        };
    };
};
//# sourceMappingURL=journal.d.ts.map