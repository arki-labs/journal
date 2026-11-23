import { and, arrayContains, eq, sql } from 'drizzle-orm';
import { bigserial, getTableConfig, index, integer, pgTable, text, timestamp, varchar } from 'drizzle-orm/pg-core';
import { z } from 'zod';
import { defineId } from '@arki/contracts';
import { defineFailure, findCause, InvalidInput, invariant, isFailure, UnexpectedFailure } from '@arki/failure';
import { publicFetch, UnsafeUrl } from '@arki/http/public-fetch';
import { standardWebhooks } from '@arki/http/webhooks';
import { backoff } from '@arki/resilience';
import { parse } from '@arki/schema';
import { jobId } from '../id.js';
import { rollbackOnFailure } from '../rollback.js';
import { dispatchInput, subscribeInput } from './webhook-schemas.js';
const subscriptionId = defineId('whs_');
const webhookMessageId = defineId('msg_');
/**
 * `replay`, `rotateSecret`, `enable` or `disable` named a message or subscription that does not exist.
 * @fix Check the subscription or message id and use an existing record.
 * @verify bun run test -- src/http/webhooks.test.ts
 */
export const WebhookNotFound = /* @__PURE__ */ defineFailure('journal.webhook_not_found', {
    status: 404,
    data: z.object({ kind: z.enum(['message', 'subscription']), id: z.string() }),
    message: 'No webhook {kind} has the id {id}.',
    remediation: 'Check the subscription or message id and use an existing record.',
});
/**
 * `replay` named a message and a subscription of different partners: sending it would leak one
 * partner's data to another.
 * @fix Replay only to a subscription owned by the same partner as the message.
 * @verify bun run test -- src/http/webhooks.test.ts
 */
export const WebhookOtherPartner = /* @__PURE__ */ defineFailure('journal.webhook_other_partner', {
    status: 403,
    data: z.object({ messageId: z.string(), subscriptionId: z.string() }),
    message: 'Message {messageId} and subscription {subscriptionId} belong to different partners.',
    remediation: 'Replay only to a subscription owned by the same partner as the message.',
});
/**
 * The body `dispatch` would store is over `maxPayloadBytes`. It is sent to every subscriber on every try.
 * @fix Send a smaller payload, such as ids the subscriber fetches, or raise maxPayloadBytes.
 * @verify bun run test -- src/http/webhooks.test.ts
 */
export const WebhookPayloadTooLarge = /* @__PURE__ */ defineFailure('journal.webhook_payload_too_large', {
    status: 413,
    data: z.object({ size: z.number().int(), limit: z.number().int() }),
    message: 'The webhook body is {size} bytes, over maxPayloadBytes ({limit}).',
    remediation: 'Send a smaller payload, such as ids the subscriber fetches, or raise maxPayloadBytes.',
});
/**
 * The subscriber answered with a status other than 2xx. The runner throws it as `UnexpectedFailure`, so the
 * worker retries it under `retry`; it never reaches a caller.
 * @fix Inspect the subscriber response and restore its 2xx handling; the worker retries the delivery.
 * @verify bun run test -- src/http/webhooks.test.ts
 */
export const WebhookDeliveryFailed = /* @__PURE__ */ defineFailure('journal.webhook_delivery_failed', {
    status: 502,
    data: z.object({ subscriptionId: z.string(), responseStatus: z.number().int() }),
    message: 'Subscription {subscriptionId} answered {responseStatus}.',
    remediation: 'Inspect the subscriber response and restore its 2xx handling; the worker retries the delivery.',
});
/**
 * A `webhookSender` setting cannot work, such as an `encryptionKey` that is not 32 bytes of base64.
 * Thrown (as `UnexpectedFailure`) when the sender is built at boot, never returned later.
 * @fix Configure encryptionKey as a base64-encoded 32-byte key.
 * @verify bun run test -- src/http/webhooks.test.ts
 */
export const WebhookConfigurationInvalid = /* @__PURE__ */ defineFailure('journal.webhook_configuration_invalid', {
    status: 500,
    data: z.object({ setting: z.string(), problem: z.string() }),
    message: 'Webhook setting {setting} is invalid: {problem}',
    remediation: 'Configure encryptionKey as a base64-encoded 32-byte key.',
});
/**
 * The webhook tables. Call this once in the app's schema module, next to `journalTables()`,
 * so `drizzle-kit generate` creates them. The library never creates tables at runtime.
 */
export function webhookTables(schema) {
    const table = schema === undefined ? pgTable : schema.table;
    const subscriptions = table('webhook_subscriptions', {
        /** `whs_xxx`. */
        id: varchar('id').primaryKey(),
        /** Whose events this endpoint receives: a tenant, an account. `dispatch` matches on it. */
        partner: varchar('partner', { length: 256 }).notNull(),
        url: text('url').notNull(),
        /** The event names it receives, matched exactly. */
        events: text('events').array().notNull(),
        /** The signing secret, sealed with AES-GCM: base64 of IV and ciphertext. Never the plain secret. */
        secret: text('secret').notNull(),
        /** 1, then one more per `rotateSecret`. */
        secretVersion: integer('secret_version').notNull().default(1),
        /** The secret before the last rotation, sealed. Signs too until `previous_secret_until`. */
        previousSecret: text('previous_secret'),
        previousSecretUntil: timestamp('previous_secret_until', { withTimezone: true, mode: 'date' }),
        status: varchar('status', { length: 16 }).notNull().default('active').$type(),
        /** Deliveries that died in a row. A success resets it; `disableAfter` of them disables. */
        deadLetters: integer('dead_letters').notNull().default(0),
        disabledAt: timestamp('disabled_at', { withTimezone: true, mode: 'date' }),
        createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
    }, t => [index('webhook_subscriptions_partner_idx').on(t.partner)]);
    const messages = table('webhook_messages', {
        /** `msg_xxx`. Sent as `webhook-id`, the same on every retry and replay, so receivers dedupe on it. */
        id: varchar('id').primaryKey(),
        partner: varchar('partner', { length: 256 }).notNull(),
        event: varchar('event', { length: 128 }).notNull(),
        /** The exact body every delivery sends and signs, written once. */
        payload: text('payload').notNull(),
        createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
    });
    const attempts = table('webhook_attempts', {
        seq: bigserial('seq', { mode: 'number' }).primaryKey(),
        messageId: varchar('message_id')
            .notNull()
            .references(() => messages.id),
        subscriptionId: varchar('subscription_id')
            .notNull()
            .references(() => subscriptions.id),
        /** The worker's try number for this delivery job, 1 first. */
        attempt: integer('attempt').notNull(),
        /** `failed` will be retried at `next_at`; `dead` will not; `skipped`: the subscription was disabled. */
        status: varchar('status', { length: 16 }).notNull().$type(),
        responseStatus: integer('response_status'),
        error: text('error'),
        nextAt: timestamp('next_at', { withTimezone: true, mode: 'date' }),
        at: timestamp('at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
    }, t => [index('webhook_attempts_message_id_idx').on(t.messageId)]);
    return { subscriptions, messages, attempts };
}
const DELIVER_JOB = 'webhook.deliver.v1';
const WAKE_PAYLOAD = '{"queue":1}';
const KEY_BYTES = 32;
const IV_BYTES = 12;
const ERROR_TEXT_LIMIT = 1000;
const deliveryArgs = z.object({ messageId: z.string(), subscriptionId: z.string() });
const encoder = new TextEncoder();
const decoder = new TextDecoder();
const toBase64 = (bytes) => btoa(Array.from(bytes, byte => String.fromCodePoint(byte)).join(''));
const fromBase64 = (text) => Uint8Array.from(atob(text), char => char.codePointAt(0) ?? 0);
const errorText = (error) => (isFailure(error) ? error.code : error instanceof Error ? error.message : String(error)).slice(0, ERROR_TEXT_LIMIT);
/** `undefined` when the update touched the subscription, else the failure that names it. */
const subscriptionFound = (updated, id) => updated.length === 0 ? WebhookNotFound({ kind: 'subscription', id }) : undefined;
/** Each secret signs the same id and time; Standard Webhooks sends the signatures space-separated. */
const signedHeaders = async (secrets, id, payload) => {
    const timestamp = Math.floor(Date.now() / 1000);
    const signed = [];
    for (const secret of secrets) {
        const headers = await standardWebhooks({ secrets: [secret] }).sign(payload, { id, timestamp });
        if (isFailure(headers))
            return headers;
        signed.push(headers);
    }
    return {
        'content-type': 'application/json',
        'webhook-id': id,
        'webhook-timestamp': String(timestamp),
        'webhook-signature': signed.flatMap(headers => headers.get('webhook-signature') ?? []).join(' '),
    };
};
/** The sending side of webhooks. Build it once per app. */
export function webhookSender(options) {
    const { subscriptions, messages, attempts } = options.webhooks;
    const { jobs } = options.tables;
    const send = options.fetch ?? publicFetch();
    const timeoutMs = options.timeoutMs ?? 10_000;
    const retry = options.retry ?? backoff.exponential({ base: 5000, max: 3_600_000, jitter: 0.25 }).upTo(10);
    /** The wait before the next try, or `undefined` for dead. A refused URL is dead whatever `retry` says. */
    const nextDelay = (attempt, error) => findCause(error, UnsafeUrl) === undefined ? retry.delay(attempt, error) : undefined;
    const disableAfter = options.disableAfter ?? 5;
    const maxPayloadBytes = options.maxPayloadBytes ?? 1_048_576;
    // The journal's wake channel: every journal worker of this table hears it.
    const tableSchema = getTableConfig(jobs).schema;
    const channel = tableSchema === undefined ? 'journal_wake' : `${tableSchema}_journal_wake`;
    let keyBytes;
    try {
        keyBytes = fromBase64(options.encryptionKey);
    }
    catch {
        keyBytes = new Uint8Array(0);
    }
    if (keyBytes.length !== KEY_BYTES) {
        // A configuration fault: the app cannot start sending, so it fails at boot.
        throw new UnexpectedFailure(WebhookConfigurationInvalid({ setting: 'encryptionKey', problem: `must be ${KEY_BYTES} bytes of base64` }));
    }
    let imported;
    const aesKey = () => (imported ??= crypto.subtle.importKey('raw', keyBytes, 'AES-GCM', false, ['encrypt', 'decrypt']));
    /** The subscription id is the associated data: a sealed secret copied onto another row does not open. */
    const seal = async (subscriptionId, plain) => {
        const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES));
        const sealed = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv, additionalData: encoder.encode(subscriptionId) }, await aesKey(), encoder.encode(plain)));
        const out = new Uint8Array(IV_BYTES + sealed.length);
        out.set(iv);
        out.set(sealed, IV_BYTES);
        return toBase64(out);
    };
    const open = async (subscriptionId, sealedText) => {
        const bytes = fromBase64(sealedText);
        const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: bytes.slice(0, IV_BYTES), additionalData: encoder.encode(subscriptionId) }, await aesKey(), bytes.slice(IV_BYTES));
        return decoder.decode(plain);
    };
    const newSecret = () => `whsec_${toBase64(crypto.getRandomValues(new Uint8Array(KEY_BYTES)))}`;
    const enqueue = async (db, messageId, subscriptionIds) => {
        if (subscriptionIds.length === 0)
            return [];
        const rows = [];
        const ids = [];
        for (const subscriptionId of subscriptionIds) {
            const id = jobId();
            if (isFailure(id))
                return id;
            ids.push(id);
            rows.push({ id, kind: 'queue', jobName: DELIVER_JOB, args: { messageId, subscriptionId } });
        }
        await db.insert(jobs).values(rows);
        // Delivered at commit, dropped on rollback.
        await db.execute(sql `select pg_notify(${channel}, ${WAKE_PAYLOAD})`);
        return ids;
    };
    /** A failed try: retried later, or dead. A dead one counts toward disabling the subscription. */
    const recordFailure = async (db, job, delivery, responseStatus, error) => {
        const delay = nextDelay(job.attempt, error);
        await db.insert(attempts).values({
            ...delivery,
            attempt: job.attempt,
            status: delay === undefined ? 'dead' : 'failed',
            responseStatus: responseStatus ?? null,
            error: errorText(error),
            nextAt: delay === undefined ? null : new Date(Date.now() + delay),
        });
        if (delay !== undefined)
            return;
        // One statement, so two workers finishing at once still count both and disable once.
        const reached = sql `${subscriptions.deadLetters} + 1 >= ${disableAfter}`;
        await db
            .update(subscriptions)
            .set({
            deadLetters: sql `${subscriptions.deadLetters} + 1`,
            status: sql `case when ${reached} then 'disabled' else ${subscriptions.status} end`,
            disabledAt: sql `case when ${reached} then coalesce(${subscriptions.disabledAt}, now()) else ${subscriptions.disabledAt} end`,
        })
            .where(eq(subscriptions.id, delivery.subscriptionId));
    };
    const runner = {
        names: [DELIVER_JOB],
        run: async (job, { db, signal }) => {
            const delivery = deliveryArgs.parse(job.args);
            const [message] = await db
                .select({ payload: messages.payload })
                .from(messages)
                .where(eq(messages.id, delivery.messageId));
            const [subscription] = await db
                .select({
                url: subscriptions.url,
                status: subscriptions.status,
                secret: subscriptions.secret,
                previousSecret: subscriptions.previousSecret,
                previousSecretUntil: subscriptions.previousSecretUntil,
            })
                .from(subscriptions)
                .where(eq(subscriptions.id, delivery.subscriptionId));
            // Deleted on purpose: there is nothing left to send.
            if (message === undefined || subscription === undefined)
                return;
            if (subscription.status !== 'active') {
                await db.insert(attempts).values({ ...delivery, attempt: job.attempt, status: 'skipped' });
                return;
            }
            const secrets = [await open(delivery.subscriptionId, subscription.secret)];
            const { previousSecret, previousSecretUntil } = subscription;
            if (previousSecret !== null && previousSecretUntil !== null && previousSecretUntil > new Date()) {
                secrets.push(await open(delivery.subscriptionId, previousSecret));
            }
            const headers = await signedHeaders(secrets, delivery.messageId, message.payload);
            if (isFailure(headers)) {
                await recordFailure(db, job, delivery, undefined, headers);
                return headers;
            }
            let response;
            try {
                response = await send(subscription.url, {
                    method: 'POST',
                    headers,
                    body: message.payload,
                    signal: AbortSignal.any([signal, AbortSignal.timeout(timeoutMs)]),
                });
            }
            catch (error) {
                await recordFailure(db, job, delivery, undefined, error);
                throw error;
            }
            // Only the status matters; free the connection.
            await response.body?.cancel().catch(() => null);
            if (response.ok) {
                await db.insert(attempts).values({
                    ...delivery,
                    attempt: job.attempt,
                    status: 'delivered',
                    responseStatus: response.status,
                });
                await db.update(subscriptions).set({ deadLetters: 0 }).where(eq(subscriptions.id, delivery.subscriptionId));
                return;
            }
            // Thrown, not returned: `retry` retries thrown errors, and retries a returned failure only when told to.
            const failed = new UnexpectedFailure(WebhookDeliveryFailed({ subscriptionId: delivery.subscriptionId, responseStatus: response.status }));
            await recordFailure(db, job, delivery, response.status, failed);
            throw failed;
        },
        retryDelay: (job, error) => nextDelay(job.attempt, error),
    };
    return {
        /** The runner for `journal.worker(db, { jobs })`; combine it with others through `combineRunners`. */
        runner,
        /**
         * Adds an endpoint for a partner's events and returns its signing secret, the only time it
         * is readable: show it to the partner once. The URL must be public https: anything else, and
         * input that fails its schema, returns `InvalidInput` with the issues.
         */
        subscribe: async (db, input) => {
            const parsed = parse(subscribeInput, input);
            if (isFailure(parsed))
                return parsed;
            const { partner, url, events } = parsed;
            const id = subscriptionId.create();
            if (isFailure(id))
                return id;
            const secret = newSecret();
            await db.insert(subscriptions).values({ id, partner, url, events: [...events], secret: await seal(id, secret) });
            return { id, secret };
        },
        /**
         * Writes the message and one delivery per active subscription of this partner and event, in
         * `tx`. A rollback removes them with the business write. The payload is stored once, as the
         * body `{ type, timestamp, data }` every delivery sends. Input that fails its schema or a payload
         * that is not JSON returns `InvalidInput`; a body over `maxPayloadBytes` returns `WebhookPayloadTooLarge`.
         */
        dispatch: async (tx, input) => {
            // The type already refuses the root database; this catches untyped callers. A caller bug, so it throws.
            invariant(typeof Reflect.get(tx, 'rollback') === 'function', 'webhooks: dispatch got the root database; pass the business transaction, so the message commits with it');
            const parsed = parse(dispatchInput, input);
            if (isFailure(parsed))
                return parsed;
            const { partner, event, payload } = parsed;
            let body;
            try {
                body = JSON.stringify({ type: event, timestamp: new Date().toISOString(), data: payload });
            }
            catch (error) {
                // A bigint or a cycle: the payload has no JSON form to store and sign.
                return InvalidInput({ issues: [{ message: `The payload is not JSON: ${errorText(error)}`, path: ['payload'] }] });
            }
            const size = encoder.encode(body).length;
            if (size > maxPayloadBytes)
                return WebhookPayloadTooLarge({ size, limit: maxPayloadBytes });
            const messageId = webhookMessageId.create();
            if (isFailure(messageId))
                return messageId;
            const refusal = rollbackOnFailure();
            return tx
                .transaction(async (tx) => {
                await tx.insert(messages).values({ id: messageId, partner, event, payload: body });
                const targets = await tx
                    .select({ id: subscriptions.id })
                    .from(subscriptions)
                    .where(and(eq(subscriptions.partner, partner), eq(subscriptions.status, 'active'), arrayContains(subscriptions.events, [event])));
                const queued = await enqueue(tx, messageId, targets.map(target => target.id));
                if (isFailure(queued))
                    return refusal.settle(queued);
                return { messageId, deliveries: queued.length };
            })
                .catch(refusal.recover);
        },
        /**
         * Sends a stored message again to one subscription of the same partner, with the same
         * `webhook-id`. A disabled subscription records the try as skipped: `enable` it first.
         * An unknown id returns `WebhookNotFound`; a subscription of another partner, `WebhookOtherPartner`.
         */
        replay: async (db, input) => {
            const [message] = await db
                .select({ partner: messages.partner })
                .from(messages)
                .where(eq(messages.id, input.messageId));
            if (message === undefined)
                return WebhookNotFound({ kind: 'message', id: input.messageId });
            const [subscription] = await db
                .select({ partner: subscriptions.partner })
                .from(subscriptions)
                .where(eq(subscriptions.id, input.subscriptionId));
            if (subscription === undefined)
                return WebhookNotFound({ kind: 'subscription', id: input.subscriptionId });
            if (message.partner !== subscription.partner)
                return WebhookOtherPartner({ messageId: input.messageId, subscriptionId: input.subscriptionId });
            const result = await enqueue(db, input.messageId, [input.subscriptionId]);
            if (isFailure(result))
                return result;
            const [queued] = result;
            invariant(queued !== undefined, 'webhooks: enqueue of one subscription returned no job id');
            return { jobId: queued };
        },
        /**
         * A new signing secret. The old one keeps signing too for `windowSeconds` (default a day),
         * so the partner can switch without dropping a message. Returns the new secret once, or
         * `WebhookNotFound` for an unknown id.
         */
        rotateSecret: async (db, subscriptionId, rotation = {}) => {
            const windowSeconds = rotation.windowSeconds ?? 86_400;
            const secret = newSecret();
            const updated = await db
                .update(subscriptions)
                .set({
                // The right side reads the row before this update: the current secret becomes the previous one.
                previousSecret: sql `${subscriptions.secret}`,
                previousSecretUntil: sql `now() + make_interval(secs => ${windowSeconds})`,
                secret: await seal(subscriptionId, secret),
                secretVersion: sql `${subscriptions.secretVersion} + 1`,
            })
                .where(eq(subscriptions.id, subscriptionId))
                .returning({ id: subscriptions.id });
            return subscriptionFound(updated, subscriptionId) ?? { secret };
        },
        /** Turns a subscription back on and clears its dead-letter count. `WebhookNotFound` for an unknown id. */
        enable: async (db, subscriptionId) => {
            const updated = await db
                .update(subscriptions)
                .set({ status: 'active', deadLetters: 0, disabledAt: null })
                .where(eq(subscriptions.id, subscriptionId))
                .returning({ id: subscriptions.id });
            return subscriptionFound(updated, subscriptionId);
        },
        /** Stops deliveries: new messages skip it, queued ones record `skipped`. `WebhookNotFound` for an unknown id. */
        disable: async (db, subscriptionId) => {
            const updated = await db
                .update(subscriptions)
                .set({ status: 'disabled', disabledAt: sql `coalesce(${subscriptions.disabledAt}, now())` })
                .where(eq(subscriptions.id, subscriptionId))
                .returning({ id: subscriptions.id });
            return subscriptionFound(updated, subscriptionId);
        },
    };
}
//# sourceMappingURL=webhooks.js.map