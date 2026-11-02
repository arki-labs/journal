/**
 * The schema that reads `dot explain --as journal-flow`'s graph back from untyped manifest JSON.
 * Internal: the types in `projection.ts` are the source, and `projection.test-d.ts` locks this
 * schema to them with an exact two-way type test.
 */
import { z } from 'zod';
/** The graph, as `JournalFlowGraph` types it. */
export declare const journalFlowGraphSchema: z.ZodReadonly<z.ZodObject<{
    nodes: z.ZodArray<z.ZodDiscriminatedUnion<[z.ZodReadonly<z.ZodObject<{
        id: z.ZodString;
        name: z.ZodString;
        kind: z.ZodLiteral<"event">;
    }, z.core.$strip>>, z.ZodReadonly<z.ZodObject<{
        id: z.ZodString;
        name: z.ZodString;
        kind: z.ZodLiteral<"entity">;
        table: z.ZodString;
    }, z.core.$strip>>, z.ZodReadonly<z.ZodObject<{
        id: z.ZodString;
        name: z.ZodString;
        kind: z.ZodLiteral<"projection">;
        lane: z.ZodEnum<{
            async: "async";
            inline: "inline";
        }>;
    }, z.core.$strip>>, z.ZodReadonly<z.ZodObject<{
        id: z.ZodString;
        name: z.ZodString;
        kind: z.ZodLiteral<"effect">;
        deps: z.ZodArray<z.ZodString>;
        retry: z.ZodReadonly<z.ZodObject<{
            policy: z.ZodEnum<{
                custom: "custom";
                default: "default";
            }>;
            maxRetries: z.ZodNullable<z.ZodNumber>;
        }, z.core.$strip>>;
    }, z.core.$strip>>, z.ZodReadonly<z.ZodObject<{
        id: z.ZodString;
        name: z.ZodString;
        kind: z.ZodLiteral<"tap">;
        deps: z.ZodArray<z.ZodString>;
    }, z.core.$strip>>, z.ZodReadonly<z.ZodObject<{
        id: z.ZodString;
        name: z.ZodString;
        kind: z.ZodLiteral<"workflow">;
        version: z.ZodNumber;
        deps: z.ZodArray<z.ZodString>;
        signals: z.ZodArray<z.ZodString>;
    }, z.core.$strip>>, z.ZodReadonly<z.ZodObject<{
        id: z.ZodString;
        name: z.ZodString;
        kind: z.ZodLiteral<"feature">;
    }, z.core.$strip>>], "kind">>;
    edges: z.ZodArray<z.ZodReadonly<z.ZodObject<{
        kind: z.ZodEnum<{
            folds: "folds";
            "owned-by": "owned-by";
            projects: "projects";
            reacts: "reacts";
        }>;
        from: z.ZodString;
        to: z.ZodString;
        timing: z.ZodOptional<z.ZodEnum<{
            "after-commit": "after-commit";
            "same-transaction": "same-transaction";
        }>>;
        delivery: z.ZodOptional<z.ZodEnum<{
            "at-least-once": "at-least-once";
            "at-most-once": "at-most-once";
            "exactly-once": "exactly-once";
        }>>;
    }, z.core.$strip>>>;
}, z.core.$strip>>;
//# sourceMappingURL=journal-flow-schema.d.ts.map