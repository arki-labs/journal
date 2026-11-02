/**
 * The schemas that check the run fields, timing, overrides and run changes, plus the stored result of an event wait.
 * The run field types are the source, in the Zod-free `run-fields.ts` that public signatures name (A-43);
 * `schemas.test-d.ts` locks each schema to its type both ways. Only the runner, the run machine and the private body
 * of `define.ts` use these, so no public `.d.ts` reaches this file.
 */
import { z } from 'zod';
/**
 * Checks the shape of the run fields. The size of `metadata` is checked when the run starts, with its JSON form,
 * like the input.
 */
export declare const runFieldsSchema: z.ZodReadonly<z.ZodObject<{
    scope: z.ZodOptional<z.ZodString>;
    tags: z.ZodOptional<z.ZodReadonly<z.ZodArray<z.ZodString>>>;
    metadata: z.ZodOptional<z.ZodReadonly<z.ZodRecord<z.ZodString, z.ZodUnknown>>>;
}, z.core.$strip>>;
/** A wait before a run starts: an age, 0 or more. */
export declare const delayAgeSchema: z.ZodUnion<readonly [z.ZodNumber, z.ZodTemplateLiteral<`${number}d` | `${number}h` | `${number}m`>]>;
/** How long a run may wait to start: an age longer than 0. */
export declare const ttlAgeSchema: z.ZodUnion<readonly [z.ZodNumber, z.ZodTemplateLiteral<`${number}d` | `${number}h` | `${number}m`>]>;
/** Checks `RunTiming`. The type is the source; `schemas.test-d.ts` locks this schema to it both ways. */
export declare const runTimingSchema: z.ZodReadonly<z.ZodObject<{
    delay: z.ZodOptional<z.ZodUnion<readonly [z.ZodUnion<readonly [z.ZodNumber, z.ZodTemplateLiteral<`${number}d` | `${number}h` | `${number}m`>]>, z.ZodDate]>>;
    ttl: z.ZodOptional<z.ZodUnion<readonly [z.ZodNumber, z.ZodTemplateLiteral<`${number}d` | `${number}h` | `${number}m`>]>>;
}, z.core.$strip>>;
/** Checks `RunOverrides`. The type is the source; `schemas.test-d.ts` locks this schema to it both ways. */
export declare const runOverridesSchema: z.ZodReadonly<z.ZodObject<{
    maxAttempts: z.ZodOptional<z.ZodInt>;
    timeout: z.ZodOptional<z.ZodUnion<readonly [z.ZodNumber, z.ZodTemplateLiteral<`${number}d` | `${number}h` | `${number}m`>]>>;
    priority: z.ZodOptional<z.ZodInt32>;
}, z.core.$strip>>;
/** Checks a `MetadataChange`. The type is the source; `schemas.test-d.ts` locks this schema to it both ways. */
export declare const metadataChangeSchema: z.ZodReadonly<z.ZodDiscriminatedUnion<[z.ZodObject<{
    kind: z.ZodLiteral<"set">;
    patch: z.ZodReadonly<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
}, z.core.$strip>, z.ZodObject<{
    kind: z.ZodLiteral<"increment">;
    key: z.ZodString;
    by: z.ZodNumber;
}, z.core.$strip>, z.ZodObject<{
    kind: z.ZodLiteral<"append">;
    key: z.ZodString;
    value: z.ZodUnknown;
}, z.core.$strip>, z.ZodObject<{
    kind: z.ZodLiteral<"remove">;
    key: z.ZodString;
}, z.core.$strip>], "kind">>;
/** Checks the tags `ctx.tags.add` and `journal.workflows.addTags` take: at least one, each as at start. */
export declare const addedTagsSchema: z.ZodReadonly<z.ZodArray<z.ZodString>>;
/**
 * What an event wait stores as its result: the label that took the event and the `seq` of the event's log row. The run
 * keeps no copy of the event, so erasing the event in the log (`forget`) erases it for every run that took it.
 */
export declare const waitPointerSchema: z.ZodObject<{
    via: z.ZodString;
    seq: z.ZodInt;
}, z.core.$strip>;
/** The result an event wait gives a body: the label and the log row, in its JSON form. It is read from the log, never stored. */
export declare const storedWaitResultSchema: z.ZodObject<{
    via: z.ZodString;
    event: z.ZodObject<{
        seq: z.ZodInt;
        id: z.ZodString;
        kind: z.ZodString;
        entityId: z.ZodString;
        version: z.ZodInt;
        type: z.ZodString;
        data: z.ZodUnknown;
        meta: z.ZodUnknown;
        recordedAt: z.ZodCodec<z.ZodISODateTime, z.ZodDate>;
        commandId: z.ZodNullable<z.ZodString>;
        causeSeq: z.ZodNullable<z.ZodInt>;
        correlationId: z.ZodNullable<z.ZodString>;
        erasedAt: z.ZodNullable<z.ZodCodec<z.ZodISODateTime, z.ZodDate>>;
        schemaVersion: z.ZodInt;
    }, z.core.$strip>;
}, z.core.$strip>;
//# sourceMappingURL=run-field-schemas.d.ts.map