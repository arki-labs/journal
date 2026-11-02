/**
 * `@arki/journal/zod`: the Zod schemas that decode what the journal stores, such as a job's
 * `args` or a log position. The types are written where they belong (`StoredEventRow` and
 * `ForwardArgs` in `pg`, `EventLogPosition` in `event-log`); `zod.test-d.ts` locks each schema
 * to its type both ways. Public types never name Zod, so the schemas live in this entry only.
 */
import { z } from 'zod';
import type { EventLogPosition } from './event-log.js';
/**
 * A `journal_events` row as an effect job's `args` holds it: the row the write inserted, after the
 * jsonb round trip. Its output is exactly `StoredEventRow`, so the worker decodes the copy as it
 * would decode the stored row. The schema only brings the timestamps back from their JSON strings.
 */
export declare const storedEventRowSchema: z.ZodObject<{
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
/** A `forward` job's `args`. Written by the writer, so a parse failure is a library bug. */
export declare const forwardArgsSchema: z.ZodObject<{
    events: z.ZodArray<z.ZodObject<{
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
    }, z.core.$strip>>;
}, z.core.$strip>;
/**
 * A log position: any non-empty text a log made. The brand is the type's own, so the check is a
 * schema and the brand comes from `z.custom`, never from a cast at a call site.
 */
export declare const eventLogPositionSchema: z.ZodCustom<EventLogPosition, EventLogPosition>;
//# sourceMappingURL=zod.d.ts.map