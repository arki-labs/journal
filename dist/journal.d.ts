import type { StandardSchemaV1 } from '@arki/schema';
import type { JournalDefinitions } from './api.js';
import type { JournalTables } from './pg.js';
import type { JobRetention } from './retention.js';
import type { DbHandle, EventStorage, RootDb, TransactionSource } from './types.js';
/** `initJournal` options other than `meta`. `events` is the journal default; each entity may override it. */
type InitOptions = {
    readonly tables: JournalTables;
    readonly retention?: JobRetention;
    readonly events?: EventStorage;
};
/**
 * `initJournal({ tables, meta })` types `write`'s `tx`, `events`' `{ tx }` and
 * projection handlers with the structural `DbHandle`. `initJournal.tx<AppTx>()
 * .create({ tables, meta })` uses the app's own Drizzle transaction type instead, so
 * repositories typed against it fit. `initJournal.db<AppDb>()` names the
 * app's root database type: effects get it as `ctx.db`, and `drain` and
 * `worker` then need it. Both are type-only steps and chain in either order.
 * `retention` says how long finished jobs are kept, where they go and how often the sweeper runs. It is the one
 * place for it: archive at ack, the job operations, the sweeper, Foreman and workflow timers all read it.
 * Defaults: completed 7 days, dead 90 days.
 * `events` is the journal's default for whether an entity's events are stored (`'stored'`, the
 * default) or only passed through the write (`'transient'`); `j.entity(kind, table, { events })`
 * overrides it per entity. Workflow runs always store their events.
 */
export declare const initJournal: {
    (options: InitOptions): JournalDefinitions<StandardSchemaV1<Record<string, never>, Record<string, never>>, DbHandle, RootDb>;
    <Meta extends StandardSchemaV1<unknown, Record<string, unknown>>>(options: InitOptions & {
        readonly meta: Meta;
    }): JournalDefinitions<Meta, DbHandle, RootDb>;
} & {
    tx: <Tx extends TransactionSource<Tx>>() => {
        create: {
            (options: InitOptions): JournalDefinitions<StandardSchemaV1<Record<string, never>, Record<string, never>>, Tx, RootDb>;
            <Meta extends StandardSchemaV1<unknown, Record<string, unknown>>>(options: InitOptions & {
                readonly meta: Meta;
            }): JournalDefinitions<Meta, Tx, RootDb>;
        };
        db: <AppDb extends RootDb>() => {
            create: {
                (options: InitOptions): JournalDefinitions<StandardSchemaV1<Record<string, never>, Record<string, never>>, Tx, AppDb>;
                <Meta extends StandardSchemaV1<unknown, Record<string, unknown>>>(options: InitOptions & {
                    readonly meta: Meta;
                }): JournalDefinitions<Meta, Tx, AppDb>;
            };
        };
    };
    db: <AppDb extends RootDb>() => {
        create: {
            (options: InitOptions): JournalDefinitions<StandardSchemaV1<Record<string, never>, Record<string, never>>, DbHandle, AppDb>;
            <Meta extends StandardSchemaV1<unknown, Record<string, unknown>>>(options: InitOptions & {
                readonly meta: Meta;
            }): JournalDefinitions<Meta, DbHandle, AppDb>;
        };
        tx: <Tx extends TransactionSource<Tx>>() => {
            create: {
                (options: InitOptions): JournalDefinitions<StandardSchemaV1<Record<string, never>, Record<string, never>>, Tx, AppDb>;
                <Meta extends StandardSchemaV1<unknown, Record<string, unknown>>>(options: InitOptions & {
                    readonly meta: Meta;
                }): JournalDefinitions<Meta, Tx, AppDb>;
            };
        };
    };
};
export {};
//# sourceMappingURL=journal.d.ts.map