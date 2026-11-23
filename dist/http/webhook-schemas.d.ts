/**
 * The input schemas of the webhook sender. Internal: `webhooks.ts` parses `subscribe` and `dispatch` input
 * with them. The TS types (`SubscribeInput`, `DispatchInput`) are the source; `webhook-schemas.test-d.ts` locks
 * each schema to its type both ways. They live apart so `./http/webhooks` names no Zod type (`TYPES_E001`).
 */
import { z } from 'zod';
/** A `SubscribeInput`. */
export declare const subscribeInput: z.ZodReadonly<z.ZodObject<{
    partner: z.ZodString;
    url: z.ZodURL;
    events: z.ZodReadonly<z.ZodArray<z.ZodString>>;
}, z.core.$strip>>;
/** A `DispatchInput`. */
export declare const dispatchInput: z.ZodReadonly<z.ZodObject<{
    partner: z.ZodString;
    event: z.ZodString;
    payload: z.ZodUnknown;
}, z.core.$strip>>;
//# sourceMappingURL=webhook-schemas.d.ts.map