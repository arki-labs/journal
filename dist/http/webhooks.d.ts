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
/**
 * `replay`, `rotateSecret`, `enable` or `disable` named a message or subscription that does not exist.
 * @fix Check the subscription or message id and use an existing record.
 * @verify bun run test -- src/http/webhooks.test.ts
 */
export declare const WebhookNotFound: import("@arki/failure").FailureDefinition<"journal.webhook_not_found", import("@standard-schema/spec").StandardSchemaV1<{
    kind: "message" | "subscription";
    id: string;
}, {
    kind: "message" | "subscription";
    id: string;
}>>;
/**
 * `replay` named a message and a subscription of different partners: sending it would leak one
 * partner's data to another.
 * @fix Replay only to a subscription owned by the same partner as the message.
 * @verify bun run test -- src/http/webhooks.test.ts
 */
export declare const WebhookOtherPartner: import("@arki/failure").FailureDefinition<"journal.webhook_other_partner", import("@standard-schema/spec").StandardSchemaV1<{
    messageId: string;
    subscriptionId: string;
}, {
    messageId: string;
    subscriptionId: string;
}>>;
/**
 * The body `dispatch` would store is over `maxPayloadBytes`. It is sent to every subscriber on every try.
 * @fix Send a smaller payload, such as ids the subscriber fetches, or raise maxPayloadBytes.
 * @verify bun run test -- src/http/webhooks.test.ts
 */
export declare const WebhookPayloadTooLarge: import("@arki/failure").FailureDefinition<"journal.webhook_payload_too_large", import("@standard-schema/spec").StandardSchemaV1<{
    size: number;
    limit: number;
}, {
    size: number;
    limit: number;
}>>;
/**
 * The subscriber answered with a status other than 2xx. The runner throws it as `UnexpectedFailure`, so the
 * worker retries it under `retry`; it never reaches a caller.
 * @fix Inspect the subscriber response and restore its 2xx handling; the worker retries the delivery.
 * @verify bun run test -- src/http/webhooks.test.ts
 */
export declare const WebhookDeliveryFailed: import("@arki/failure").FailureDefinition<"journal.webhook_delivery_failed", import("@standard-schema/spec").StandardSchemaV1<{
    subscriptionId: string;
    responseStatus: number;
}, {
    subscriptionId: string;
    responseStatus: number;
}>>;
/**
 * A `webhookSender` setting cannot work, such as an `encryptionKey` that is not 32 bytes of base64.
 * Thrown (as `UnexpectedFailure`) when the sender is built at boot, never returned later.
 * @fix Configure encryptionKey as a base64-encoded 32-byte key.
 * @verify bun run test -- src/http/webhooks.test.ts
 */
export declare const WebhookConfigurationInvalid: import("@arki/failure").FailureDefinition<"journal.webhook_configuration_invalid", import("@standard-schema/spec").StandardSchemaV1<{
    setting: string;
    problem: string;
}, {
    setting: string;
    problem: string;
}>>;
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
/** A new endpoint: whose events it gets, where (public https), and which ones. `webhook-schemas.ts` checks it. */
export type SubscribeInput = {
    readonly partner: string;
    readonly url: string;
    readonly events: readonly string[];
};
/** One event for a partner's subscribers. `payload` must be JSON. `webhook-schemas.ts` checks it. */
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
     * is readable: show it to the partner once. The URL must be public https: anything else, and
     * input that fails its schema, returns `InvalidInput` with the issues.
     */
    subscribe: (db: DbHandle, input: SubscribeInput) => Promise<import("@arki/failure").Failure<"contracts.random_source_unavailable", undefined> | import("@arki/failure").Failure<"failure.unexpected_defect", undefined> | import("@arki/failure").Failure<"schema.async_required", undefined> | import("@arki/failure").Failure<"schema.invalid_input", {
        issues: readonly import("@standard-schema/spec").StandardSchemaV1.Issue[];
    }> | import("@arki/failure").Failure<"schema.validator_defect", undefined> | {
        id: `whs_${string}`;
        secret: string;
    }>;
    /**
     * Writes the message and one delivery per active subscription of this partner and event, in
     * `tx`. A rollback removes them with the business write. The payload is stored once, as the
     * body `{ type, timestamp, data }` every delivery sends. Input that fails its schema or a payload
     * that is not JSON returns `InvalidInput`; a body over `maxPayloadBytes` returns `WebhookPayloadTooLarge`.
     */
    dispatch: (tx: WebhookTx, input: DispatchInput) => Promise<import("@arki/failure").Failure<"journal.webhook_payload_too_large", {
        size: number;
        limit: number;
    }> | import("@arki/failure").Failure<"schema.async_required", undefined> | import("@arki/failure").Failure<"schema.invalid_input", {
        issues: readonly import("@standard-schema/spec").StandardSchemaV1.Issue[];
    }> | import("@arki/failure").Failure<"schema.validator_defect", undefined> | {
        messageId: string;
        deliveries: number;
    } | IdGenerationFailure>;
    /**
     * Sends a stored message again to one subscription of the same partner, with the same
     * `webhook-id`. A disabled subscription records the try as skipped: `enable` it first.
     * An unknown id returns `WebhookNotFound`; a subscription of another partner, `WebhookOtherPartner`.
     */
    replay: (db: DbHandle, input: {
        messageId: string;
        subscriptionId: string;
    }) => Promise<import("@arki/failure").Failure<"contracts.random_source_unavailable", undefined> | import("@arki/failure").Failure<"failure.unexpected_defect", undefined> | import("@arki/failure").Failure<"journal.webhook_not_found", {
        kind: "message" | "subscription";
        id: string;
    }> | import("@arki/failure").Failure<"journal.webhook_other_partner", {
        messageId: string;
        subscriptionId: string;
    }> | {
        jobId: string;
    }>;
    /**
     * A new signing secret. The old one keeps signing too for `windowSeconds` (default a day),
     * so the partner can switch without dropping a message. Returns the new secret once, or
     * `WebhookNotFound` for an unknown id.
     */
    rotateSecret: (db: DbHandle, subscriptionId: string, rotation?: {
        readonly windowSeconds?: number;
    }) => Promise<import("@arki/failure").Failure<"journal.webhook_not_found", {
        kind: "message" | "subscription";
        id: string;
    }> | {
        secret: string;
    }>;
    /** Turns a subscription back on and clears its dead-letter count. `WebhookNotFound` for an unknown id. */
    enable: (db: DbHandle, subscriptionId: string) => Promise<import("@arki/failure").Failure<"journal.webhook_not_found", {
        kind: "message" | "subscription";
        id: string;
    }> | undefined>;
    /** Stops deliveries: new messages skip it, queued ones record `skipped`. `WebhookNotFound` for an unknown id. */
    disable: (db: DbHandle, subscriptionId: string) => Promise<import("@arki/failure").Failure<"journal.webhook_not_found", {
        kind: "message" | "subscription";
        id: string;
    }> | undefined>;
};
export type WebhookSender = ReturnType<typeof webhookSender>;
//# sourceMappingURL=webhooks.d.ts.map