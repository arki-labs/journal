/**
 * The schemas that read `dot explain --as event-map`'s graph back from untyped JSON (the manifest's
 * meta, and the `--json` document).
 * Internal: the types in `projection.ts` are the source, and `projection.test-d.ts` locks these
 * schemas to them with an exact two-way type test.
 */
import { z } from 'zod';
/** The graph, as `EventMapGraph` types it. */
export declare const eventMapGraphSchema: z.ZodReadonly<z.ZodObject<{
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
        opaqueSteps: z.ZodArray<z.ZodString>;
    }, z.core.$strip>>, z.ZodReadonly<z.ZodObject<{
        id: z.ZodString;
        name: z.ZodString;
        kind: z.ZodLiteral<"feature">;
    }, z.core.$strip>>, z.ZodReadonly<z.ZodObject<{
        id: z.ZodString;
        name: z.ZodString;
        kind: z.ZodLiteral<"command">;
    }, z.core.$strip>>, z.ZodReadonly<z.ZodObject<{
        id: z.ZodString;
        name: z.ZodString;
        kind: z.ZodLiteral<"entrypoint">;
        feature: z.ZodString;
        file: z.ZodString;
    }, z.core.$strip>>], "kind">>;
    edges: z.ZodArray<z.ZodReadonly<z.ZodObject<{
        kind: z.ZodEnum<{
            calls: "calls";
            folds: "folds";
            "owned-by": "owned-by";
            projects: "projects";
            reacts: "reacts";
            runs: "runs";
            "waits-for": "waits-for";
            writes: "writes";
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
        node: z.ZodOptional<z.ZodString>;
        label: z.ZodOptional<z.ZodString>;
        undo: z.ZodOptional<z.ZodLiteral<true>>;
    }, z.core.$strip>>>;
}, z.core.$strip>>;
/** What `journal({ j })` puts in the manifest: the graph and where the entrypoint scan looks. */
export declare const eventMapMetaSchema: z.ZodReadonly<z.ZodObject<{
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
        opaqueSteps: z.ZodArray<z.ZodString>;
    }, z.core.$strip>>, z.ZodReadonly<z.ZodObject<{
        id: z.ZodString;
        name: z.ZodString;
        kind: z.ZodLiteral<"feature">;
    }, z.core.$strip>>, z.ZodReadonly<z.ZodObject<{
        id: z.ZodString;
        name: z.ZodString;
        kind: z.ZodLiteral<"command">;
    }, z.core.$strip>>, z.ZodReadonly<z.ZodObject<{
        id: z.ZodString;
        name: z.ZodString;
        kind: z.ZodLiteral<"entrypoint">;
        feature: z.ZodString;
        file: z.ZodString;
    }, z.core.$strip>>], "kind">>;
    edges: z.ZodArray<z.ZodReadonly<z.ZodObject<{
        kind: z.ZodEnum<{
            calls: "calls";
            folds: "folds";
            "owned-by": "owned-by";
            projects: "projects";
            reacts: "reacts";
            runs: "runs";
            "waits-for": "waits-for";
            writes: "writes";
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
        node: z.ZodOptional<z.ZodString>;
        label: z.ZodOptional<z.ZodString>;
        undo: z.ZodOptional<z.ZodLiteral<true>>;
    }, z.core.$strip>>>;
    entrypointRoot: z.ZodString;
}, z.core.$strip>>;
/** The document `dot explain --as event-map --json` prints: the graph, plus the files the scan could not read. */
export declare const eventMapDocumentSchema: z.ZodReadonly<z.ZodObject<{
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
        opaqueSteps: z.ZodArray<z.ZodString>;
    }, z.core.$strip>>, z.ZodReadonly<z.ZodObject<{
        id: z.ZodString;
        name: z.ZodString;
        kind: z.ZodLiteral<"feature">;
    }, z.core.$strip>>, z.ZodReadonly<z.ZodObject<{
        id: z.ZodString;
        name: z.ZodString;
        kind: z.ZodLiteral<"command">;
    }, z.core.$strip>>, z.ZodReadonly<z.ZodObject<{
        id: z.ZodString;
        name: z.ZodString;
        kind: z.ZodLiteral<"entrypoint">;
        feature: z.ZodString;
        file: z.ZodString;
    }, z.core.$strip>>], "kind">>;
    edges: z.ZodArray<z.ZodReadonly<z.ZodObject<{
        kind: z.ZodEnum<{
            calls: "calls";
            folds: "folds";
            "owned-by": "owned-by";
            projects: "projects";
            reacts: "reacts";
            runs: "runs";
            "waits-for": "waits-for";
            writes: "writes";
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
        node: z.ZodOptional<z.ZodString>;
        label: z.ZodOptional<z.ZodString>;
        undo: z.ZodOptional<z.ZodLiteral<true>>;
    }, z.core.$strip>>>;
    format: z.ZodLiteral<"event-map">;
    problems: z.ZodArray<z.ZodReadonly<z.ZodObject<{
        file: z.ZodString;
        reason: z.ZodString;
    }, z.core.$strip>>>;
}, z.core.$strip>>;
/**
 * What the entrypoint scan keeps from a module's export: a `j.command`, a plain object with a `name`, the
 * event definitions it `writes` and a `handler`. Nothing else a procedure imports has all four.
 */
export declare const journalCommandSchema: z.ZodObject<{
    name: z.ZodString;
    writes: z.ZodArray<z.ZodCustom<{
        readonly type: string;
    }, {
        readonly type: string;
    }>>;
    handler: z.ZodCustom<(...args: never[]) => unknown, (...args: never[]) => unknown>;
}, z.core.$loose>;
//# sourceMappingURL=event-map-schema.d.ts.map