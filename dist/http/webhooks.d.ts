/**
 * Outgoing webhooks on the journal's job table: `@arki/journal/http/webhooks`.
 *
 * ```ts
 * export const webhookSchema = webhookTables();
 * export const webhooks = webhookSender({ tables, webhooks: webhookSchema, encryptionKey: env.WEBHOOK_KEY });
 *
 * // In the business transaction: the message exists if and only if the order commits.
 * await db.transaction(async tx => {
 *   await journal.run(tx, placeOrder, input, meta);
 *   await webhooks.dispatch(tx, { partner: tenantId, event: 'order.placed', payload: { orderId } });
 * });
 *
 * journal.worker(db, { jobs: webhooks.runner });
 * ```
 *
 * `dispatch` writes the message once and one `queue` row per active subscription, in the
 * caller's transaction. The journal worker runs each row: it signs the stored bytes with
 * Standard Webhooks and posts them. Retries, backoff, dead letters and `journal.retry` are the
 * worker's; this module adds no second retry loop. Every try is appended to `webhook_attempts`.
 * A subscription whose deliveries die `disableAfter` times in a row is disabled.
 *
 * Secrets are sealed at rest with AES-GCM under `encryptionKey`, bound to their subscription id.
 * Delivery goes through `publicFetch()` by default, so a subscriber URL cannot reach a private
 * address, at subscribe time or after a DNS change. A refused URL (`UnsafeUrl`, the cause of the error `publicFetch` rejects with) is dead at
 * once: it is refused the same way on every try, so retrying it only fills `webhook_attempts`.
 */
import type { PgSchema } from 'drizzle-orm/pg-core';
import type { IdGenerationFailure } from '@arki/contracts';
import type { Backoff } from '@arki/resilience';
import type { JournalTables } from '../pg.js';
import type { DbHandle, RootDb, ScheduledJob } from '../types.js';
/** Stable codes for {@link WebhookError}. Match on codes, never parse messages. */
export declare const WEBHOOK_ERROR_CODES: {
    /** An input failed its schema, a payload is not JSON, or a URL is not public https.
     * @fix Validate the webhook input and JSON payload; use a public HTTPS destination.
     * @verify bun run test -- src/http/webhooks.test.ts
     */
    readonly badInput: 'ARKI_JOURNAL_WEBHOOK_E001';
    /** `dispatch` got the root database. It needs the business transaction.
     * @fix Dispatch inside the business database transaction and pass its transaction handle.
     * @verify bun run test -- src/http/webhooks.test.ts
     */
    readonly notInTransaction: 'ARKI_JOURNAL_WEBHOOK_E002';
    /** No subscription or message has this id.
     * @fix Check the subscription or message id and use an existing record.
     * @verify bun run test -- src/http/webhooks.test.ts
     */
    readonly notFound: 'ARKI_JOURNAL_WEBHOOK_E003';
    /** `replay` named a message and a subscription of different partners.
     * @fix Replay only to a subscription owned by the same partner as the message.
     * @verify bun run test -- src/http/webhooks.test.ts
     */
    readonly otherPartner: 'ARKI_JOURNAL_WEBHOOK_E004';
    /** `encryptionKey` is not 32 bytes of base64.
     * @fix Configure encryptionKey as a base64-encoded 32-byte key.
     * @verify bun run test -- src/http/webhooks.test.ts
     */
    readonly badEncryptionKey: 'ARKI_JOURNAL_WEBHOOK_E005';
    /** The subscriber answered with a status other than 2xx. The worker retries it.
     * @fix Inspect the subscriber response and restore its successful 2xx handling; let the worker retry delivery.
     * @verify bun run test -- src/http/webhooks.test.ts
     */
    readonly deliveryFailed: 'ARKI_JOURNAL_WEBHOOK_E006';
};
export declare class WebhookError extends Error {
    readonly code: string;
    constructor(code: string, message: string, options?: ErrorOptions);
}
/**
 * The webhook tables. Call this once in the app's schema module, next to `journalTables()`,
 * so `drizzle-kit generate` creates them. The library never creates tables at runtime.
 */
export declare function webhookTables(schema?: PgSchema): {
    subscriptions: import("drizzle-orm/pg-core").PgTableWithColumns<{
        name: "webhook_subscriptions";
        schema: string | undefined;
        columns: {
            id: import("drizzle-orm/pg-core").PgBuildColumn<"webhook_subscriptions", import("drizzle-orm/pg-core").SetIsPrimaryKey<import("drizzle-orm/pg-core").PgVarcharBuilder<[string, ...string[]]>>, {
                name: string;
                tableName: "webhook_subscriptions";
                dataType: "string";
                data: string;
                driverParam: string;
                notNull: true;
                hasDefault: false;
                isPrimaryKey: false;
                isAutoincrement: false;
                hasRuntimeDefault: false;
                enumValues: undefined;
                identity: undefined;
                generated: undefined;
            }>;
            partner: import("drizzle-orm/pg-core").PgBuildColumn<"webhook_subscriptions", import("drizzle-orm/pg-core").SetNotNull<import("drizzle-orm/pg-core").PgVarcharBuilder<[string, ...string[]]>>, {
                name: string;
                tableName: "webhook_subscriptions";
                dataType: "string";
                data: string;
                driverParam: string;
                notNull: true;
                hasDefault: false;
                isPrimaryKey: false;
                isAutoincrement: false;
                hasRuntimeDefault: false;
                enumValues: undefined;
                identity: undefined;
                generated: undefined;
            }>;
            url: import("drizzle-orm/pg-core").PgBuildColumn<"webhook_subscriptions", import("drizzle-orm/pg-core").SetNotNull<import("drizzle-orm/pg-core").PgTextBuilder<[string, ...string[]]>>, {
                name: string;
                tableName: "webhook_subscriptions";
                dataType: "string";
                data: string;
                driverParam: string;
                notNull: true;
                hasDefault: false;
                isPrimaryKey: false;
                isAutoincrement: false;
                hasRuntimeDefault: false;
                enumValues: undefined;
                identity: undefined;
                generated: undefined;
            }>;
            events: import("drizzle-orm/pg-core").PgBuildColumn<"webhook_subscriptions", import("drizzle-orm/pg-core").SetNotNull<import("drizzle-orm/pg-core").SetDimensions<import("drizzle-orm/pg-core").PgTextBuilder<[string, ...string[]]>, 1>>, {
                name: string;
                tableName: "webhook_subscriptions";
                dataType: "string";
                data: string[];
                driverParam: string | string[];
                notNull: true;
                hasDefault: false;
                isPrimaryKey: false;
                isAutoincrement: false;
                hasRuntimeDefault: false;
                enumValues: undefined;
                identity: undefined;
                generated: undefined;
            }>;
            secret: import("drizzle-orm/pg-core").PgBuildColumn<"webhook_subscriptions", import("drizzle-orm/pg-core").SetNotNull<import("drizzle-orm/pg-core").PgTextBuilder<[string, ...string[]]>>, {
                name: string;
                tableName: "webhook_subscriptions";
                dataType: "string";
                data: string;
                driverParam: string;
                notNull: true;
                hasDefault: false;
                isPrimaryKey: false;
                isAutoincrement: false;
                hasRuntimeDefault: false;
                enumValues: undefined;
                identity: undefined;
                generated: undefined;
            }>;
            secretVersion: import("drizzle-orm/pg-core").PgBuildColumn<"webhook_subscriptions", import("drizzle-orm/pg-core").SetHasDefault<import("drizzle-orm/pg-core").SetNotNull<import("drizzle-orm/pg-core").PgIntegerBuilder>>, {
                name: string;
                tableName: "webhook_subscriptions";
                dataType: "number int32";
                data: number;
                driverParam: string | number;
                notNull: true;
                hasDefault: true;
                isPrimaryKey: false;
                isAutoincrement: false;
                hasRuntimeDefault: false;
                enumValues: undefined;
                identity: undefined;
                generated: undefined;
            }>;
            previousSecret: import("drizzle-orm/pg-core").PgBuildColumn<"webhook_subscriptions", import("drizzle-orm/pg-core").PgTextBuilder<[string, ...string[]]>, {
                name: string;
                tableName: "webhook_subscriptions";
                dataType: "string";
                data: string;
                driverParam: string;
                notNull: false;
                hasDefault: false;
                isPrimaryKey: false;
                isAutoincrement: false;
                hasRuntimeDefault: false;
                enumValues: undefined;
                identity: undefined;
                generated: undefined;
            }>;
            previousSecretUntil: import("drizzle-orm/pg-core").PgBuildColumn<"webhook_subscriptions", import("drizzle-orm/pg-core").PgTimestampBuilder, {
                name: string;
                tableName: "webhook_subscriptions";
                dataType: "object date";
                data: Date;
                driverParam: string;
                notNull: false;
                hasDefault: false;
                isPrimaryKey: false;
                isAutoincrement: false;
                hasRuntimeDefault: false;
                enumValues: undefined;
                identity: undefined;
                generated: undefined;
            }>;
            status: import("drizzle-orm/pg-core").PgBuildColumn<"webhook_subscriptions", import("drizzle-orm/pg-core").Set$Type<import("drizzle-orm/pg-core").SetHasDefault<import("drizzle-orm/pg-core").SetNotNull<import("drizzle-orm/pg-core").PgVarcharBuilder<[string, ...string[]]>>>, "active" | "disabled">, {
                name: string;
                tableName: "webhook_subscriptions";
                dataType: "string";
                data: "active" | "disabled";
                driverParam: string;
                notNull: true;
                hasDefault: true;
                isPrimaryKey: false;
                isAutoincrement: false;
                hasRuntimeDefault: false;
                enumValues: undefined;
                identity: undefined;
                generated: undefined;
            }>;
            deadLetters: import("drizzle-orm/pg-core").PgBuildColumn<"webhook_subscriptions", import("drizzle-orm/pg-core").SetHasDefault<import("drizzle-orm/pg-core").SetNotNull<import("drizzle-orm/pg-core").PgIntegerBuilder>>, {
                name: string;
                tableName: "webhook_subscriptions";
                dataType: "number int32";
                data: number;
                driverParam: string | number;
                notNull: true;
                hasDefault: true;
                isPrimaryKey: false;
                isAutoincrement: false;
                hasRuntimeDefault: false;
                enumValues: undefined;
                identity: undefined;
                generated: undefined;
            }>;
            disabledAt: import("drizzle-orm/pg-core").PgBuildColumn<"webhook_subscriptions", import("drizzle-orm/pg-core").PgTimestampBuilder, {
                name: string;
                tableName: "webhook_subscriptions";
                dataType: "object date";
                data: Date;
                driverParam: string;
                notNull: false;
                hasDefault: false;
                isPrimaryKey: false;
                isAutoincrement: false;
                hasRuntimeDefault: false;
                enumValues: undefined;
                identity: undefined;
                generated: undefined;
            }>;
            createdAt: import("drizzle-orm/pg-core").PgBuildColumn<"webhook_subscriptions", import("drizzle-orm/pg-core").SetHasDefault<import("drizzle-orm/pg-core").SetNotNull<import("drizzle-orm/pg-core").PgTimestampBuilder>>, {
                name: string;
                tableName: "webhook_subscriptions";
                dataType: "object date";
                data: Date;
                driverParam: string;
                notNull: true;
                hasDefault: true;
                isPrimaryKey: false;
                isAutoincrement: false;
                hasRuntimeDefault: false;
                enumValues: undefined;
                identity: undefined;
                generated: undefined;
            }>;
        };
        dialect: 'pg';
    }>;
    messages: import("drizzle-orm/pg-core").PgTableWithColumns<{
        name: "webhook_messages";
        schema: string | undefined;
        columns: {
            id: import("drizzle-orm/pg-core").PgBuildColumn<"webhook_messages", import("drizzle-orm/pg-core").SetIsPrimaryKey<import("drizzle-orm/pg-core").PgVarcharBuilder<[string, ...string[]]>>, {
                name: string;
                tableName: "webhook_messages";
                dataType: "string";
                data: string;
                driverParam: string;
                notNull: true;
                hasDefault: false;
                isPrimaryKey: false;
                isAutoincrement: false;
                hasRuntimeDefault: false;
                enumValues: undefined;
                identity: undefined;
                generated: undefined;
            }>;
            partner: import("drizzle-orm/pg-core").PgBuildColumn<"webhook_messages", import("drizzle-orm/pg-core").SetNotNull<import("drizzle-orm/pg-core").PgVarcharBuilder<[string, ...string[]]>>, {
                name: string;
                tableName: "webhook_messages";
                dataType: "string";
                data: string;
                driverParam: string;
                notNull: true;
                hasDefault: false;
                isPrimaryKey: false;
                isAutoincrement: false;
                hasRuntimeDefault: false;
                enumValues: undefined;
                identity: undefined;
                generated: undefined;
            }>;
            event: import("drizzle-orm/pg-core").PgBuildColumn<"webhook_messages", import("drizzle-orm/pg-core").SetNotNull<import("drizzle-orm/pg-core").PgVarcharBuilder<[string, ...string[]]>>, {
                name: string;
                tableName: "webhook_messages";
                dataType: "string";
                data: string;
                driverParam: string;
                notNull: true;
                hasDefault: false;
                isPrimaryKey: false;
                isAutoincrement: false;
                hasRuntimeDefault: false;
                enumValues: undefined;
                identity: undefined;
                generated: undefined;
            }>;
            payload: import("drizzle-orm/pg-core").PgBuildColumn<"webhook_messages", import("drizzle-orm/pg-core").SetNotNull<import("drizzle-orm/pg-core").PgTextBuilder<[string, ...string[]]>>, {
                name: string;
                tableName: "webhook_messages";
                dataType: "string";
                data: string;
                driverParam: string;
                notNull: true;
                hasDefault: false;
                isPrimaryKey: false;
                isAutoincrement: false;
                hasRuntimeDefault: false;
                enumValues: undefined;
                identity: undefined;
                generated: undefined;
            }>;
            createdAt: import("drizzle-orm/pg-core").PgBuildColumn<"webhook_messages", import("drizzle-orm/pg-core").SetHasDefault<import("drizzle-orm/pg-core").SetNotNull<import("drizzle-orm/pg-core").PgTimestampBuilder>>, {
                name: string;
                tableName: "webhook_messages";
                dataType: "object date";
                data: Date;
                driverParam: string;
                notNull: true;
                hasDefault: true;
                isPrimaryKey: false;
                isAutoincrement: false;
                hasRuntimeDefault: false;
                enumValues: undefined;
                identity: undefined;
                generated: undefined;
            }>;
        };
        dialect: 'pg';
    }>;
    attempts: import("drizzle-orm/pg-core").PgTableWithColumns<{
        name: "webhook_attempts";
        schema: string | undefined;
        columns: {
            seq: import("drizzle-orm/pg-core").PgBuildColumn<"webhook_attempts", import("drizzle-orm/pg-core").SetIsPrimaryKey<import("drizzle-orm/pg-core").PgBigSerial53Builder>, {
                name: string;
                tableName: "webhook_attempts";
                dataType: "number int53";
                data: number;
                driverParam: number;
                notNull: true;
                hasDefault: true;
                isPrimaryKey: false;
                isAutoincrement: false;
                hasRuntimeDefault: false;
                enumValues: undefined;
                identity: undefined;
                generated: undefined;
            }>;
            messageId: import("drizzle-orm/pg-core").PgBuildColumn<"webhook_attempts", import("drizzle-orm/pg-core").SetNotNull<import("drizzle-orm/pg-core").PgVarcharBuilder<[string, ...string[]]>>, {
                name: string;
                tableName: "webhook_attempts";
                dataType: "string";
                data: string;
                driverParam: string;
                notNull: true;
                hasDefault: false;
                isPrimaryKey: false;
                isAutoincrement: false;
                hasRuntimeDefault: false;
                enumValues: undefined;
                identity: undefined;
                generated: undefined;
            }>;
            subscriptionId: import("drizzle-orm/pg-core").PgBuildColumn<"webhook_attempts", import("drizzle-orm/pg-core").SetNotNull<import("drizzle-orm/pg-core").PgVarcharBuilder<[string, ...string[]]>>, {
                name: string;
                tableName: "webhook_attempts";
                dataType: "string";
                data: string;
                driverParam: string;
                notNull: true;
                hasDefault: false;
                isPrimaryKey: false;
                isAutoincrement: false;
                hasRuntimeDefault: false;
                enumValues: undefined;
                identity: undefined;
                generated: undefined;
            }>;
            attempt: import("drizzle-orm/pg-core").PgBuildColumn<"webhook_attempts", import("drizzle-orm/pg-core").SetNotNull<import("drizzle-orm/pg-core").PgIntegerBuilder>, {
                name: string;
                tableName: "webhook_attempts";
                dataType: "number int32";
                data: number;
                driverParam: string | number;
                notNull: true;
                hasDefault: false;
                isPrimaryKey: false;
                isAutoincrement: false;
                hasRuntimeDefault: false;
                enumValues: undefined;
                identity: undefined;
                generated: undefined;
            }>;
            status: import("drizzle-orm/pg-core").PgBuildColumn<"webhook_attempts", import("drizzle-orm/pg-core").Set$Type<import("drizzle-orm/pg-core").SetNotNull<import("drizzle-orm/pg-core").PgVarcharBuilder<[string, ...string[]]>>, "dead" | "delivered" | "failed" | "skipped">, {
                name: string;
                tableName: "webhook_attempts";
                dataType: "string";
                data: "dead" | "delivered" | "failed" | "skipped";
                driverParam: string;
                notNull: true;
                hasDefault: false;
                isPrimaryKey: false;
                isAutoincrement: false;
                hasRuntimeDefault: false;
                enumValues: undefined;
                identity: undefined;
                generated: undefined;
            }>;
            responseStatus: import("drizzle-orm/pg-core").PgBuildColumn<"webhook_attempts", import("drizzle-orm/pg-core").PgIntegerBuilder, {
                name: string;
                tableName: "webhook_attempts";
                dataType: "number int32";
                data: number;
                driverParam: string | number;
                notNull: false;
                hasDefault: false;
                isPrimaryKey: false;
                isAutoincrement: false;
                hasRuntimeDefault: false;
                enumValues: undefined;
                identity: undefined;
                generated: undefined;
            }>;
            error: import("drizzle-orm/pg-core").PgBuildColumn<"webhook_attempts", import("drizzle-orm/pg-core").PgTextBuilder<[string, ...string[]]>, {
                name: string;
                tableName: "webhook_attempts";
                dataType: "string";
                data: string;
                driverParam: string;
                notNull: false;
                hasDefault: false;
                isPrimaryKey: false;
                isAutoincrement: false;
                hasRuntimeDefault: false;
                enumValues: undefined;
                identity: undefined;
                generated: undefined;
            }>;
            nextAt: import("drizzle-orm/pg-core").PgBuildColumn<"webhook_attempts", import("drizzle-orm/pg-core").PgTimestampBuilder, {
                name: string;
                tableName: "webhook_attempts";
                dataType: "object date";
                data: Date;
                driverParam: string;
                notNull: false;
                hasDefault: false;
                isPrimaryKey: false;
                isAutoincrement: false;
                hasRuntimeDefault: false;
                enumValues: undefined;
                identity: undefined;
                generated: undefined;
            }>;
            at: import("drizzle-orm/pg-core").PgBuildColumn<"webhook_attempts", import("drizzle-orm/pg-core").SetHasDefault<import("drizzle-orm/pg-core").SetNotNull<import("drizzle-orm/pg-core").PgTimestampBuilder>>, {
                name: string;
                tableName: "webhook_attempts";
                dataType: "object date";
                data: Date;
                driverParam: string;
                notNull: true;
                hasDefault: true;
                isPrimaryKey: false;
                isAutoincrement: false;
                hasRuntimeDefault: false;
                enumValues: undefined;
                identity: undefined;
                generated: undefined;
            }>;
        };
        dialect: 'pg';
    }>;
};
export type WebhookTables = ReturnType<typeof webhookTables>;
/** A transaction: it has `rollback()`, which the root database does not. */
export type WebhookTx = DbHandle & {
    rollback(): never;
};
export type WebhookSenderOptions = {
    readonly tables: Pick<JournalTables, 'jobs'>;
    readonly webhooks: WebhookTables;
    /** 32 random bytes as base64. Seals the signing secrets at rest; keep it out of the database. */
    readonly encryptionKey: string;
    /** Default `publicFetch()` from `@arki/http/public-fetch`: public addresses only, DNS checked and pinned. */
    readonly fetch?: (input: string, init: RequestInit) => Promise<Response>;
    /** One delivery try, in milliseconds. Default 10 000. */
    readonly timeoutMs?: number;
    /** When a failed delivery is tried again, and when it is dead. Default: from 5 s doubling to 1 h, 10 retries. A refused URL is never retried. */
    readonly retry?: Backoff;
    /** Dead deliveries in a row that disable a subscription. Default 5. */
    readonly disableAfter?: number;
    /** The largest body `dispatch` accepts, in bytes. It is sent to every subscriber on every try. Default 1 MiB. */
    readonly maxPayloadBytes?: number;
};
/** A new endpoint: whose events it gets, where, and which ones. */
export type SubscribeInput = {
    readonly partner: string;
    readonly url: string;
    readonly events: readonly string[];
};
/** One event for a partner's subscribers. `payload` must be JSON. */
export type DispatchInput = {
    readonly partner: string;
    readonly event: string;
    readonly payload: unknown;
};
/** The sending side of webhooks. Build it once per app. */
export declare function webhookSender(options: WebhookSenderOptions): {
    /** The runner for `journal.worker(db, { jobs })`; combine it with others through `combineRunners`. */
    runner: {
        names: string[];
        run: (job: ScheduledJob, { db, signal }: {
            readonly db: RootDb;
            readonly signal: AbortSignal;
        }) => Promise<import("@arki/failure").Failure<"contracts.random_source_unavailable", undefined> | import("@arki/failure").Failure<"failure.unexpected_defect", undefined> | import("@arki/failure").Failure<"http.webhook_crypto_unavailable", undefined> | undefined>;
        retryDelay: (job: ScheduledJob, error: unknown) => number | undefined;
    };
    /**
     * Adds an endpoint for a partner's events and returns its signing secret, the only time it
     * is readable: show it to the partner once. The URL must be public https.
     */
    subscribe: (db: DbHandle, input: SubscribeInput) => Promise<{
        id: string;
        secret: string;
    } | IdGenerationFailure>;
    /**
     * Writes the message and one delivery per active subscription of this partner and event, in
     * `tx`. A rollback removes them with the business write. The payload is stored once, as the
     * body `{ type, timestamp, data }` every delivery sends.
     */
    dispatch: (tx: WebhookTx, input: DispatchInput) => Promise<{
        messageId: string;
        deliveries: number;
    } | IdGenerationFailure>;
    /**
     * Sends a stored message again to one subscription of the same partner, with the same
     * `webhook-id`. A disabled subscription records the try as skipped: `enable` it first.
     */
    replay: (db: DbHandle, input: {
        messageId: string;
        subscriptionId: string;
    }) => Promise<{
        jobId: string;
    } | IdGenerationFailure>;
    /**
     * A new signing secret. The old one keeps signing too for `windowSeconds` (default a day),
     * so the partner can switch without dropping a message. Returns the new secret once.
     */
    rotateSecret: (db: DbHandle, subscriptionId: string, rotation?: {
        readonly windowSeconds?: number;
    }) => Promise<{
        secret: string;
    }>;
    /** Turns a subscription back on and clears its dead-letter count. */
    enable: (db: DbHandle, subscriptionId: string) => Promise<void>;
    /** Stops deliveries: new messages skip it, queued ones record `skipped`. */
    disable: (db: DbHandle, subscriptionId: string) => Promise<void>;
};
export type WebhookSender = ReturnType<typeof webhookSender>;
//# sourceMappingURL=webhooks.d.ts.map