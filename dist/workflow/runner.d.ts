import { z } from 'zod';
import type { AsyncSchemaFailure, Failure } from '@arki/failure';
import type { SchemaInput, SchemaOutput, StandardSchemaV1 } from '@arki/schema';
import type { CommandContext, Journal, JournalDefinitions, WorkflowCommandRunner } from '../api.js';
import type { CommandFailure } from '../errors.js';
import type { createEventDecoder } from '../history.js';
import type { JournalTables } from '../pg.js';
import type { JobRetention } from '../retention.js';
import type { AnyEntity, AnyEventDef, DbHandle, Needs, RootDb, StepHookContext, TransactionSource } from '../types.js';
import type { EventStart } from '../write.js';
import type { WorkflowDef } from './define.js';
import type { LimitView } from './limit-types.js';
import type { SignalStatus } from './states.js';
import { CommandNotFound } from '../errors.js';
/** The library-owned effect that runs one node attempt. */
export declare const STEP_EFFECT = "workflow.step";
/** The library-owned effect that fires a park's wake time, a run's deadline and a queued run's ttl. */
export declare const TIMER_EFFECT = "workflow.timer";
/** The library-owned effect that looks at a limit's queued runs again when a key's `perKey` override runs out. */
export declare const LIMIT_TIMER_EFFECT = "workflow.limitTimer";
/** The library-owned effects that start a run from a journal event (`startOn`): `workflow.start:<workflow name>`. */
export declare const START_EFFECT = "workflow.start";
/** The library-owned effect that runs a definition's lifecycle hooks (`on`) when a run ends. */
export declare const LIFECYCLE_EFFECT = "workflow.on";
/** The library-owned effects that wake event waits: `workflow.wake:<entity kind>`. Mounted for each entity a wait watches. */
export declare const WAKE_EFFECT = "workflow.wake";
/** Who asked, why, and from which Foreman execution: the `op` of every operator verb, as the job verbs take it. */
export declare const operationSchema: z.ZodReadonly<z.ZodObject<{
    actor: z.ZodString;
    reason: z.ZodOptional<z.ZodString>;
    executionId: z.ZodOptional<z.ZodString>;
}, z.core.$strip>>;
export declare const retryStepSchema: z.ZodReadonly<z.ZodObject<{
    runId: z.ZodString;
    path: z.ZodString;
    op: z.ZodReadonly<z.ZodObject<{
        actor: z.ZodString;
        reason: z.ZodOptional<z.ZodString>;
        executionId: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>>;
    phase: z.ZodEnum<{
        do: "do";
        undo: "undo";
    }>;
}, z.core.$strip>>;
export declare const resolveStepSchema: z.ZodReadonly<z.ZodObject<{
    runId: z.ZodString;
    path: z.ZodString;
    op: z.ZodReadonly<z.ZodObject<{
        actor: z.ZodString;
        reason: z.ZodOptional<z.ZodString>;
        executionId: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>>;
    result: z.ZodUnknown;
}, z.core.$strip>>;
export declare const skipUndoSchema: z.ZodReadonly<z.ZodObject<{
    runId: z.ZodString;
    path: z.ZodString;
    op: z.ZodReadonly<z.ZodObject<{
        actor: z.ZodString;
        reason: z.ZodOptional<z.ZodString>;
        executionId: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>>;
}, z.core.$strip>>;
/** The operator's signal: the payload is unknown here and checked by the run's own version. */
export declare const operatorSignalSchema: z.ZodReadonly<z.ZodObject<{
    runId: z.ZodString;
    name: z.ZodString;
    deliveryId: z.ZodString;
    payload: z.ZodUnknown;
    op: z.ZodReadonly<z.ZodObject<{
        actor: z.ZodString;
        reason: z.ZodOptional<z.ZodString>;
        executionId: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>>;
}, z.core.$strip>>;
export declare const operatorCancelSchema: z.ZodReadonly<z.ZodObject<{
    runId: z.ZodString;
    reason: z.ZodString;
    op: z.ZodReadonly<z.ZodObject<{
        actor: z.ZodString;
        reason: z.ZodOptional<z.ZodString>;
        executionId: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>>;
}, z.core.$strip>>;
export declare const setMetadataSchema: z.ZodReadonly<z.ZodObject<{
    runId: z.ZodString;
    change: z.ZodReadonly<z.ZodDiscriminatedUnion<[z.ZodObject<{
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
    op: z.ZodReadonly<z.ZodObject<{
        actor: z.ZodString;
        reason: z.ZodOptional<z.ZodString>;
        executionId: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>>;
}, z.core.$strip>>;
export declare const addTagsSchema: z.ZodReadonly<z.ZodObject<{
    runId: z.ZodString;
    tags: z.ZodReadonly<z.ZodArray<z.ZodString>>;
    op: z.ZodReadonly<z.ZodObject<{
        actor: z.ZodString;
        reason: z.ZodOptional<z.ZodString>;
        executionId: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>>;
}, z.core.$strip>>;
/** `reschedule` takes the new start as a wait from now (`delay`) or a time (`at`), never both. */
export declare const rescheduleSchema: z.ZodUnion<readonly [z.ZodReadonly<z.ZodObject<{
    runId: z.ZodString;
    delay: z.ZodUnion<readonly [z.ZodNumber, z.ZodTemplateLiteral<`${number}d` | `${number}h` | `${number}m`>]>;
    op: z.ZodReadonly<z.ZodObject<{
        actor: z.ZodString;
        reason: z.ZodOptional<z.ZodString>;
        executionId: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>>;
}, z.core.$strict>>, z.ZodReadonly<z.ZodObject<{
    runId: z.ZodString;
    at: z.ZodDate;
    op: z.ZodReadonly<z.ZodObject<{
        actor: z.ZodString;
        reason: z.ZodOptional<z.ZodString>;
        executionId: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>>;
}, z.core.$strict>>]>;
/**
 * `journal.limits.override`: the `perKey` of one key for a `ttl` up to `LIMIT_KEY_TTL.max`, or the limit's own
 * `total` and `perKey`, at least one. The type is the source (`LimitOverrideArgs`); `schemas.test-d.ts` locks this
 * schema to it both ways.
 */
export declare const limitOverrideSchema: z.ZodUnion<readonly [z.ZodReadonly<z.ZodObject<{
    name: z.ZodString;
    key: z.ZodString;
    perKey: z.ZodInt;
    ttl: z.ZodOptional<z.ZodUnion<readonly [z.ZodNumber, z.ZodTemplateLiteral<`${number}d` | `${number}h` | `${number}m`>]>>;
    op: z.ZodReadonly<z.ZodObject<{
        actor: z.ZodString;
        reason: z.ZodOptional<z.ZodString>;
        executionId: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>>;
}, z.core.$strict>>, z.ZodReadonly<z.ZodObject<{
    name: z.ZodString;
    total: z.ZodOptional<z.ZodInt>;
    perKey: z.ZodOptional<z.ZodInt>;
    op: z.ZodReadonly<z.ZodObject<{
        actor: z.ZodString;
        reason: z.ZodOptional<z.ZodString>;
        executionId: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>>;
}, z.core.$strict>>]>;
export declare const limitResetSchema: z.ZodReadonly<z.ZodObject<{
    name: z.ZodString;
    key: z.ZodOptional<z.ZodString>;
    op: z.ZodReadonly<z.ZodObject<{
        actor: z.ZodString;
        reason: z.ZodOptional<z.ZodString>;
        executionId: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>>;
}, z.core.$strip>>;
export declare const limitNameArgsSchema: z.ZodReadonly<z.ZodObject<{
    name: z.ZodString;
    op: z.ZodReadonly<z.ZodObject<{
        actor: z.ZodString;
        reason: z.ZodOptional<z.ZodString>;
        executionId: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>>;
}, z.core.$strip>>;
/** Checks `ReplayArgs` plus the operation. The type is the source; `schemas.test-d.ts` locks this schema to it both ways. */
export declare const replaySchema: z.ZodReadonly<z.ZodObject<{
    runId: z.ZodString;
    overrides: z.ZodOptional<z.ZodReadonly<z.ZodObject<{
        scope: z.ZodOptional<z.ZodString>;
        tags: z.ZodOptional<z.ZodReadonly<z.ZodArray<z.ZodString>>>;
        metadata: z.ZodOptional<z.ZodReadonly<z.ZodRecord<z.ZodString, z.ZodUnknown>>>;
        delay: z.ZodOptional<z.ZodUnion<readonly [z.ZodUnion<readonly [z.ZodNumber, z.ZodTemplateLiteral<`${number}d` | `${number}h` | `${number}m`>]>, z.ZodDate]>>;
        ttl: z.ZodOptional<z.ZodUnion<readonly [z.ZodNumber, z.ZodTemplateLiteral<`${number}d` | `${number}h` | `${number}m`>]>>;
        maxAttempts: z.ZodOptional<z.ZodInt>;
        timeout: z.ZodOptional<z.ZodUnion<readonly [z.ZodNumber, z.ZodTemplateLiteral<`${number}d` | `${number}h` | `${number}m`>]>>;
        priority: z.ZodOptional<z.ZodInt32>;
        input: z.ZodOptional<z.ZodUnknown>;
    }, z.core.$strip>>>;
    op: z.ZodReadonly<z.ZodObject<{
        actor: z.ZodString;
        reason: z.ZodOptional<z.ZodString>;
        executionId: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>>;
}, z.core.$strip>>;
/** Checks `CancelArgs`. The type is the source; `schemas.test-d.ts` locks this schema to it both ways. */
export declare const cancelArgsSchema: z.ZodReadonly<z.ZodObject<{
    runId: z.ZodString;
    reason: z.ZodString;
    executionId: z.ZodOptional<z.ZodString>;
}, z.core.$strip>>;
/** The arguments of `def.signal(name)`. `deliveryId` is the sender's own id: a repeat of it changes nothing. */
export declare const signalEnvelope: z.ZodReadonly<z.ZodObject<{
    runId: z.ZodString;
    deliveryId: z.ZodString;
    payload: z.ZodUnknown;
}, z.core.$strip>>;
type Definitions<Meta extends StandardSchemaV1<unknown, Record<string, unknown>>, Tx extends TransactionSource<Tx>, AppDb extends RootDb> = Pick<JournalDefinitions<Meta, Tx, AppDb>, 'event' | 'entity' | 'projection' | 'command'>;
/**
 * The workflow runner of one `initJournal()`: `workflow` builds definitions with `start`; `register`, called by
 * `compose`, returns the step effect and the step projection. The `workflow.run` entity is built here from the
 * journal tables `initJournal` was given, like any entity of the app.
 */
export declare function createWorkflows<Meta extends StandardSchemaV1<unknown, Record<string, unknown>>, Tx extends TransactionSource<Tx>, AppDb extends RootDb>(j: Definitions<Meta, Tx, AppDb>, tables: JournalTables, retention: JobRetention | undefined, decodeEvent: ReturnType<typeof createEventDecoder<Meta>>): {
    workflow: <Input extends StandardSchemaV1, N extends Needs = Readonly<Record<never, import("../types.js").Need<unknown>>>, Declared extends StandardSchemaV1 | undefined = undefined, E extends AnyEntity<SchemaOutput<Meta>> = never, D extends import("../types.js").EventsOf<E> = never, Timing extends import("./define.js").StartTiming = "after-commit">(name: string, options: import("./define.js").WorkflowOptions<Input, N, Declared, import("./define.js").StartOn<Input, E, D, SchemaOutput<Meta>, Timing>, {
        readonly db: AppDb;
        readonly run: WorkflowCommandRunner<Meta, Tx>;
        readonly commandContext: CommandContext<SchemaOutput<Meta>, Tx, AnyEventDef>;
    }>) => import("./define.js").WorkflowBuilder<Input, Readonly<Record<never, never>>, N, Declared, never, {
        readonly db: AppDb;
        readonly run: WorkflowCommandRunner<Meta, Tx>;
        readonly commandContext: CommandContext<SchemaOutput<Meta>, Tx, AnyEventDef>;
    }, import("./run-types.js").StarterOf<Meta, Tx, Input>>;
    task: <Input extends StandardSchemaV1, Returned extends import("./define.js").FinishBound<Declared>, N extends Needs = Readonly<Record<never, import("../types.js").Need<unknown>>>, Declared extends StandardSchemaV1 | undefined = undefined, E extends AnyEntity<SchemaOutput<Meta>> = never, D extends import("../types.js").EventsOf<E> = never, Timing extends import("./define.js").StartTiming = "after-commit">(name: string, options: import("./define.js").TaskOptions<Input, N, Declared, import("./define.js").StartOn<Input, E, D, SchemaOutput<Meta>, Timing>, {
        readonly db: AppDb;
        readonly run: WorkflowCommandRunner<Meta, Tx>;
        readonly commandContext: CommandContext<SchemaOutput<Meta>, Tx, AnyEventDef>;
    }, Returned>, run: import("./define.js").TaskBody<Input, N, {
        readonly db: AppDb;
        readonly run: WorkflowCommandRunner<Meta, Tx>;
        readonly commandContext: CommandContext<SchemaOutput<Meta>, Tx, AnyEventDef>;
    }, Returned>) => import("./define.js").TaskDef<Input, N, Declared, import("./run-types.js").StarterOf<Meta, Tx, Input>, Returned>;
    register: (declared: readonly WorkflowDef[], meta: SchemaInput<Meta>) => {
        effects: import("../types.js").Effect<SchemaOutput<Meta>, AppDb, {}>[];
        steps: import("../types.js").Projection<SchemaOutput<Meta>, Tx>;
        eventStarts: EventStart<SchemaInput<Meta>, SchemaOutput<Meta>, Tx>[];
        /** Gives `startAndWait` the composed journal's `run`. `compose` calls it once the journal exists. */
        bindRun: (run: Journal<Meta, Tx, AppDb>['run']) => void;
    };
    started: Map<string, WorkflowDef>;
    stepHooks: {
        point: import("../hooks.js").HookPoint<StepHookContext>;
        freeze: () => void;
        run: <T>(ctx: StepHookContext, work: () => Promise<T>) => Promise<T>;
    };
    operate: {
        retryStep: import("../api.js").Command<z.ZodReadonly<z.ZodObject<{
            runId: z.ZodString;
            path: z.ZodString;
            op: z.ZodReadonly<z.ZodObject<{
                actor: z.ZodString;
                reason: z.ZodOptional<z.ZodString>;
                executionId: z.ZodOptional<z.ZodString>;
            }, z.core.$strip>>;
            phase: z.ZodEnum<{
                do: "do";
                undo: "undo";
            }>;
        }, z.core.$strip>>, Promise<{
            readonly how: 'rescheduled' | 'childrenRestarted' | 'jobRetried';
        } | CommandFailure>, SchemaOutput<Meta>, Tx, (import("../types.js").EventDef<"CancelRequested", z.ZodObject<{
            reason: z.ZodString;
            actorId: z.ZodNullable<z.ZodString>;
            executionId: z.ZodOptional<z.ZodString>;
            at: z.ZodISODateTime;
        }, z.core.$strip>> | import("../types.js").EventDef<"ChildrenPlanned", z.ZodObject<{
            actorId: z.ZodOptional<z.ZodString>;
            reason: z.ZodOptional<z.ZodString>;
            executionId: z.ZodOptional<z.ZodString>;
            path: z.ZodString;
            base: z.ZodString;
            def: z.ZodObject<{
                name: z.ZodString;
                version: z.ZodInt;
            }, z.core.$strip>;
            children: z.ZodArray<z.ZodObject<{
                id: z.ZodString;
                input: z.ZodUnknown;
                def: z.ZodOptional<z.ZodObject<{
                    name: z.ZodString;
                    version: z.ZodInt;
                }, z.core.$strip>>;
            }, z.core.$strip>>;
            start: z.ZodOptional<z.ZodInt>;
            at: z.ZodISODateTime;
        }, z.core.$strip>> | import("../types.js").EventDef<"CompensationStarted", z.ZodObject<{
            at: z.ZodISODateTime;
        }, z.core.$strip>> | import("../types.js").EventDef<"DeadlineReached", z.ZodObject<{
            at: z.ZodISODateTime;
        }, z.core.$strip>> | import("../types.js").EventDef<"JobRetried", z.ZodObject<{
            actorId: z.ZodOptional<z.ZodString>;
            reason: z.ZodOptional<z.ZodString>;
            executionId: z.ZodOptional<z.ZodString>;
            jobId: z.ZodString;
            node: z.ZodNullable<z.ZodString>;
            at: z.ZodISODateTime;
        }, z.core.$strip>> | import("../types.js").EventDef<"MetadataChanged", z.ZodObject<{
            actorId: z.ZodOptional<z.ZodString>;
            reason: z.ZodOptional<z.ZodString>;
            executionId: z.ZodOptional<z.ZodString>;
            change: z.ZodReadonly<z.ZodDiscriminatedUnion<[z.ZodObject<{
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
            at: z.ZodISODateTime;
        }, z.core.$strip>> | import("../types.js").EventDef<"NodeCompleted", z.ZodObject<{
            path: z.ZodString;
            phase: z.ZodEnum<{
                do: "do";
                undo: "undo";
            }>;
            result: z.ZodUnknown;
            resolvedBy: z.ZodNullable<z.ZodString>;
            at: z.ZodISODateTime;
            reason: z.ZodOptional<z.ZodString>;
            executionId: z.ZodOptional<z.ZodString>;
        }, z.core.$strip>> | import("../types.js").EventDef<"NodeFailed", z.ZodObject<{
            path: z.ZodString;
            phase: z.ZodEnum<{
                do: "do";
                undo: "undo";
            }>;
            attempt: z.ZodInt;
            error: z.ZodString;
            at: z.ZodISODateTime;
        }, z.core.$strip>> | import("../types.js").EventDef<"NodeScheduled", z.ZodObject<{
            actorId: z.ZodOptional<z.ZodString>;
            reason: z.ZodOptional<z.ZodString>;
            executionId: z.ZodOptional<z.ZodString>;
            path: z.ZodString;
            phase: z.ZodEnum<{
                do: "do";
                undo: "undo";
            }>;
            attempt: z.ZodInt;
            key: z.ZodString;
            jobId: z.ZodNullable<z.ZodString>;
            at: z.ZodISODateTime;
            resolution: z.ZodOptional<z.ZodObject<{
                result: z.ZodUnknown;
            }, z.core.$strip>>;
            priority: z.ZodOptional<z.ZodInt32>;
        }, z.core.$strip>> | import("../types.js").EventDef<"NodeSkipped", z.ZodObject<{
            path: z.ZodString;
            phase: z.ZodEnum<{
                do: "do";
                undo: "undo";
            }>;
            cause: z.ZodEnum<{
                compensating: "compensating";
                detached: "detached";
                expired: "expired";
                "no-undo": "no-undo";
                operator: "operator";
                when: "when";
            }>;
            reason: z.ZodString;
            actorId: z.ZodNullable<z.ZodString>;
            at: z.ZodISODateTime;
            executionId: z.ZodOptional<z.ZodString>;
        }, z.core.$strip>> | import("../types.js").EventDef<"Parked", z.ZodObject<{
            node: z.ZodString;
            waitingFor: z.ZodNullable<z.ZodString>;
            wakeAt: z.ZodNullable<z.ZodISODateTime>;
            priority: z.ZodOptional<z.ZodInt32>;
            at: z.ZodISODateTime;
        }, z.core.$strip>> | import("../types.js").EventDef<"RunCancelled", z.ZodObject<{
            at: z.ZodISODateTime;
            keepUntil: z.ZodNullable<z.ZodISODateTime>;
        }, z.core.$strip>> | import("../types.js").EventDef<"RunCompleted", z.ZodObject<{
            output: z.ZodUnknown;
            at: z.ZodISODateTime;
            keepUntil: z.ZodNullable<z.ZodISODateTime>;
        }, z.core.$strip>> | import("../types.js").EventDef<"RunDequeued", z.ZodObject<{
            at: z.ZodISODateTime;
        }, z.core.$strip>> | import("../types.js").EventDef<"RunExpired", z.ZodObject<{
            at: z.ZodISODateTime;
            keepUntil: z.ZodNullable<z.ZodISODateTime>;
        }, z.core.$strip>> | import("../types.js").EventDef<"RunFailed", z.ZodObject<{
            error: z.ZodString;
            at: z.ZodISODateTime;
            keepUntil: z.ZodNullable<z.ZodISODateTime>;
        }, z.core.$strip>> | import("../types.js").EventDef<"RunQueued", z.ZodObject<{
            limitName: z.ZodString;
            reason: z.ZodEnum<{
                full: "full";
                paused: "paused";
            }>;
            ttlAt: z.ZodNullable<z.ZodISODateTime>;
            priority: z.ZodOptional<z.ZodInt32>;
            at: z.ZodISODateTime;
        }, z.core.$strip>> | import("../types.js").EventDef<"RunRescheduled", z.ZodObject<{
            actorId: z.ZodOptional<z.ZodString>;
            reason: z.ZodOptional<z.ZodString>;
            executionId: z.ZodOptional<z.ZodString>;
            startAt: z.ZodISODateTime;
            ttlAt: z.ZodNullable<z.ZodISODateTime>;
            deadlineAt: z.ZodNullable<z.ZodISODateTime>;
            at: z.ZodISODateTime;
        }, z.core.$strip>> | import("../types.js").EventDef<"RunStarted", z.ZodObject<{
            actorId: z.ZodOptional<z.ZodString>;
            reason: z.ZodOptional<z.ZodString>;
            executionId: z.ZodOptional<z.ZodString>;
            name: z.ZodString;
            workflowVersion: z.ZodInt;
            shape: z.ZodReadonly<z.ZodObject<{
                nodes: z.ZodReadonly<z.ZodArray<z.ZodReadonly<z.ZodObject<{
                    name: z.ZodString;
                    kind: z.ZodEnum<{
                        child: "child";
                        command: "command";
                        eventWait: "eventWait";
                        map: "map";
                        parallel: "parallel";
                        sleep: "sleep";
                        step: "step";
                        waitFor: "waitFor";
                    }>;
                    undo: z.ZodBoolean;
                    onCancel: z.ZodOptional<z.ZodEnum<{
                        cancel: "cancel";
                        detach: "detach";
                    }>>;
                    signal: z.ZodOptional<z.ZodString>;
                    command: z.ZodOptional<z.ZodString>;
                    undoCommand: z.ZodOptional<z.ZodString>;
                    on: z.ZodOptional<z.ZodReadonly<z.ZodArray<z.ZodReadonly<z.ZodObject<{
                        label: z.ZodString;
                        entity: z.ZodString;
                        events: z.ZodReadonly<z.ZodArray<z.ZodString>>;
                    }, z.core.$strip>>>>>;
                    wait: z.ZodOptional<z.ZodEnum<{
                        all: "all";
                        any: "any";
                    }>>;
                    branches: z.ZodOptional<z.ZodReadonly<z.ZodArray<z.ZodReadonly<z.ZodObject<{
                        name: z.ZodString;
                        shape: z.ZodType<import("./shape.js").WorkflowShape>;
                    }, z.core.$strip>>>>>;
                }, z.core.$strip>>>>;
            }, z.core.$strip>>;
            shapeHash: z.ZodString;
            input: z.ZodUnknown;
            deadlineAt: z.ZodNullable<z.ZodISODateTime>;
            parentId: z.ZodNullable<z.ZodString>;
            parentPath: z.ZodNullable<z.ZodString>;
            concurrencyKey: z.ZodNullable<z.ZodString>;
            scope: z.ZodOptional<z.ZodNullable<z.ZodString>>;
            tags: z.ZodOptional<z.ZodReadonly<z.ZodArray<z.ZodString>>>;
            metadata: z.ZodOptional<z.ZodReadonly<z.ZodRecord<z.ZodString, z.ZodUnknown>>>;
            rootId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
            startAt: z.ZodOptional<z.ZodNullable<z.ZodISODateTime>>;
            ttlAt: z.ZodOptional<z.ZodNullable<z.ZodISODateTime>>;
            ttlMs: z.ZodOptional<z.ZodNullable<z.ZodInt>>;
            maxAttempts: z.ZodOptional<z.ZodInt>;
            stepTimeoutMs: z.ZodOptional<z.ZodInt>;
            priority: z.ZodOptional<z.ZodInt32>;
            limits: z.ZodOptional<z.ZodReadonly<z.ZodArray<z.ZodString>>>;
            triggerSeq: z.ZodOptional<z.ZodInt>;
            results: z.ZodOptional<z.ZodReadonly<z.ZodRecord<z.ZodString, z.ZodUnknown>>>;
            batchId: z.ZodOptional<z.ZodString>;
            replayOf: z.ZodOptional<z.ZodString>;
            at: z.ZodISODateTime;
        }, z.core.$strip>> | import("../types.js").EventDef<"RunTagged", z.ZodObject<{
            actorId: z.ZodOptional<z.ZodString>;
            reason: z.ZodOptional<z.ZodString>;
            executionId: z.ZodOptional<z.ZodString>;
            tags: z.ZodReadonly<z.ZodArray<z.ZodString>>;
            at: z.ZodISODateTime;
        }, z.core.$strip>> | import("../types.js").EventDef<"SignalReceived", z.ZodObject<{
            actorId: z.ZodOptional<z.ZodString>;
            reason: z.ZodOptional<z.ZodString>;
            executionId: z.ZodOptional<z.ZodString>;
            name: z.ZodString;
            deliveryId: z.ZodString;
            at: z.ZodISODateTime;
        }, z.core.$strip>> | import("../types.js").EventDef<"TimerFired", z.ZodObject<{
            node: z.ZodString;
            at: z.ZodISODateTime;
        }, z.core.$strip>> | import("../types.js").EventDef<"WaitEventTaken", z.ZodObject<{
            node: z.ZodString;
            label: z.ZodString;
            seq: z.ZodInt;
            deliveryId: z.ZodString;
            at: z.ZodISODateTime;
        }, z.core.$strip>>)[], undefined>;
        resolveStep: import("../api.js").Command<z.ZodReadonly<z.ZodObject<{
            runId: z.ZodString;
            path: z.ZodString;
            op: z.ZodReadonly<z.ZodObject<{
                actor: z.ZodString;
                reason: z.ZodOptional<z.ZodString>;
                executionId: z.ZodOptional<z.ZodString>;
            }, z.core.$strip>>;
            result: z.ZodUnknown;
        }, z.core.$strip>>, Promise<{
            readonly runId: string;
        } | CommandFailure>, SchemaOutput<Meta>, Tx, (import("../types.js").EventDef<"CancelRequested", z.ZodObject<{
            reason: z.ZodString;
            actorId: z.ZodNullable<z.ZodString>;
            executionId: z.ZodOptional<z.ZodString>;
            at: z.ZodISODateTime;
        }, z.core.$strip>> | import("../types.js").EventDef<"ChildrenPlanned", z.ZodObject<{
            actorId: z.ZodOptional<z.ZodString>;
            reason: z.ZodOptional<z.ZodString>;
            executionId: z.ZodOptional<z.ZodString>;
            path: z.ZodString;
            base: z.ZodString;
            def: z.ZodObject<{
                name: z.ZodString;
                version: z.ZodInt;
            }, z.core.$strip>;
            children: z.ZodArray<z.ZodObject<{
                id: z.ZodString;
                input: z.ZodUnknown;
                def: z.ZodOptional<z.ZodObject<{
                    name: z.ZodString;
                    version: z.ZodInt;
                }, z.core.$strip>>;
            }, z.core.$strip>>;
            start: z.ZodOptional<z.ZodInt>;
            at: z.ZodISODateTime;
        }, z.core.$strip>> | import("../types.js").EventDef<"CompensationStarted", z.ZodObject<{
            at: z.ZodISODateTime;
        }, z.core.$strip>> | import("../types.js").EventDef<"DeadlineReached", z.ZodObject<{
            at: z.ZodISODateTime;
        }, z.core.$strip>> | import("../types.js").EventDef<"JobRetried", z.ZodObject<{
            actorId: z.ZodOptional<z.ZodString>;
            reason: z.ZodOptional<z.ZodString>;
            executionId: z.ZodOptional<z.ZodString>;
            jobId: z.ZodString;
            node: z.ZodNullable<z.ZodString>;
            at: z.ZodISODateTime;
        }, z.core.$strip>> | import("../types.js").EventDef<"MetadataChanged", z.ZodObject<{
            actorId: z.ZodOptional<z.ZodString>;
            reason: z.ZodOptional<z.ZodString>;
            executionId: z.ZodOptional<z.ZodString>;
            change: z.ZodReadonly<z.ZodDiscriminatedUnion<[z.ZodObject<{
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
            at: z.ZodISODateTime;
        }, z.core.$strip>> | import("../types.js").EventDef<"NodeCompleted", z.ZodObject<{
            path: z.ZodString;
            phase: z.ZodEnum<{
                do: "do";
                undo: "undo";
            }>;
            result: z.ZodUnknown;
            resolvedBy: z.ZodNullable<z.ZodString>;
            at: z.ZodISODateTime;
            reason: z.ZodOptional<z.ZodString>;
            executionId: z.ZodOptional<z.ZodString>;
        }, z.core.$strip>> | import("../types.js").EventDef<"NodeFailed", z.ZodObject<{
            path: z.ZodString;
            phase: z.ZodEnum<{
                do: "do";
                undo: "undo";
            }>;
            attempt: z.ZodInt;
            error: z.ZodString;
            at: z.ZodISODateTime;
        }, z.core.$strip>> | import("../types.js").EventDef<"NodeScheduled", z.ZodObject<{
            actorId: z.ZodOptional<z.ZodString>;
            reason: z.ZodOptional<z.ZodString>;
            executionId: z.ZodOptional<z.ZodString>;
            path: z.ZodString;
            phase: z.ZodEnum<{
                do: "do";
                undo: "undo";
            }>;
            attempt: z.ZodInt;
            key: z.ZodString;
            jobId: z.ZodNullable<z.ZodString>;
            at: z.ZodISODateTime;
            resolution: z.ZodOptional<z.ZodObject<{
                result: z.ZodUnknown;
            }, z.core.$strip>>;
            priority: z.ZodOptional<z.ZodInt32>;
        }, z.core.$strip>> | import("../types.js").EventDef<"NodeSkipped", z.ZodObject<{
            path: z.ZodString;
            phase: z.ZodEnum<{
                do: "do";
                undo: "undo";
            }>;
            cause: z.ZodEnum<{
                compensating: "compensating";
                detached: "detached";
                expired: "expired";
                "no-undo": "no-undo";
                operator: "operator";
                when: "when";
            }>;
            reason: z.ZodString;
            actorId: z.ZodNullable<z.ZodString>;
            at: z.ZodISODateTime;
            executionId: z.ZodOptional<z.ZodString>;
        }, z.core.$strip>> | import("../types.js").EventDef<"Parked", z.ZodObject<{
            node: z.ZodString;
            waitingFor: z.ZodNullable<z.ZodString>;
            wakeAt: z.ZodNullable<z.ZodISODateTime>;
            priority: z.ZodOptional<z.ZodInt32>;
            at: z.ZodISODateTime;
        }, z.core.$strip>> | import("../types.js").EventDef<"RunCancelled", z.ZodObject<{
            at: z.ZodISODateTime;
            keepUntil: z.ZodNullable<z.ZodISODateTime>;
        }, z.core.$strip>> | import("../types.js").EventDef<"RunCompleted", z.ZodObject<{
            output: z.ZodUnknown;
            at: z.ZodISODateTime;
            keepUntil: z.ZodNullable<z.ZodISODateTime>;
        }, z.core.$strip>> | import("../types.js").EventDef<"RunDequeued", z.ZodObject<{
            at: z.ZodISODateTime;
        }, z.core.$strip>> | import("../types.js").EventDef<"RunExpired", z.ZodObject<{
            at: z.ZodISODateTime;
            keepUntil: z.ZodNullable<z.ZodISODateTime>;
        }, z.core.$strip>> | import("../types.js").EventDef<"RunFailed", z.ZodObject<{
            error: z.ZodString;
            at: z.ZodISODateTime;
            keepUntil: z.ZodNullable<z.ZodISODateTime>;
        }, z.core.$strip>> | import("../types.js").EventDef<"RunQueued", z.ZodObject<{
            limitName: z.ZodString;
            reason: z.ZodEnum<{
                full: "full";
                paused: "paused";
            }>;
            ttlAt: z.ZodNullable<z.ZodISODateTime>;
            priority: z.ZodOptional<z.ZodInt32>;
            at: z.ZodISODateTime;
        }, z.core.$strip>> | import("../types.js").EventDef<"RunRescheduled", z.ZodObject<{
            actorId: z.ZodOptional<z.ZodString>;
            reason: z.ZodOptional<z.ZodString>;
            executionId: z.ZodOptional<z.ZodString>;
            startAt: z.ZodISODateTime;
            ttlAt: z.ZodNullable<z.ZodISODateTime>;
            deadlineAt: z.ZodNullable<z.ZodISODateTime>;
            at: z.ZodISODateTime;
        }, z.core.$strip>> | import("../types.js").EventDef<"RunStarted", z.ZodObject<{
            actorId: z.ZodOptional<z.ZodString>;
            reason: z.ZodOptional<z.ZodString>;
            executionId: z.ZodOptional<z.ZodString>;
            name: z.ZodString;
            workflowVersion: z.ZodInt;
            shape: z.ZodReadonly<z.ZodObject<{
                nodes: z.ZodReadonly<z.ZodArray<z.ZodReadonly<z.ZodObject<{
                    name: z.ZodString;
                    kind: z.ZodEnum<{
                        child: "child";
                        command: "command";
                        eventWait: "eventWait";
                        map: "map";
                        parallel: "parallel";
                        sleep: "sleep";
                        step: "step";
                        waitFor: "waitFor";
                    }>;
                    undo: z.ZodBoolean;
                    onCancel: z.ZodOptional<z.ZodEnum<{
                        cancel: "cancel";
                        detach: "detach";
                    }>>;
                    signal: z.ZodOptional<z.ZodString>;
                    command: z.ZodOptional<z.ZodString>;
                    undoCommand: z.ZodOptional<z.ZodString>;
                    on: z.ZodOptional<z.ZodReadonly<z.ZodArray<z.ZodReadonly<z.ZodObject<{
                        label: z.ZodString;
                        entity: z.ZodString;
                        events: z.ZodReadonly<z.ZodArray<z.ZodString>>;
                    }, z.core.$strip>>>>>;
                    wait: z.ZodOptional<z.ZodEnum<{
                        all: "all";
                        any: "any";
                    }>>;
                    branches: z.ZodOptional<z.ZodReadonly<z.ZodArray<z.ZodReadonly<z.ZodObject<{
                        name: z.ZodString;
                        shape: z.ZodType<import("./shape.js").WorkflowShape>;
                    }, z.core.$strip>>>>>;
                }, z.core.$strip>>>>;
            }, z.core.$strip>>;
            shapeHash: z.ZodString;
            input: z.ZodUnknown;
            deadlineAt: z.ZodNullable<z.ZodISODateTime>;
            parentId: z.ZodNullable<z.ZodString>;
            parentPath: z.ZodNullable<z.ZodString>;
            concurrencyKey: z.ZodNullable<z.ZodString>;
            scope: z.ZodOptional<z.ZodNullable<z.ZodString>>;
            tags: z.ZodOptional<z.ZodReadonly<z.ZodArray<z.ZodString>>>;
            metadata: z.ZodOptional<z.ZodReadonly<z.ZodRecord<z.ZodString, z.ZodUnknown>>>;
            rootId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
            startAt: z.ZodOptional<z.ZodNullable<z.ZodISODateTime>>;
            ttlAt: z.ZodOptional<z.ZodNullable<z.ZodISODateTime>>;
            ttlMs: z.ZodOptional<z.ZodNullable<z.ZodInt>>;
            maxAttempts: z.ZodOptional<z.ZodInt>;
            stepTimeoutMs: z.ZodOptional<z.ZodInt>;
            priority: z.ZodOptional<z.ZodInt32>;
            limits: z.ZodOptional<z.ZodReadonly<z.ZodArray<z.ZodString>>>;
            triggerSeq: z.ZodOptional<z.ZodInt>;
            results: z.ZodOptional<z.ZodReadonly<z.ZodRecord<z.ZodString, z.ZodUnknown>>>;
            batchId: z.ZodOptional<z.ZodString>;
            replayOf: z.ZodOptional<z.ZodString>;
            at: z.ZodISODateTime;
        }, z.core.$strip>> | import("../types.js").EventDef<"RunTagged", z.ZodObject<{
            actorId: z.ZodOptional<z.ZodString>;
            reason: z.ZodOptional<z.ZodString>;
            executionId: z.ZodOptional<z.ZodString>;
            tags: z.ZodReadonly<z.ZodArray<z.ZodString>>;
            at: z.ZodISODateTime;
        }, z.core.$strip>> | import("../types.js").EventDef<"SignalReceived", z.ZodObject<{
            actorId: z.ZodOptional<z.ZodString>;
            reason: z.ZodOptional<z.ZodString>;
            executionId: z.ZodOptional<z.ZodString>;
            name: z.ZodString;
            deliveryId: z.ZodString;
            at: z.ZodISODateTime;
        }, z.core.$strip>> | import("../types.js").EventDef<"TimerFired", z.ZodObject<{
            node: z.ZodString;
            at: z.ZodISODateTime;
        }, z.core.$strip>> | import("../types.js").EventDef<"WaitEventTaken", z.ZodObject<{
            node: z.ZodString;
            label: z.ZodString;
            seq: z.ZodInt;
            deliveryId: z.ZodString;
            at: z.ZodISODateTime;
        }, z.core.$strip>>)[], undefined>;
        skipUndo: import("../api.js").Command<z.ZodReadonly<z.ZodObject<{
            runId: z.ZodString;
            path: z.ZodString;
            op: z.ZodReadonly<z.ZodObject<{
                actor: z.ZodString;
                reason: z.ZodOptional<z.ZodString>;
                executionId: z.ZodOptional<z.ZodString>;
            }, z.core.$strip>>;
        }, z.core.$strip>>, Promise<{
            readonly runId: string;
        } | CommandFailure>, SchemaOutput<Meta>, Tx, (import("../types.js").EventDef<"CancelRequested", z.ZodObject<{
            reason: z.ZodString;
            actorId: z.ZodNullable<z.ZodString>;
            executionId: z.ZodOptional<z.ZodString>;
            at: z.ZodISODateTime;
        }, z.core.$strip>> | import("../types.js").EventDef<"ChildrenPlanned", z.ZodObject<{
            actorId: z.ZodOptional<z.ZodString>;
            reason: z.ZodOptional<z.ZodString>;
            executionId: z.ZodOptional<z.ZodString>;
            path: z.ZodString;
            base: z.ZodString;
            def: z.ZodObject<{
                name: z.ZodString;
                version: z.ZodInt;
            }, z.core.$strip>;
            children: z.ZodArray<z.ZodObject<{
                id: z.ZodString;
                input: z.ZodUnknown;
                def: z.ZodOptional<z.ZodObject<{
                    name: z.ZodString;
                    version: z.ZodInt;
                }, z.core.$strip>>;
            }, z.core.$strip>>;
            start: z.ZodOptional<z.ZodInt>;
            at: z.ZodISODateTime;
        }, z.core.$strip>> | import("../types.js").EventDef<"CompensationStarted", z.ZodObject<{
            at: z.ZodISODateTime;
        }, z.core.$strip>> | import("../types.js").EventDef<"DeadlineReached", z.ZodObject<{
            at: z.ZodISODateTime;
        }, z.core.$strip>> | import("../types.js").EventDef<"JobRetried", z.ZodObject<{
            actorId: z.ZodOptional<z.ZodString>;
            reason: z.ZodOptional<z.ZodString>;
            executionId: z.ZodOptional<z.ZodString>;
            jobId: z.ZodString;
            node: z.ZodNullable<z.ZodString>;
            at: z.ZodISODateTime;
        }, z.core.$strip>> | import("../types.js").EventDef<"MetadataChanged", z.ZodObject<{
            actorId: z.ZodOptional<z.ZodString>;
            reason: z.ZodOptional<z.ZodString>;
            executionId: z.ZodOptional<z.ZodString>;
            change: z.ZodReadonly<z.ZodDiscriminatedUnion<[z.ZodObject<{
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
            at: z.ZodISODateTime;
        }, z.core.$strip>> | import("../types.js").EventDef<"NodeCompleted", z.ZodObject<{
            path: z.ZodString;
            phase: z.ZodEnum<{
                do: "do";
                undo: "undo";
            }>;
            result: z.ZodUnknown;
            resolvedBy: z.ZodNullable<z.ZodString>;
            at: z.ZodISODateTime;
            reason: z.ZodOptional<z.ZodString>;
            executionId: z.ZodOptional<z.ZodString>;
        }, z.core.$strip>> | import("../types.js").EventDef<"NodeFailed", z.ZodObject<{
            path: z.ZodString;
            phase: z.ZodEnum<{
                do: "do";
                undo: "undo";
            }>;
            attempt: z.ZodInt;
            error: z.ZodString;
            at: z.ZodISODateTime;
        }, z.core.$strip>> | import("../types.js").EventDef<"NodeScheduled", z.ZodObject<{
            actorId: z.ZodOptional<z.ZodString>;
            reason: z.ZodOptional<z.ZodString>;
            executionId: z.ZodOptional<z.ZodString>;
            path: z.ZodString;
            phase: z.ZodEnum<{
                do: "do";
                undo: "undo";
            }>;
            attempt: z.ZodInt;
            key: z.ZodString;
            jobId: z.ZodNullable<z.ZodString>;
            at: z.ZodISODateTime;
            resolution: z.ZodOptional<z.ZodObject<{
                result: z.ZodUnknown;
            }, z.core.$strip>>;
            priority: z.ZodOptional<z.ZodInt32>;
        }, z.core.$strip>> | import("../types.js").EventDef<"NodeSkipped", z.ZodObject<{
            path: z.ZodString;
            phase: z.ZodEnum<{
                do: "do";
                undo: "undo";
            }>;
            cause: z.ZodEnum<{
                compensating: "compensating";
                detached: "detached";
                expired: "expired";
                "no-undo": "no-undo";
                operator: "operator";
                when: "when";
            }>;
            reason: z.ZodString;
            actorId: z.ZodNullable<z.ZodString>;
            at: z.ZodISODateTime;
            executionId: z.ZodOptional<z.ZodString>;
        }, z.core.$strip>> | import("../types.js").EventDef<"Parked", z.ZodObject<{
            node: z.ZodString;
            waitingFor: z.ZodNullable<z.ZodString>;
            wakeAt: z.ZodNullable<z.ZodISODateTime>;
            priority: z.ZodOptional<z.ZodInt32>;
            at: z.ZodISODateTime;
        }, z.core.$strip>> | import("../types.js").EventDef<"RunCancelled", z.ZodObject<{
            at: z.ZodISODateTime;
            keepUntil: z.ZodNullable<z.ZodISODateTime>;
        }, z.core.$strip>> | import("../types.js").EventDef<"RunCompleted", z.ZodObject<{
            output: z.ZodUnknown;
            at: z.ZodISODateTime;
            keepUntil: z.ZodNullable<z.ZodISODateTime>;
        }, z.core.$strip>> | import("../types.js").EventDef<"RunDequeued", z.ZodObject<{
            at: z.ZodISODateTime;
        }, z.core.$strip>> | import("../types.js").EventDef<"RunExpired", z.ZodObject<{
            at: z.ZodISODateTime;
            keepUntil: z.ZodNullable<z.ZodISODateTime>;
        }, z.core.$strip>> | import("../types.js").EventDef<"RunFailed", z.ZodObject<{
            error: z.ZodString;
            at: z.ZodISODateTime;
            keepUntil: z.ZodNullable<z.ZodISODateTime>;
        }, z.core.$strip>> | import("../types.js").EventDef<"RunQueued", z.ZodObject<{
            limitName: z.ZodString;
            reason: z.ZodEnum<{
                full: "full";
                paused: "paused";
            }>;
            ttlAt: z.ZodNullable<z.ZodISODateTime>;
            priority: z.ZodOptional<z.ZodInt32>;
            at: z.ZodISODateTime;
        }, z.core.$strip>> | import("../types.js").EventDef<"RunRescheduled", z.ZodObject<{
            actorId: z.ZodOptional<z.ZodString>;
            reason: z.ZodOptional<z.ZodString>;
            executionId: z.ZodOptional<z.ZodString>;
            startAt: z.ZodISODateTime;
            ttlAt: z.ZodNullable<z.ZodISODateTime>;
            deadlineAt: z.ZodNullable<z.ZodISODateTime>;
            at: z.ZodISODateTime;
        }, z.core.$strip>> | import("../types.js").EventDef<"RunStarted", z.ZodObject<{
            actorId: z.ZodOptional<z.ZodString>;
            reason: z.ZodOptional<z.ZodString>;
            executionId: z.ZodOptional<z.ZodString>;
            name: z.ZodString;
            workflowVersion: z.ZodInt;
            shape: z.ZodReadonly<z.ZodObject<{
                nodes: z.ZodReadonly<z.ZodArray<z.ZodReadonly<z.ZodObject<{
                    name: z.ZodString;
                    kind: z.ZodEnum<{
                        child: "child";
                        command: "command";
                        eventWait: "eventWait";
                        map: "map";
                        parallel: "parallel";
                        sleep: "sleep";
                        step: "step";
                        waitFor: "waitFor";
                    }>;
                    undo: z.ZodBoolean;
                    onCancel: z.ZodOptional<z.ZodEnum<{
                        cancel: "cancel";
                        detach: "detach";
                    }>>;
                    signal: z.ZodOptional<z.ZodString>;
                    command: z.ZodOptional<z.ZodString>;
                    undoCommand: z.ZodOptional<z.ZodString>;
                    on: z.ZodOptional<z.ZodReadonly<z.ZodArray<z.ZodReadonly<z.ZodObject<{
                        label: z.ZodString;
                        entity: z.ZodString;
                        events: z.ZodReadonly<z.ZodArray<z.ZodString>>;
                    }, z.core.$strip>>>>>;
                    wait: z.ZodOptional<z.ZodEnum<{
                        all: "all";
                        any: "any";
                    }>>;
                    branches: z.ZodOptional<z.ZodReadonly<z.ZodArray<z.ZodReadonly<z.ZodObject<{
                        name: z.ZodString;
                        shape: z.ZodType<import("./shape.js").WorkflowShape>;
                    }, z.core.$strip>>>>>;
                }, z.core.$strip>>>>;
            }, z.core.$strip>>;
            shapeHash: z.ZodString;
            input: z.ZodUnknown;
            deadlineAt: z.ZodNullable<z.ZodISODateTime>;
            parentId: z.ZodNullable<z.ZodString>;
            parentPath: z.ZodNullable<z.ZodString>;
            concurrencyKey: z.ZodNullable<z.ZodString>;
            scope: z.ZodOptional<z.ZodNullable<z.ZodString>>;
            tags: z.ZodOptional<z.ZodReadonly<z.ZodArray<z.ZodString>>>;
            metadata: z.ZodOptional<z.ZodReadonly<z.ZodRecord<z.ZodString, z.ZodUnknown>>>;
            rootId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
            startAt: z.ZodOptional<z.ZodNullable<z.ZodISODateTime>>;
            ttlAt: z.ZodOptional<z.ZodNullable<z.ZodISODateTime>>;
            ttlMs: z.ZodOptional<z.ZodNullable<z.ZodInt>>;
            maxAttempts: z.ZodOptional<z.ZodInt>;
            stepTimeoutMs: z.ZodOptional<z.ZodInt>;
            priority: z.ZodOptional<z.ZodInt32>;
            limits: z.ZodOptional<z.ZodReadonly<z.ZodArray<z.ZodString>>>;
            triggerSeq: z.ZodOptional<z.ZodInt>;
            results: z.ZodOptional<z.ZodReadonly<z.ZodRecord<z.ZodString, z.ZodUnknown>>>;
            batchId: z.ZodOptional<z.ZodString>;
            replayOf: z.ZodOptional<z.ZodString>;
            at: z.ZodISODateTime;
        }, z.core.$strip>> | import("../types.js").EventDef<"RunTagged", z.ZodObject<{
            actorId: z.ZodOptional<z.ZodString>;
            reason: z.ZodOptional<z.ZodString>;
            executionId: z.ZodOptional<z.ZodString>;
            tags: z.ZodReadonly<z.ZodArray<z.ZodString>>;
            at: z.ZodISODateTime;
        }, z.core.$strip>> | import("../types.js").EventDef<"SignalReceived", z.ZodObject<{
            actorId: z.ZodOptional<z.ZodString>;
            reason: z.ZodOptional<z.ZodString>;
            executionId: z.ZodOptional<z.ZodString>;
            name: z.ZodString;
            deliveryId: z.ZodString;
            at: z.ZodISODateTime;
        }, z.core.$strip>> | import("../types.js").EventDef<"TimerFired", z.ZodObject<{
            node: z.ZodString;
            at: z.ZodISODateTime;
        }, z.core.$strip>> | import("../types.js").EventDef<"WaitEventTaken", z.ZodObject<{
            node: z.ZodString;
            label: z.ZodString;
            seq: z.ZodInt;
            deliveryId: z.ZodString;
            at: z.ZodISODateTime;
        }, z.core.$strip>>)[], undefined>;
        signal: import("../api.js").Command<z.ZodReadonly<z.ZodObject<{
            runId: z.ZodString;
            name: z.ZodString;
            deliveryId: z.ZodString;
            payload: z.ZodUnknown;
            op: z.ZodReadonly<z.ZodObject<{
                actor: z.ZodString;
                reason: z.ZodOptional<z.ZodString>;
                executionId: z.ZodOptional<z.ZodString>;
            }, z.core.$strip>>;
        }, z.core.$strip>>, Promise<Failure<"contracts.random_source_unavailable", undefined> | Failure<"db.transaction_cancelled", undefined> | Failure<"db.transaction_commit_uncertain", undefined> | Failure<"db.transaction_conflict", {
            attempts: number;
            sqlState: "40001" | "40P01";
        }> | Failure<"db.transaction_defect", undefined> | Failure<"db.transaction_rejected", {
            sqlState: string;
        }> | Failure<"db.transaction_unavailable", undefined> | Failure<"failure.unexpected_defect", undefined> | Failure<"journal.conflict", {
            detail: string;
        }> | Failure<"journal.invalid", {
            detail: string;
        }> | Failure<"journal.not_found", {
            detail: string;
        }> | Failure<"schema.async_required", undefined> | Failure<"schema.invalid_input", {
            issues: readonly StandardSchemaV1.Issue[];
        }> | Failure<"schema.validator_defect", undefined> | {
            readonly status: SignalStatus;
        }>, SchemaOutput<Meta>, Tx, (import("../types.js").EventDef<"CancelRequested", z.ZodObject<{
            reason: z.ZodString;
            actorId: z.ZodNullable<z.ZodString>;
            executionId: z.ZodOptional<z.ZodString>;
            at: z.ZodISODateTime;
        }, z.core.$strip>> | import("../types.js").EventDef<"ChildrenPlanned", z.ZodObject<{
            actorId: z.ZodOptional<z.ZodString>;
            reason: z.ZodOptional<z.ZodString>;
            executionId: z.ZodOptional<z.ZodString>;
            path: z.ZodString;
            base: z.ZodString;
            def: z.ZodObject<{
                name: z.ZodString;
                version: z.ZodInt;
            }, z.core.$strip>;
            children: z.ZodArray<z.ZodObject<{
                id: z.ZodString;
                input: z.ZodUnknown;
                def: z.ZodOptional<z.ZodObject<{
                    name: z.ZodString;
                    version: z.ZodInt;
                }, z.core.$strip>>;
            }, z.core.$strip>>;
            start: z.ZodOptional<z.ZodInt>;
            at: z.ZodISODateTime;
        }, z.core.$strip>> | import("../types.js").EventDef<"CompensationStarted", z.ZodObject<{
            at: z.ZodISODateTime;
        }, z.core.$strip>> | import("../types.js").EventDef<"DeadlineReached", z.ZodObject<{
            at: z.ZodISODateTime;
        }, z.core.$strip>> | import("../types.js").EventDef<"JobRetried", z.ZodObject<{
            actorId: z.ZodOptional<z.ZodString>;
            reason: z.ZodOptional<z.ZodString>;
            executionId: z.ZodOptional<z.ZodString>;
            jobId: z.ZodString;
            node: z.ZodNullable<z.ZodString>;
            at: z.ZodISODateTime;
        }, z.core.$strip>> | import("../types.js").EventDef<"MetadataChanged", z.ZodObject<{
            actorId: z.ZodOptional<z.ZodString>;
            reason: z.ZodOptional<z.ZodString>;
            executionId: z.ZodOptional<z.ZodString>;
            change: z.ZodReadonly<z.ZodDiscriminatedUnion<[z.ZodObject<{
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
            at: z.ZodISODateTime;
        }, z.core.$strip>> | import("../types.js").EventDef<"NodeCompleted", z.ZodObject<{
            path: z.ZodString;
            phase: z.ZodEnum<{
                do: "do";
                undo: "undo";
            }>;
            result: z.ZodUnknown;
            resolvedBy: z.ZodNullable<z.ZodString>;
            at: z.ZodISODateTime;
            reason: z.ZodOptional<z.ZodString>;
            executionId: z.ZodOptional<z.ZodString>;
        }, z.core.$strip>> | import("../types.js").EventDef<"NodeFailed", z.ZodObject<{
            path: z.ZodString;
            phase: z.ZodEnum<{
                do: "do";
                undo: "undo";
            }>;
            attempt: z.ZodInt;
            error: z.ZodString;
            at: z.ZodISODateTime;
        }, z.core.$strip>> | import("../types.js").EventDef<"NodeScheduled", z.ZodObject<{
            actorId: z.ZodOptional<z.ZodString>;
            reason: z.ZodOptional<z.ZodString>;
            executionId: z.ZodOptional<z.ZodString>;
            path: z.ZodString;
            phase: z.ZodEnum<{
                do: "do";
                undo: "undo";
            }>;
            attempt: z.ZodInt;
            key: z.ZodString;
            jobId: z.ZodNullable<z.ZodString>;
            at: z.ZodISODateTime;
            resolution: z.ZodOptional<z.ZodObject<{
                result: z.ZodUnknown;
            }, z.core.$strip>>;
            priority: z.ZodOptional<z.ZodInt32>;
        }, z.core.$strip>> | import("../types.js").EventDef<"NodeSkipped", z.ZodObject<{
            path: z.ZodString;
            phase: z.ZodEnum<{
                do: "do";
                undo: "undo";
            }>;
            cause: z.ZodEnum<{
                compensating: "compensating";
                detached: "detached";
                expired: "expired";
                "no-undo": "no-undo";
                operator: "operator";
                when: "when";
            }>;
            reason: z.ZodString;
            actorId: z.ZodNullable<z.ZodString>;
            at: z.ZodISODateTime;
            executionId: z.ZodOptional<z.ZodString>;
        }, z.core.$strip>> | import("../types.js").EventDef<"Parked", z.ZodObject<{
            node: z.ZodString;
            waitingFor: z.ZodNullable<z.ZodString>;
            wakeAt: z.ZodNullable<z.ZodISODateTime>;
            priority: z.ZodOptional<z.ZodInt32>;
            at: z.ZodISODateTime;
        }, z.core.$strip>> | import("../types.js").EventDef<"RunCancelled", z.ZodObject<{
            at: z.ZodISODateTime;
            keepUntil: z.ZodNullable<z.ZodISODateTime>;
        }, z.core.$strip>> | import("../types.js").EventDef<"RunCompleted", z.ZodObject<{
            output: z.ZodUnknown;
            at: z.ZodISODateTime;
            keepUntil: z.ZodNullable<z.ZodISODateTime>;
        }, z.core.$strip>> | import("../types.js").EventDef<"RunDequeued", z.ZodObject<{
            at: z.ZodISODateTime;
        }, z.core.$strip>> | import("../types.js").EventDef<"RunExpired", z.ZodObject<{
            at: z.ZodISODateTime;
            keepUntil: z.ZodNullable<z.ZodISODateTime>;
        }, z.core.$strip>> | import("../types.js").EventDef<"RunFailed", z.ZodObject<{
            error: z.ZodString;
            at: z.ZodISODateTime;
            keepUntil: z.ZodNullable<z.ZodISODateTime>;
        }, z.core.$strip>> | import("../types.js").EventDef<"RunQueued", z.ZodObject<{
            limitName: z.ZodString;
            reason: z.ZodEnum<{
                full: "full";
                paused: "paused";
            }>;
            ttlAt: z.ZodNullable<z.ZodISODateTime>;
            priority: z.ZodOptional<z.ZodInt32>;
            at: z.ZodISODateTime;
        }, z.core.$strip>> | import("../types.js").EventDef<"RunRescheduled", z.ZodObject<{
            actorId: z.ZodOptional<z.ZodString>;
            reason: z.ZodOptional<z.ZodString>;
            executionId: z.ZodOptional<z.ZodString>;
            startAt: z.ZodISODateTime;
            ttlAt: z.ZodNullable<z.ZodISODateTime>;
            deadlineAt: z.ZodNullable<z.ZodISODateTime>;
            at: z.ZodISODateTime;
        }, z.core.$strip>> | import("../types.js").EventDef<"RunStarted", z.ZodObject<{
            actorId: z.ZodOptional<z.ZodString>;
            reason: z.ZodOptional<z.ZodString>;
            executionId: z.ZodOptional<z.ZodString>;
            name: z.ZodString;
            workflowVersion: z.ZodInt;
            shape: z.ZodReadonly<z.ZodObject<{
                nodes: z.ZodReadonly<z.ZodArray<z.ZodReadonly<z.ZodObject<{
                    name: z.ZodString;
                    kind: z.ZodEnum<{
                        child: "child";
                        command: "command";
                        eventWait: "eventWait";
                        map: "map";
                        parallel: "parallel";
                        sleep: "sleep";
                        step: "step";
                        waitFor: "waitFor";
                    }>;
                    undo: z.ZodBoolean;
                    onCancel: z.ZodOptional<z.ZodEnum<{
                        cancel: "cancel";
                        detach: "detach";
                    }>>;
                    signal: z.ZodOptional<z.ZodString>;
                    command: z.ZodOptional<z.ZodString>;
                    undoCommand: z.ZodOptional<z.ZodString>;
                    on: z.ZodOptional<z.ZodReadonly<z.ZodArray<z.ZodReadonly<z.ZodObject<{
                        label: z.ZodString;
                        entity: z.ZodString;
                        events: z.ZodReadonly<z.ZodArray<z.ZodString>>;
                    }, z.core.$strip>>>>>;
                    wait: z.ZodOptional<z.ZodEnum<{
                        all: "all";
                        any: "any";
                    }>>;
                    branches: z.ZodOptional<z.ZodReadonly<z.ZodArray<z.ZodReadonly<z.ZodObject<{
                        name: z.ZodString;
                        shape: z.ZodType<import("./shape.js").WorkflowShape>;
                    }, z.core.$strip>>>>>;
                }, z.core.$strip>>>>;
            }, z.core.$strip>>;
            shapeHash: z.ZodString;
            input: z.ZodUnknown;
            deadlineAt: z.ZodNullable<z.ZodISODateTime>;
            parentId: z.ZodNullable<z.ZodString>;
            parentPath: z.ZodNullable<z.ZodString>;
            concurrencyKey: z.ZodNullable<z.ZodString>;
            scope: z.ZodOptional<z.ZodNullable<z.ZodString>>;
            tags: z.ZodOptional<z.ZodReadonly<z.ZodArray<z.ZodString>>>;
            metadata: z.ZodOptional<z.ZodReadonly<z.ZodRecord<z.ZodString, z.ZodUnknown>>>;
            rootId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
            startAt: z.ZodOptional<z.ZodNullable<z.ZodISODateTime>>;
            ttlAt: z.ZodOptional<z.ZodNullable<z.ZodISODateTime>>;
            ttlMs: z.ZodOptional<z.ZodNullable<z.ZodInt>>;
            maxAttempts: z.ZodOptional<z.ZodInt>;
            stepTimeoutMs: z.ZodOptional<z.ZodInt>;
            priority: z.ZodOptional<z.ZodInt32>;
            limits: z.ZodOptional<z.ZodReadonly<z.ZodArray<z.ZodString>>>;
            triggerSeq: z.ZodOptional<z.ZodInt>;
            results: z.ZodOptional<z.ZodReadonly<z.ZodRecord<z.ZodString, z.ZodUnknown>>>;
            batchId: z.ZodOptional<z.ZodString>;
            replayOf: z.ZodOptional<z.ZodString>;
            at: z.ZodISODateTime;
        }, z.core.$strip>> | import("../types.js").EventDef<"RunTagged", z.ZodObject<{
            actorId: z.ZodOptional<z.ZodString>;
            reason: z.ZodOptional<z.ZodString>;
            executionId: z.ZodOptional<z.ZodString>;
            tags: z.ZodReadonly<z.ZodArray<z.ZodString>>;
            at: z.ZodISODateTime;
        }, z.core.$strip>> | import("../types.js").EventDef<"SignalReceived", z.ZodObject<{
            actorId: z.ZodOptional<z.ZodString>;
            reason: z.ZodOptional<z.ZodString>;
            executionId: z.ZodOptional<z.ZodString>;
            name: z.ZodString;
            deliveryId: z.ZodString;
            at: z.ZodISODateTime;
        }, z.core.$strip>> | import("../types.js").EventDef<"TimerFired", z.ZodObject<{
            node: z.ZodString;
            at: z.ZodISODateTime;
        }, z.core.$strip>> | import("../types.js").EventDef<"WaitEventTaken", z.ZodObject<{
            node: z.ZodString;
            label: z.ZodString;
            seq: z.ZodInt;
            deliveryId: z.ZodString;
            at: z.ZodISODateTime;
        }, z.core.$strip>>)[], undefined>;
        cancel: import("../api.js").Command<z.ZodReadonly<z.ZodObject<{
            runId: z.ZodString;
            reason: z.ZodString;
            op: z.ZodReadonly<z.ZodObject<{
                actor: z.ZodString;
                reason: z.ZodOptional<z.ZodString>;
                executionId: z.ZodOptional<z.ZodString>;
            }, z.core.$strip>>;
        }, z.core.$strip>>, Promise<Failure<"contracts.random_source_unavailable", undefined> | Failure<"db.transaction_cancelled", undefined> | Failure<"db.transaction_commit_uncertain", undefined> | Failure<"db.transaction_conflict", {
            attempts: number;
            sqlState: "40001" | "40P01";
        }> | Failure<"db.transaction_defect", undefined> | Failure<"db.transaction_rejected", {
            sqlState: string;
        }> | Failure<"db.transaction_unavailable", undefined> | Failure<"failure.unexpected_defect", undefined> | Failure<"journal.conflict", {
            detail: string;
        }> | Failure<"journal.not_found", {
            detail: string;
        }> | Failure<"schema.async_required", undefined> | Failure<"schema.invalid_input", {
            issues: readonly StandardSchemaV1.Issue[];
        }> | Failure<"schema.validator_defect", undefined> | {
            readonly state: (typeof import("./states.js").CANCEL_STATES)[number];
        }>, SchemaOutput<Meta>, Tx, (import("../types.js").EventDef<"CancelRequested", z.ZodObject<{
            reason: z.ZodString;
            actorId: z.ZodNullable<z.ZodString>;
            executionId: z.ZodOptional<z.ZodString>;
            at: z.ZodISODateTime;
        }, z.core.$strip>> | import("../types.js").EventDef<"ChildrenPlanned", z.ZodObject<{
            actorId: z.ZodOptional<z.ZodString>;
            reason: z.ZodOptional<z.ZodString>;
            executionId: z.ZodOptional<z.ZodString>;
            path: z.ZodString;
            base: z.ZodString;
            def: z.ZodObject<{
                name: z.ZodString;
                version: z.ZodInt;
            }, z.core.$strip>;
            children: z.ZodArray<z.ZodObject<{
                id: z.ZodString;
                input: z.ZodUnknown;
                def: z.ZodOptional<z.ZodObject<{
                    name: z.ZodString;
                    version: z.ZodInt;
                }, z.core.$strip>>;
            }, z.core.$strip>>;
            start: z.ZodOptional<z.ZodInt>;
            at: z.ZodISODateTime;
        }, z.core.$strip>> | import("../types.js").EventDef<"CompensationStarted", z.ZodObject<{
            at: z.ZodISODateTime;
        }, z.core.$strip>> | import("../types.js").EventDef<"DeadlineReached", z.ZodObject<{
            at: z.ZodISODateTime;
        }, z.core.$strip>> | import("../types.js").EventDef<"JobRetried", z.ZodObject<{
            actorId: z.ZodOptional<z.ZodString>;
            reason: z.ZodOptional<z.ZodString>;
            executionId: z.ZodOptional<z.ZodString>;
            jobId: z.ZodString;
            node: z.ZodNullable<z.ZodString>;
            at: z.ZodISODateTime;
        }, z.core.$strip>> | import("../types.js").EventDef<"MetadataChanged", z.ZodObject<{
            actorId: z.ZodOptional<z.ZodString>;
            reason: z.ZodOptional<z.ZodString>;
            executionId: z.ZodOptional<z.ZodString>;
            change: z.ZodReadonly<z.ZodDiscriminatedUnion<[z.ZodObject<{
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
            at: z.ZodISODateTime;
        }, z.core.$strip>> | import("../types.js").EventDef<"NodeCompleted", z.ZodObject<{
            path: z.ZodString;
            phase: z.ZodEnum<{
                do: "do";
                undo: "undo";
            }>;
            result: z.ZodUnknown;
            resolvedBy: z.ZodNullable<z.ZodString>;
            at: z.ZodISODateTime;
            reason: z.ZodOptional<z.ZodString>;
            executionId: z.ZodOptional<z.ZodString>;
        }, z.core.$strip>> | import("../types.js").EventDef<"NodeFailed", z.ZodObject<{
            path: z.ZodString;
            phase: z.ZodEnum<{
                do: "do";
                undo: "undo";
            }>;
            attempt: z.ZodInt;
            error: z.ZodString;
            at: z.ZodISODateTime;
        }, z.core.$strip>> | import("../types.js").EventDef<"NodeScheduled", z.ZodObject<{
            actorId: z.ZodOptional<z.ZodString>;
            reason: z.ZodOptional<z.ZodString>;
            executionId: z.ZodOptional<z.ZodString>;
            path: z.ZodString;
            phase: z.ZodEnum<{
                do: "do";
                undo: "undo";
            }>;
            attempt: z.ZodInt;
            key: z.ZodString;
            jobId: z.ZodNullable<z.ZodString>;
            at: z.ZodISODateTime;
            resolution: z.ZodOptional<z.ZodObject<{
                result: z.ZodUnknown;
            }, z.core.$strip>>;
            priority: z.ZodOptional<z.ZodInt32>;
        }, z.core.$strip>> | import("../types.js").EventDef<"NodeSkipped", z.ZodObject<{
            path: z.ZodString;
            phase: z.ZodEnum<{
                do: "do";
                undo: "undo";
            }>;
            cause: z.ZodEnum<{
                compensating: "compensating";
                detached: "detached";
                expired: "expired";
                "no-undo": "no-undo";
                operator: "operator";
                when: "when";
            }>;
            reason: z.ZodString;
            actorId: z.ZodNullable<z.ZodString>;
            at: z.ZodISODateTime;
            executionId: z.ZodOptional<z.ZodString>;
        }, z.core.$strip>> | import("../types.js").EventDef<"Parked", z.ZodObject<{
            node: z.ZodString;
            waitingFor: z.ZodNullable<z.ZodString>;
            wakeAt: z.ZodNullable<z.ZodISODateTime>;
            priority: z.ZodOptional<z.ZodInt32>;
            at: z.ZodISODateTime;
        }, z.core.$strip>> | import("../types.js").EventDef<"RunCancelled", z.ZodObject<{
            at: z.ZodISODateTime;
            keepUntil: z.ZodNullable<z.ZodISODateTime>;
        }, z.core.$strip>> | import("../types.js").EventDef<"RunCompleted", z.ZodObject<{
            output: z.ZodUnknown;
            at: z.ZodISODateTime;
            keepUntil: z.ZodNullable<z.ZodISODateTime>;
        }, z.core.$strip>> | import("../types.js").EventDef<"RunDequeued", z.ZodObject<{
            at: z.ZodISODateTime;
        }, z.core.$strip>> | import("../types.js").EventDef<"RunExpired", z.ZodObject<{
            at: z.ZodISODateTime;
            keepUntil: z.ZodNullable<z.ZodISODateTime>;
        }, z.core.$strip>> | import("../types.js").EventDef<"RunFailed", z.ZodObject<{
            error: z.ZodString;
            at: z.ZodISODateTime;
            keepUntil: z.ZodNullable<z.ZodISODateTime>;
        }, z.core.$strip>> | import("../types.js").EventDef<"RunQueued", z.ZodObject<{
            limitName: z.ZodString;
            reason: z.ZodEnum<{
                full: "full";
                paused: "paused";
            }>;
            ttlAt: z.ZodNullable<z.ZodISODateTime>;
            priority: z.ZodOptional<z.ZodInt32>;
            at: z.ZodISODateTime;
        }, z.core.$strip>> | import("../types.js").EventDef<"RunRescheduled", z.ZodObject<{
            actorId: z.ZodOptional<z.ZodString>;
            reason: z.ZodOptional<z.ZodString>;
            executionId: z.ZodOptional<z.ZodString>;
            startAt: z.ZodISODateTime;
            ttlAt: z.ZodNullable<z.ZodISODateTime>;
            deadlineAt: z.ZodNullable<z.ZodISODateTime>;
            at: z.ZodISODateTime;
        }, z.core.$strip>> | import("../types.js").EventDef<"RunStarted", z.ZodObject<{
            actorId: z.ZodOptional<z.ZodString>;
            reason: z.ZodOptional<z.ZodString>;
            executionId: z.ZodOptional<z.ZodString>;
            name: z.ZodString;
            workflowVersion: z.ZodInt;
            shape: z.ZodReadonly<z.ZodObject<{
                nodes: z.ZodReadonly<z.ZodArray<z.ZodReadonly<z.ZodObject<{
                    name: z.ZodString;
                    kind: z.ZodEnum<{
                        child: "child";
                        command: "command";
                        eventWait: "eventWait";
                        map: "map";
                        parallel: "parallel";
                        sleep: "sleep";
                        step: "step";
                        waitFor: "waitFor";
                    }>;
                    undo: z.ZodBoolean;
                    onCancel: z.ZodOptional<z.ZodEnum<{
                        cancel: "cancel";
                        detach: "detach";
                    }>>;
                    signal: z.ZodOptional<z.ZodString>;
                    command: z.ZodOptional<z.ZodString>;
                    undoCommand: z.ZodOptional<z.ZodString>;
                    on: z.ZodOptional<z.ZodReadonly<z.ZodArray<z.ZodReadonly<z.ZodObject<{
                        label: z.ZodString;
                        entity: z.ZodString;
                        events: z.ZodReadonly<z.ZodArray<z.ZodString>>;
                    }, z.core.$strip>>>>>;
                    wait: z.ZodOptional<z.ZodEnum<{
                        all: "all";
                        any: "any";
                    }>>;
                    branches: z.ZodOptional<z.ZodReadonly<z.ZodArray<z.ZodReadonly<z.ZodObject<{
                        name: z.ZodString;
                        shape: z.ZodType<import("./shape.js").WorkflowShape>;
                    }, z.core.$strip>>>>>;
                }, z.core.$strip>>>>;
            }, z.core.$strip>>;
            shapeHash: z.ZodString;
            input: z.ZodUnknown;
            deadlineAt: z.ZodNullable<z.ZodISODateTime>;
            parentId: z.ZodNullable<z.ZodString>;
            parentPath: z.ZodNullable<z.ZodString>;
            concurrencyKey: z.ZodNullable<z.ZodString>;
            scope: z.ZodOptional<z.ZodNullable<z.ZodString>>;
            tags: z.ZodOptional<z.ZodReadonly<z.ZodArray<z.ZodString>>>;
            metadata: z.ZodOptional<z.ZodReadonly<z.ZodRecord<z.ZodString, z.ZodUnknown>>>;
            rootId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
            startAt: z.ZodOptional<z.ZodNullable<z.ZodISODateTime>>;
            ttlAt: z.ZodOptional<z.ZodNullable<z.ZodISODateTime>>;
            ttlMs: z.ZodOptional<z.ZodNullable<z.ZodInt>>;
            maxAttempts: z.ZodOptional<z.ZodInt>;
            stepTimeoutMs: z.ZodOptional<z.ZodInt>;
            priority: z.ZodOptional<z.ZodInt32>;
            limits: z.ZodOptional<z.ZodReadonly<z.ZodArray<z.ZodString>>>;
            triggerSeq: z.ZodOptional<z.ZodInt>;
            results: z.ZodOptional<z.ZodReadonly<z.ZodRecord<z.ZodString, z.ZodUnknown>>>;
            batchId: z.ZodOptional<z.ZodString>;
            replayOf: z.ZodOptional<z.ZodString>;
            at: z.ZodISODateTime;
        }, z.core.$strip>> | import("../types.js").EventDef<"RunTagged", z.ZodObject<{
            actorId: z.ZodOptional<z.ZodString>;
            reason: z.ZodOptional<z.ZodString>;
            executionId: z.ZodOptional<z.ZodString>;
            tags: z.ZodReadonly<z.ZodArray<z.ZodString>>;
            at: z.ZodISODateTime;
        }, z.core.$strip>> | import("../types.js").EventDef<"SignalReceived", z.ZodObject<{
            actorId: z.ZodOptional<z.ZodString>;
            reason: z.ZodOptional<z.ZodString>;
            executionId: z.ZodOptional<z.ZodString>;
            name: z.ZodString;
            deliveryId: z.ZodString;
            at: z.ZodISODateTime;
        }, z.core.$strip>> | import("../types.js").EventDef<"TimerFired", z.ZodObject<{
            node: z.ZodString;
            at: z.ZodISODateTime;
        }, z.core.$strip>> | import("../types.js").EventDef<"WaitEventTaken", z.ZodObject<{
            node: z.ZodString;
            label: z.ZodString;
            seq: z.ZodInt;
            deliveryId: z.ZodString;
            at: z.ZodISODateTime;
        }, z.core.$strip>>)[], undefined>;
        setMetadata: import("../api.js").Command<z.ZodReadonly<z.ZodObject<{
            runId: z.ZodString;
            change: z.ZodReadonly<z.ZodDiscriminatedUnion<[z.ZodObject<{
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
            op: z.ZodReadonly<z.ZodObject<{
                actor: z.ZodString;
                reason: z.ZodOptional<z.ZodString>;
                executionId: z.ZodOptional<z.ZodString>;
            }, z.core.$strip>>;
        }, z.core.$strip>>, Promise<Failure<"contracts.random_source_unavailable", undefined> | Failure<"db.transaction_cancelled", undefined> | Failure<"db.transaction_commit_uncertain", undefined> | Failure<"db.transaction_conflict", {
            attempts: number;
            sqlState: "40001" | "40P01";
        }> | Failure<"db.transaction_defect", undefined> | Failure<"db.transaction_rejected", {
            sqlState: string;
        }> | Failure<"db.transaction_unavailable", undefined> | Failure<"failure.unexpected_defect", undefined> | Failure<"journal.conflict", {
            detail: string;
        }> | Failure<"journal.invalid", {
            detail: string;
        }> | Failure<"journal.not_found", {
            detail: string;
        }> | Failure<"schema.async_required", undefined> | Failure<"schema.invalid_input", {
            issues: readonly StandardSchemaV1.Issue[];
        }> | Failure<"schema.validator_defect", undefined> | {
            readonly metadata: import("./run-fields.js").RunMetadata;
        }>, SchemaOutput<Meta>, Tx, readonly [import("../types.js").EventDef<"MetadataChanged", z.ZodObject<{
            actorId: z.ZodOptional<z.ZodString>;
            reason: z.ZodOptional<z.ZodString>;
            executionId: z.ZodOptional<z.ZodString>;
            change: z.ZodReadonly<z.ZodDiscriminatedUnion<[z.ZodObject<{
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
            at: z.ZodISODateTime;
        }, z.core.$strip>>], undefined>;
        addTags: import("../api.js").Command<z.ZodReadonly<z.ZodObject<{
            runId: z.ZodString;
            tags: z.ZodReadonly<z.ZodArray<z.ZodString>>;
            op: z.ZodReadonly<z.ZodObject<{
                actor: z.ZodString;
                reason: z.ZodOptional<z.ZodString>;
                executionId: z.ZodOptional<z.ZodString>;
            }, z.core.$strip>>;
        }, z.core.$strip>>, Promise<Failure<"contracts.random_source_unavailable", undefined> | Failure<"db.transaction_cancelled", undefined> | Failure<"db.transaction_commit_uncertain", undefined> | Failure<"db.transaction_conflict", {
            attempts: number;
            sqlState: "40001" | "40P01";
        }> | Failure<"db.transaction_defect", undefined> | Failure<"db.transaction_rejected", {
            sqlState: string;
        }> | Failure<"db.transaction_unavailable", undefined> | Failure<"failure.unexpected_defect", undefined> | Failure<"journal.conflict", {
            detail: string;
        }> | Failure<"journal.invalid", {
            detail: string;
        }> | Failure<"journal.not_found", {
            detail: string;
        }> | Failure<"schema.async_required", undefined> | Failure<"schema.invalid_input", {
            issues: readonly StandardSchemaV1.Issue[];
        }> | Failure<"schema.validator_defect", undefined> | {
            readonly tags: readonly string[];
        }>, SchemaOutput<Meta>, Tx, readonly [import("../types.js").EventDef<"RunTagged", z.ZodObject<{
            actorId: z.ZodOptional<z.ZodString>;
            reason: z.ZodOptional<z.ZodString>;
            executionId: z.ZodOptional<z.ZodString>;
            tags: z.ZodReadonly<z.ZodArray<z.ZodString>>;
            at: z.ZodISODateTime;
        }, z.core.$strip>>], undefined>;
        reschedule: import("../api.js").Command<z.ZodUnion<readonly [z.ZodReadonly<z.ZodObject<{
            runId: z.ZodString;
            delay: z.ZodUnion<readonly [z.ZodNumber, z.ZodTemplateLiteral<`${number}d` | `${number}h` | `${number}m`>]>;
            op: z.ZodReadonly<z.ZodObject<{
                actor: z.ZodString;
                reason: z.ZodOptional<z.ZodString>;
                executionId: z.ZodOptional<z.ZodString>;
            }, z.core.$strip>>;
        }, z.core.$strict>>, z.ZodReadonly<z.ZodObject<{
            runId: z.ZodString;
            at: z.ZodDate;
            op: z.ZodReadonly<z.ZodObject<{
                actor: z.ZodString;
                reason: z.ZodOptional<z.ZodString>;
                executionId: z.ZodOptional<z.ZodString>;
            }, z.core.$strip>>;
        }, z.core.$strict>>]>, Promise<Failure<"contracts.random_source_unavailable", undefined> | Failure<"db.transaction_cancelled", undefined> | Failure<"db.transaction_commit_uncertain", undefined> | Failure<"db.transaction_conflict", {
            attempts: number;
            sqlState: "40001" | "40P01";
        }> | Failure<"db.transaction_defect", undefined> | Failure<"db.transaction_rejected", {
            sqlState: string;
        }> | Failure<"db.transaction_unavailable", undefined> | Failure<"failure.unexpected_defect", undefined> | Failure<"journal.conflict", {
            detail: string;
        }> | Failure<"journal.not_found", {
            detail: string;
        }> | Failure<"schema.async_required", undefined> | Failure<"schema.invalid_input", {
            issues: readonly StandardSchemaV1.Issue[];
        }> | Failure<"schema.validator_defect", undefined> | {
            readonly startAt: string;
        }>, SchemaOutput<Meta>, Tx, (import("../types.js").EventDef<"CancelRequested", z.ZodObject<{
            reason: z.ZodString;
            actorId: z.ZodNullable<z.ZodString>;
            executionId: z.ZodOptional<z.ZodString>;
            at: z.ZodISODateTime;
        }, z.core.$strip>> | import("../types.js").EventDef<"ChildrenPlanned", z.ZodObject<{
            actorId: z.ZodOptional<z.ZodString>;
            reason: z.ZodOptional<z.ZodString>;
            executionId: z.ZodOptional<z.ZodString>;
            path: z.ZodString;
            base: z.ZodString;
            def: z.ZodObject<{
                name: z.ZodString;
                version: z.ZodInt;
            }, z.core.$strip>;
            children: z.ZodArray<z.ZodObject<{
                id: z.ZodString;
                input: z.ZodUnknown;
                def: z.ZodOptional<z.ZodObject<{
                    name: z.ZodString;
                    version: z.ZodInt;
                }, z.core.$strip>>;
            }, z.core.$strip>>;
            start: z.ZodOptional<z.ZodInt>;
            at: z.ZodISODateTime;
        }, z.core.$strip>> | import("../types.js").EventDef<"CompensationStarted", z.ZodObject<{
            at: z.ZodISODateTime;
        }, z.core.$strip>> | import("../types.js").EventDef<"DeadlineReached", z.ZodObject<{
            at: z.ZodISODateTime;
        }, z.core.$strip>> | import("../types.js").EventDef<"JobRetried", z.ZodObject<{
            actorId: z.ZodOptional<z.ZodString>;
            reason: z.ZodOptional<z.ZodString>;
            executionId: z.ZodOptional<z.ZodString>;
            jobId: z.ZodString;
            node: z.ZodNullable<z.ZodString>;
            at: z.ZodISODateTime;
        }, z.core.$strip>> | import("../types.js").EventDef<"MetadataChanged", z.ZodObject<{
            actorId: z.ZodOptional<z.ZodString>;
            reason: z.ZodOptional<z.ZodString>;
            executionId: z.ZodOptional<z.ZodString>;
            change: z.ZodReadonly<z.ZodDiscriminatedUnion<[z.ZodObject<{
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
            at: z.ZodISODateTime;
        }, z.core.$strip>> | import("../types.js").EventDef<"NodeCompleted", z.ZodObject<{
            path: z.ZodString;
            phase: z.ZodEnum<{
                do: "do";
                undo: "undo";
            }>;
            result: z.ZodUnknown;
            resolvedBy: z.ZodNullable<z.ZodString>;
            at: z.ZodISODateTime;
            reason: z.ZodOptional<z.ZodString>;
            executionId: z.ZodOptional<z.ZodString>;
        }, z.core.$strip>> | import("../types.js").EventDef<"NodeFailed", z.ZodObject<{
            path: z.ZodString;
            phase: z.ZodEnum<{
                do: "do";
                undo: "undo";
            }>;
            attempt: z.ZodInt;
            error: z.ZodString;
            at: z.ZodISODateTime;
        }, z.core.$strip>> | import("../types.js").EventDef<"NodeScheduled", z.ZodObject<{
            actorId: z.ZodOptional<z.ZodString>;
            reason: z.ZodOptional<z.ZodString>;
            executionId: z.ZodOptional<z.ZodString>;
            path: z.ZodString;
            phase: z.ZodEnum<{
                do: "do";
                undo: "undo";
            }>;
            attempt: z.ZodInt;
            key: z.ZodString;
            jobId: z.ZodNullable<z.ZodString>;
            at: z.ZodISODateTime;
            resolution: z.ZodOptional<z.ZodObject<{
                result: z.ZodUnknown;
            }, z.core.$strip>>;
            priority: z.ZodOptional<z.ZodInt32>;
        }, z.core.$strip>> | import("../types.js").EventDef<"NodeSkipped", z.ZodObject<{
            path: z.ZodString;
            phase: z.ZodEnum<{
                do: "do";
                undo: "undo";
            }>;
            cause: z.ZodEnum<{
                compensating: "compensating";
                detached: "detached";
                expired: "expired";
                "no-undo": "no-undo";
                operator: "operator";
                when: "when";
            }>;
            reason: z.ZodString;
            actorId: z.ZodNullable<z.ZodString>;
            at: z.ZodISODateTime;
            executionId: z.ZodOptional<z.ZodString>;
        }, z.core.$strip>> | import("../types.js").EventDef<"Parked", z.ZodObject<{
            node: z.ZodString;
            waitingFor: z.ZodNullable<z.ZodString>;
            wakeAt: z.ZodNullable<z.ZodISODateTime>;
            priority: z.ZodOptional<z.ZodInt32>;
            at: z.ZodISODateTime;
        }, z.core.$strip>> | import("../types.js").EventDef<"RunCancelled", z.ZodObject<{
            at: z.ZodISODateTime;
            keepUntil: z.ZodNullable<z.ZodISODateTime>;
        }, z.core.$strip>> | import("../types.js").EventDef<"RunCompleted", z.ZodObject<{
            output: z.ZodUnknown;
            at: z.ZodISODateTime;
            keepUntil: z.ZodNullable<z.ZodISODateTime>;
        }, z.core.$strip>> | import("../types.js").EventDef<"RunDequeued", z.ZodObject<{
            at: z.ZodISODateTime;
        }, z.core.$strip>> | import("../types.js").EventDef<"RunExpired", z.ZodObject<{
            at: z.ZodISODateTime;
            keepUntil: z.ZodNullable<z.ZodISODateTime>;
        }, z.core.$strip>> | import("../types.js").EventDef<"RunFailed", z.ZodObject<{
            error: z.ZodString;
            at: z.ZodISODateTime;
            keepUntil: z.ZodNullable<z.ZodISODateTime>;
        }, z.core.$strip>> | import("../types.js").EventDef<"RunQueued", z.ZodObject<{
            limitName: z.ZodString;
            reason: z.ZodEnum<{
                full: "full";
                paused: "paused";
            }>;
            ttlAt: z.ZodNullable<z.ZodISODateTime>;
            priority: z.ZodOptional<z.ZodInt32>;
            at: z.ZodISODateTime;
        }, z.core.$strip>> | import("../types.js").EventDef<"RunRescheduled", z.ZodObject<{
            actorId: z.ZodOptional<z.ZodString>;
            reason: z.ZodOptional<z.ZodString>;
            executionId: z.ZodOptional<z.ZodString>;
            startAt: z.ZodISODateTime;
            ttlAt: z.ZodNullable<z.ZodISODateTime>;
            deadlineAt: z.ZodNullable<z.ZodISODateTime>;
            at: z.ZodISODateTime;
        }, z.core.$strip>> | import("../types.js").EventDef<"RunStarted", z.ZodObject<{
            actorId: z.ZodOptional<z.ZodString>;
            reason: z.ZodOptional<z.ZodString>;
            executionId: z.ZodOptional<z.ZodString>;
            name: z.ZodString;
            workflowVersion: z.ZodInt;
            shape: z.ZodReadonly<z.ZodObject<{
                nodes: z.ZodReadonly<z.ZodArray<z.ZodReadonly<z.ZodObject<{
                    name: z.ZodString;
                    kind: z.ZodEnum<{
                        child: "child";
                        command: "command";
                        eventWait: "eventWait";
                        map: "map";
                        parallel: "parallel";
                        sleep: "sleep";
                        step: "step";
                        waitFor: "waitFor";
                    }>;
                    undo: z.ZodBoolean;
                    onCancel: z.ZodOptional<z.ZodEnum<{
                        cancel: "cancel";
                        detach: "detach";
                    }>>;
                    signal: z.ZodOptional<z.ZodString>;
                    command: z.ZodOptional<z.ZodString>;
                    undoCommand: z.ZodOptional<z.ZodString>;
                    on: z.ZodOptional<z.ZodReadonly<z.ZodArray<z.ZodReadonly<z.ZodObject<{
                        label: z.ZodString;
                        entity: z.ZodString;
                        events: z.ZodReadonly<z.ZodArray<z.ZodString>>;
                    }, z.core.$strip>>>>>;
                    wait: z.ZodOptional<z.ZodEnum<{
                        all: "all";
                        any: "any";
                    }>>;
                    branches: z.ZodOptional<z.ZodReadonly<z.ZodArray<z.ZodReadonly<z.ZodObject<{
                        name: z.ZodString;
                        shape: z.ZodType<import("./shape.js").WorkflowShape>;
                    }, z.core.$strip>>>>>;
                }, z.core.$strip>>>>;
            }, z.core.$strip>>;
            shapeHash: z.ZodString;
            input: z.ZodUnknown;
            deadlineAt: z.ZodNullable<z.ZodISODateTime>;
            parentId: z.ZodNullable<z.ZodString>;
            parentPath: z.ZodNullable<z.ZodString>;
            concurrencyKey: z.ZodNullable<z.ZodString>;
            scope: z.ZodOptional<z.ZodNullable<z.ZodString>>;
            tags: z.ZodOptional<z.ZodReadonly<z.ZodArray<z.ZodString>>>;
            metadata: z.ZodOptional<z.ZodReadonly<z.ZodRecord<z.ZodString, z.ZodUnknown>>>;
            rootId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
            startAt: z.ZodOptional<z.ZodNullable<z.ZodISODateTime>>;
            ttlAt: z.ZodOptional<z.ZodNullable<z.ZodISODateTime>>;
            ttlMs: z.ZodOptional<z.ZodNullable<z.ZodInt>>;
            maxAttempts: z.ZodOptional<z.ZodInt>;
            stepTimeoutMs: z.ZodOptional<z.ZodInt>;
            priority: z.ZodOptional<z.ZodInt32>;
            limits: z.ZodOptional<z.ZodReadonly<z.ZodArray<z.ZodString>>>;
            triggerSeq: z.ZodOptional<z.ZodInt>;
            results: z.ZodOptional<z.ZodReadonly<z.ZodRecord<z.ZodString, z.ZodUnknown>>>;
            batchId: z.ZodOptional<z.ZodString>;
            replayOf: z.ZodOptional<z.ZodString>;
            at: z.ZodISODateTime;
        }, z.core.$strip>> | import("../types.js").EventDef<"RunTagged", z.ZodObject<{
            actorId: z.ZodOptional<z.ZodString>;
            reason: z.ZodOptional<z.ZodString>;
            executionId: z.ZodOptional<z.ZodString>;
            tags: z.ZodReadonly<z.ZodArray<z.ZodString>>;
            at: z.ZodISODateTime;
        }, z.core.$strip>> | import("../types.js").EventDef<"SignalReceived", z.ZodObject<{
            actorId: z.ZodOptional<z.ZodString>;
            reason: z.ZodOptional<z.ZodString>;
            executionId: z.ZodOptional<z.ZodString>;
            name: z.ZodString;
            deliveryId: z.ZodString;
            at: z.ZodISODateTime;
        }, z.core.$strip>> | import("../types.js").EventDef<"TimerFired", z.ZodObject<{
            node: z.ZodString;
            at: z.ZodISODateTime;
        }, z.core.$strip>> | import("../types.js").EventDef<"WaitEventTaken", z.ZodObject<{
            node: z.ZodString;
            label: z.ZodString;
            seq: z.ZodInt;
            deliveryId: z.ZodString;
            at: z.ZodISODateTime;
        }, z.core.$strip>>)[], undefined>;
        replay: import("../api.js").Command<z.ZodReadonly<z.ZodObject<{
            runId: z.ZodString;
            overrides: z.ZodOptional<z.ZodReadonly<z.ZodObject<{
                scope: z.ZodOptional<z.ZodString>;
                tags: z.ZodOptional<z.ZodReadonly<z.ZodArray<z.ZodString>>>;
                metadata: z.ZodOptional<z.ZodReadonly<z.ZodRecord<z.ZodString, z.ZodUnknown>>>;
                delay: z.ZodOptional<z.ZodUnion<readonly [z.ZodUnion<readonly [z.ZodNumber, z.ZodTemplateLiteral<`${number}d` | `${number}h` | `${number}m`>]>, z.ZodDate]>>;
                ttl: z.ZodOptional<z.ZodUnion<readonly [z.ZodNumber, z.ZodTemplateLiteral<`${number}d` | `${number}h` | `${number}m`>]>>;
                maxAttempts: z.ZodOptional<z.ZodInt>;
                timeout: z.ZodOptional<z.ZodUnion<readonly [z.ZodNumber, z.ZodTemplateLiteral<`${number}d` | `${number}h` | `${number}m`>]>>;
                priority: z.ZodOptional<z.ZodInt32>;
                input: z.ZodOptional<z.ZodUnknown>;
            }, z.core.$strip>>>;
            op: z.ZodReadonly<z.ZodObject<{
                actor: z.ZodString;
                reason: z.ZodOptional<z.ZodString>;
                executionId: z.ZodOptional<z.ZodString>;
            }, z.core.$strip>>;
        }, z.core.$strip>>, Promise<Failure<"contracts.random_source_unavailable", undefined> | Failure<"db.transaction_cancelled", undefined> | Failure<"db.transaction_commit_uncertain", undefined> | Failure<"db.transaction_conflict", {
            attempts: number;
            sqlState: "40001" | "40P01";
        }> | Failure<"db.transaction_defect", undefined> | Failure<"db.transaction_rejected", {
            sqlState: string;
        }> | Failure<"db.transaction_unavailable", undefined> | Failure<"failure.unexpected_defect", undefined> | Failure<"journal.conflict", {
            detail: string;
        }> | Failure<"journal.invalid", {
            detail: string;
        }> | Failure<"journal.not_found", {
            detail: string;
        }> | Failure<"journal.workflow_busy", {
            name: string;
            key: string | null;
            limit: number;
            running: string[];
            limitName?: string | undefined;
            reason?: "full" | "paused" | undefined;
            detail: string;
        }> | Failure<"schema.async_required", undefined> | Failure<"schema.invalid_input", {
            issues: readonly StandardSchemaV1.Issue[];
        }> | Failure<"schema.validator_defect", undefined> | {
            readonly runId: string;
        }>, SchemaOutput<Meta>, Tx, (import("../types.js").EventDef<"CancelRequested", z.ZodObject<{
            reason: z.ZodString;
            actorId: z.ZodNullable<z.ZodString>;
            executionId: z.ZodOptional<z.ZodString>;
            at: z.ZodISODateTime;
        }, z.core.$strip>> | import("../types.js").EventDef<"ChildrenPlanned", z.ZodObject<{
            actorId: z.ZodOptional<z.ZodString>;
            reason: z.ZodOptional<z.ZodString>;
            executionId: z.ZodOptional<z.ZodString>;
            path: z.ZodString;
            base: z.ZodString;
            def: z.ZodObject<{
                name: z.ZodString;
                version: z.ZodInt;
            }, z.core.$strip>;
            children: z.ZodArray<z.ZodObject<{
                id: z.ZodString;
                input: z.ZodUnknown;
                def: z.ZodOptional<z.ZodObject<{
                    name: z.ZodString;
                    version: z.ZodInt;
                }, z.core.$strip>>;
            }, z.core.$strip>>;
            start: z.ZodOptional<z.ZodInt>;
            at: z.ZodISODateTime;
        }, z.core.$strip>> | import("../types.js").EventDef<"CompensationStarted", z.ZodObject<{
            at: z.ZodISODateTime;
        }, z.core.$strip>> | import("../types.js").EventDef<"DeadlineReached", z.ZodObject<{
            at: z.ZodISODateTime;
        }, z.core.$strip>> | import("../types.js").EventDef<"JobRetried", z.ZodObject<{
            actorId: z.ZodOptional<z.ZodString>;
            reason: z.ZodOptional<z.ZodString>;
            executionId: z.ZodOptional<z.ZodString>;
            jobId: z.ZodString;
            node: z.ZodNullable<z.ZodString>;
            at: z.ZodISODateTime;
        }, z.core.$strip>> | import("../types.js").EventDef<"MetadataChanged", z.ZodObject<{
            actorId: z.ZodOptional<z.ZodString>;
            reason: z.ZodOptional<z.ZodString>;
            executionId: z.ZodOptional<z.ZodString>;
            change: z.ZodReadonly<z.ZodDiscriminatedUnion<[z.ZodObject<{
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
            at: z.ZodISODateTime;
        }, z.core.$strip>> | import("../types.js").EventDef<"NodeCompleted", z.ZodObject<{
            path: z.ZodString;
            phase: z.ZodEnum<{
                do: "do";
                undo: "undo";
            }>;
            result: z.ZodUnknown;
            resolvedBy: z.ZodNullable<z.ZodString>;
            at: z.ZodISODateTime;
            reason: z.ZodOptional<z.ZodString>;
            executionId: z.ZodOptional<z.ZodString>;
        }, z.core.$strip>> | import("../types.js").EventDef<"NodeFailed", z.ZodObject<{
            path: z.ZodString;
            phase: z.ZodEnum<{
                do: "do";
                undo: "undo";
            }>;
            attempt: z.ZodInt;
            error: z.ZodString;
            at: z.ZodISODateTime;
        }, z.core.$strip>> | import("../types.js").EventDef<"NodeScheduled", z.ZodObject<{
            actorId: z.ZodOptional<z.ZodString>;
            reason: z.ZodOptional<z.ZodString>;
            executionId: z.ZodOptional<z.ZodString>;
            path: z.ZodString;
            phase: z.ZodEnum<{
                do: "do";
                undo: "undo";
            }>;
            attempt: z.ZodInt;
            key: z.ZodString;
            jobId: z.ZodNullable<z.ZodString>;
            at: z.ZodISODateTime;
            resolution: z.ZodOptional<z.ZodObject<{
                result: z.ZodUnknown;
            }, z.core.$strip>>;
            priority: z.ZodOptional<z.ZodInt32>;
        }, z.core.$strip>> | import("../types.js").EventDef<"NodeSkipped", z.ZodObject<{
            path: z.ZodString;
            phase: z.ZodEnum<{
                do: "do";
                undo: "undo";
            }>;
            cause: z.ZodEnum<{
                compensating: "compensating";
                detached: "detached";
                expired: "expired";
                "no-undo": "no-undo";
                operator: "operator";
                when: "when";
            }>;
            reason: z.ZodString;
            actorId: z.ZodNullable<z.ZodString>;
            at: z.ZodISODateTime;
            executionId: z.ZodOptional<z.ZodString>;
        }, z.core.$strip>> | import("../types.js").EventDef<"Parked", z.ZodObject<{
            node: z.ZodString;
            waitingFor: z.ZodNullable<z.ZodString>;
            wakeAt: z.ZodNullable<z.ZodISODateTime>;
            priority: z.ZodOptional<z.ZodInt32>;
            at: z.ZodISODateTime;
        }, z.core.$strip>> | import("../types.js").EventDef<"RunCancelled", z.ZodObject<{
            at: z.ZodISODateTime;
            keepUntil: z.ZodNullable<z.ZodISODateTime>;
        }, z.core.$strip>> | import("../types.js").EventDef<"RunCompleted", z.ZodObject<{
            output: z.ZodUnknown;
            at: z.ZodISODateTime;
            keepUntil: z.ZodNullable<z.ZodISODateTime>;
        }, z.core.$strip>> | import("../types.js").EventDef<"RunDequeued", z.ZodObject<{
            at: z.ZodISODateTime;
        }, z.core.$strip>> | import("../types.js").EventDef<"RunExpired", z.ZodObject<{
            at: z.ZodISODateTime;
            keepUntil: z.ZodNullable<z.ZodISODateTime>;
        }, z.core.$strip>> | import("../types.js").EventDef<"RunFailed", z.ZodObject<{
            error: z.ZodString;
            at: z.ZodISODateTime;
            keepUntil: z.ZodNullable<z.ZodISODateTime>;
        }, z.core.$strip>> | import("../types.js").EventDef<"RunQueued", z.ZodObject<{
            limitName: z.ZodString;
            reason: z.ZodEnum<{
                full: "full";
                paused: "paused";
            }>;
            ttlAt: z.ZodNullable<z.ZodISODateTime>;
            priority: z.ZodOptional<z.ZodInt32>;
            at: z.ZodISODateTime;
        }, z.core.$strip>> | import("../types.js").EventDef<"RunRescheduled", z.ZodObject<{
            actorId: z.ZodOptional<z.ZodString>;
            reason: z.ZodOptional<z.ZodString>;
            executionId: z.ZodOptional<z.ZodString>;
            startAt: z.ZodISODateTime;
            ttlAt: z.ZodNullable<z.ZodISODateTime>;
            deadlineAt: z.ZodNullable<z.ZodISODateTime>;
            at: z.ZodISODateTime;
        }, z.core.$strip>> | import("../types.js").EventDef<"RunStarted", z.ZodObject<{
            actorId: z.ZodOptional<z.ZodString>;
            reason: z.ZodOptional<z.ZodString>;
            executionId: z.ZodOptional<z.ZodString>;
            name: z.ZodString;
            workflowVersion: z.ZodInt;
            shape: z.ZodReadonly<z.ZodObject<{
                nodes: z.ZodReadonly<z.ZodArray<z.ZodReadonly<z.ZodObject<{
                    name: z.ZodString;
                    kind: z.ZodEnum<{
                        child: "child";
                        command: "command";
                        eventWait: "eventWait";
                        map: "map";
                        parallel: "parallel";
                        sleep: "sleep";
                        step: "step";
                        waitFor: "waitFor";
                    }>;
                    undo: z.ZodBoolean;
                    onCancel: z.ZodOptional<z.ZodEnum<{
                        cancel: "cancel";
                        detach: "detach";
                    }>>;
                    signal: z.ZodOptional<z.ZodString>;
                    command: z.ZodOptional<z.ZodString>;
                    undoCommand: z.ZodOptional<z.ZodString>;
                    on: z.ZodOptional<z.ZodReadonly<z.ZodArray<z.ZodReadonly<z.ZodObject<{
                        label: z.ZodString;
                        entity: z.ZodString;
                        events: z.ZodReadonly<z.ZodArray<z.ZodString>>;
                    }, z.core.$strip>>>>>;
                    wait: z.ZodOptional<z.ZodEnum<{
                        all: "all";
                        any: "any";
                    }>>;
                    branches: z.ZodOptional<z.ZodReadonly<z.ZodArray<z.ZodReadonly<z.ZodObject<{
                        name: z.ZodString;
                        shape: z.ZodType<import("./shape.js").WorkflowShape>;
                    }, z.core.$strip>>>>>;
                }, z.core.$strip>>>>;
            }, z.core.$strip>>;
            shapeHash: z.ZodString;
            input: z.ZodUnknown;
            deadlineAt: z.ZodNullable<z.ZodISODateTime>;
            parentId: z.ZodNullable<z.ZodString>;
            parentPath: z.ZodNullable<z.ZodString>;
            concurrencyKey: z.ZodNullable<z.ZodString>;
            scope: z.ZodOptional<z.ZodNullable<z.ZodString>>;
            tags: z.ZodOptional<z.ZodReadonly<z.ZodArray<z.ZodString>>>;
            metadata: z.ZodOptional<z.ZodReadonly<z.ZodRecord<z.ZodString, z.ZodUnknown>>>;
            rootId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
            startAt: z.ZodOptional<z.ZodNullable<z.ZodISODateTime>>;
            ttlAt: z.ZodOptional<z.ZodNullable<z.ZodISODateTime>>;
            ttlMs: z.ZodOptional<z.ZodNullable<z.ZodInt>>;
            maxAttempts: z.ZodOptional<z.ZodInt>;
            stepTimeoutMs: z.ZodOptional<z.ZodInt>;
            priority: z.ZodOptional<z.ZodInt32>;
            limits: z.ZodOptional<z.ZodReadonly<z.ZodArray<z.ZodString>>>;
            triggerSeq: z.ZodOptional<z.ZodInt>;
            results: z.ZodOptional<z.ZodReadonly<z.ZodRecord<z.ZodString, z.ZodUnknown>>>;
            batchId: z.ZodOptional<z.ZodString>;
            replayOf: z.ZodOptional<z.ZodString>;
            at: z.ZodISODateTime;
        }, z.core.$strip>> | import("../types.js").EventDef<"RunTagged", z.ZodObject<{
            actorId: z.ZodOptional<z.ZodString>;
            reason: z.ZodOptional<z.ZodString>;
            executionId: z.ZodOptional<z.ZodString>;
            tags: z.ZodReadonly<z.ZodArray<z.ZodString>>;
            at: z.ZodISODateTime;
        }, z.core.$strip>> | import("../types.js").EventDef<"SignalReceived", z.ZodObject<{
            actorId: z.ZodOptional<z.ZodString>;
            reason: z.ZodOptional<z.ZodString>;
            executionId: z.ZodOptional<z.ZodString>;
            name: z.ZodString;
            deliveryId: z.ZodString;
            at: z.ZodISODateTime;
        }, z.core.$strip>> | import("../types.js").EventDef<"TimerFired", z.ZodObject<{
            node: z.ZodString;
            at: z.ZodISODateTime;
        }, z.core.$strip>> | import("../types.js").EventDef<"WaitEventTaken", z.ZodObject<{
            node: z.ZodString;
            label: z.ZodString;
            seq: z.ZodInt;
            deliveryId: z.ZodString;
            at: z.ZodISODateTime;
        }, z.core.$strip>>)[], undefined>;
        checkResult: (db: DbHandle, args: {
            readonly runId: string;
            readonly path: string;
            readonly result: unknown;
        }) => Promise<{
            readonly ok: true;
        } | {
            readonly ok: false;
            readonly issues: string;
        } | AsyncSchemaFailure>;
    };
    limits: {
        list: (db: DbHandle) => Promise<LimitView[]>;
        get: (db: DbHandle, name: string) => Promise<LimitView | CommandNotFound>;
        override: import("../api.js").Command<z.ZodUnion<readonly [z.ZodReadonly<z.ZodObject<{
            name: z.ZodString;
            key: z.ZodString;
            perKey: z.ZodInt;
            ttl: z.ZodOptional<z.ZodUnion<readonly [z.ZodNumber, z.ZodTemplateLiteral<`${number}d` | `${number}h` | `${number}m`>]>>;
            op: z.ZodReadonly<z.ZodObject<{
                actor: z.ZodString;
                reason: z.ZodOptional<z.ZodString>;
                executionId: z.ZodOptional<z.ZodString>;
            }, z.core.$strip>>;
        }, z.core.$strict>>, z.ZodReadonly<z.ZodObject<{
            name: z.ZodString;
            total: z.ZodOptional<z.ZodInt>;
            perKey: z.ZodOptional<z.ZodInt>;
            op: z.ZodReadonly<z.ZodObject<{
                actor: z.ZodString;
                reason: z.ZodOptional<z.ZodString>;
                executionId: z.ZodOptional<z.ZodString>;
            }, z.core.$strip>>;
        }, z.core.$strict>>]>, Promise<Failure<"journal.invalid", {
            detail: string;
        }> | Failure<"journal.not_found", {
            detail: string;
        }> | LimitView | CommandFailure>, SchemaOutput<Meta>, Tx, (import("../types.js").EventDef<"CancelRequested", z.ZodObject<{
            reason: z.ZodString;
            actorId: z.ZodNullable<z.ZodString>;
            executionId: z.ZodOptional<z.ZodString>;
            at: z.ZodISODateTime;
        }, z.core.$strip>> | import("../types.js").EventDef<"ChildrenPlanned", z.ZodObject<{
            actorId: z.ZodOptional<z.ZodString>;
            reason: z.ZodOptional<z.ZodString>;
            executionId: z.ZodOptional<z.ZodString>;
            path: z.ZodString;
            base: z.ZodString;
            def: z.ZodObject<{
                name: z.ZodString;
                version: z.ZodInt;
            }, z.core.$strip>;
            children: z.ZodArray<z.ZodObject<{
                id: z.ZodString;
                input: z.ZodUnknown;
                def: z.ZodOptional<z.ZodObject<{
                    name: z.ZodString;
                    version: z.ZodInt;
                }, z.core.$strip>>;
            }, z.core.$strip>>;
            start: z.ZodOptional<z.ZodInt>;
            at: z.ZodISODateTime;
        }, z.core.$strip>> | import("../types.js").EventDef<"CompensationStarted", z.ZodObject<{
            at: z.ZodISODateTime;
        }, z.core.$strip>> | import("../types.js").EventDef<"DeadlineReached", z.ZodObject<{
            at: z.ZodISODateTime;
        }, z.core.$strip>> | import("../types.js").EventDef<"JobRetried", z.ZodObject<{
            actorId: z.ZodOptional<z.ZodString>;
            reason: z.ZodOptional<z.ZodString>;
            executionId: z.ZodOptional<z.ZodString>;
            jobId: z.ZodString;
            node: z.ZodNullable<z.ZodString>;
            at: z.ZodISODateTime;
        }, z.core.$strip>> | import("../types.js").EventDef<"LimitKeyOverridden", z.ZodObject<{
            actorId: z.ZodOptional<z.ZodString>;
            reason: z.ZodOptional<z.ZodString>;
            executionId: z.ZodOptional<z.ZodString>;
            perKey: z.ZodInt;
            until: z.ZodISODateTime;
            key: z.ZodString;
            expired: z.ZodReadonly<z.ZodArray<z.ZodString>>;
            at: z.ZodISODateTime;
        }, z.core.$strip>> | import("../types.js").EventDef<"LimitOverridden", z.ZodObject<{
            actorId: z.ZodOptional<z.ZodString>;
            reason: z.ZodOptional<z.ZodString>;
            executionId: z.ZodOptional<z.ZodString>;
            total: z.ZodOptional<z.ZodInt>;
            perKey: z.ZodOptional<z.ZodInt>;
            at: z.ZodISODateTime;
        }, z.core.$strip>> | import("../types.js").EventDef<"LimitPaused", z.ZodObject<{
            actorId: z.ZodOptional<z.ZodString>;
            reason: z.ZodOptional<z.ZodString>;
            executionId: z.ZodOptional<z.ZodString>;
            at: z.ZodISODateTime;
        }, z.core.$strip>> | import("../types.js").EventDef<"LimitReset", z.ZodObject<{
            actorId: z.ZodOptional<z.ZodString>;
            reason: z.ZodOptional<z.ZodString>;
            executionId: z.ZodOptional<z.ZodString>;
            key: z.ZodOptional<z.ZodString>;
            at: z.ZodISODateTime;
        }, z.core.$strip>> | import("../types.js").EventDef<"LimitResumed", z.ZodObject<{
            actorId: z.ZodOptional<z.ZodString>;
            reason: z.ZodOptional<z.ZodString>;
            executionId: z.ZodOptional<z.ZodString>;
            at: z.ZodISODateTime;
        }, z.core.$strip>> | import("../types.js").EventDef<"MetadataChanged", z.ZodObject<{
            actorId: z.ZodOptional<z.ZodString>;
            reason: z.ZodOptional<z.ZodString>;
            executionId: z.ZodOptional<z.ZodString>;
            change: z.ZodReadonly<z.ZodDiscriminatedUnion<[z.ZodObject<{
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
            at: z.ZodISODateTime;
        }, z.core.$strip>> | import("../types.js").EventDef<"NodeCompleted", z.ZodObject<{
            path: z.ZodString;
            phase: z.ZodEnum<{
                do: "do";
                undo: "undo";
            }>;
            result: z.ZodUnknown;
            resolvedBy: z.ZodNullable<z.ZodString>;
            at: z.ZodISODateTime;
            reason: z.ZodOptional<z.ZodString>;
            executionId: z.ZodOptional<z.ZodString>;
        }, z.core.$strip>> | import("../types.js").EventDef<"NodeFailed", z.ZodObject<{
            path: z.ZodString;
            phase: z.ZodEnum<{
                do: "do";
                undo: "undo";
            }>;
            attempt: z.ZodInt;
            error: z.ZodString;
            at: z.ZodISODateTime;
        }, z.core.$strip>> | import("../types.js").EventDef<"NodeScheduled", z.ZodObject<{
            actorId: z.ZodOptional<z.ZodString>;
            reason: z.ZodOptional<z.ZodString>;
            executionId: z.ZodOptional<z.ZodString>;
            path: z.ZodString;
            phase: z.ZodEnum<{
                do: "do";
                undo: "undo";
            }>;
            attempt: z.ZodInt;
            key: z.ZodString;
            jobId: z.ZodNullable<z.ZodString>;
            at: z.ZodISODateTime;
            resolution: z.ZodOptional<z.ZodObject<{
                result: z.ZodUnknown;
            }, z.core.$strip>>;
            priority: z.ZodOptional<z.ZodInt32>;
        }, z.core.$strip>> | import("../types.js").EventDef<"NodeSkipped", z.ZodObject<{
            path: z.ZodString;
            phase: z.ZodEnum<{
                do: "do";
                undo: "undo";
            }>;
            cause: z.ZodEnum<{
                compensating: "compensating";
                detached: "detached";
                expired: "expired";
                "no-undo": "no-undo";
                operator: "operator";
                when: "when";
            }>;
            reason: z.ZodString;
            actorId: z.ZodNullable<z.ZodString>;
            at: z.ZodISODateTime;
            executionId: z.ZodOptional<z.ZodString>;
        }, z.core.$strip>> | import("../types.js").EventDef<"Parked", z.ZodObject<{
            node: z.ZodString;
            waitingFor: z.ZodNullable<z.ZodString>;
            wakeAt: z.ZodNullable<z.ZodISODateTime>;
            priority: z.ZodOptional<z.ZodInt32>;
            at: z.ZodISODateTime;
        }, z.core.$strip>> | import("../types.js").EventDef<"RunCancelled", z.ZodObject<{
            at: z.ZodISODateTime;
            keepUntil: z.ZodNullable<z.ZodISODateTime>;
        }, z.core.$strip>> | import("../types.js").EventDef<"RunCompleted", z.ZodObject<{
            output: z.ZodUnknown;
            at: z.ZodISODateTime;
            keepUntil: z.ZodNullable<z.ZodISODateTime>;
        }, z.core.$strip>> | import("../types.js").EventDef<"RunDequeued", z.ZodObject<{
            at: z.ZodISODateTime;
        }, z.core.$strip>> | import("../types.js").EventDef<"RunExpired", z.ZodObject<{
            at: z.ZodISODateTime;
            keepUntil: z.ZodNullable<z.ZodISODateTime>;
        }, z.core.$strip>> | import("../types.js").EventDef<"RunFailed", z.ZodObject<{
            error: z.ZodString;
            at: z.ZodISODateTime;
            keepUntil: z.ZodNullable<z.ZodISODateTime>;
        }, z.core.$strip>> | import("../types.js").EventDef<"RunQueued", z.ZodObject<{
            limitName: z.ZodString;
            reason: z.ZodEnum<{
                full: "full";
                paused: "paused";
            }>;
            ttlAt: z.ZodNullable<z.ZodISODateTime>;
            priority: z.ZodOptional<z.ZodInt32>;
            at: z.ZodISODateTime;
        }, z.core.$strip>> | import("../types.js").EventDef<"RunRescheduled", z.ZodObject<{
            actorId: z.ZodOptional<z.ZodString>;
            reason: z.ZodOptional<z.ZodString>;
            executionId: z.ZodOptional<z.ZodString>;
            startAt: z.ZodISODateTime;
            ttlAt: z.ZodNullable<z.ZodISODateTime>;
            deadlineAt: z.ZodNullable<z.ZodISODateTime>;
            at: z.ZodISODateTime;
        }, z.core.$strip>> | import("../types.js").EventDef<"RunStarted", z.ZodObject<{
            actorId: z.ZodOptional<z.ZodString>;
            reason: z.ZodOptional<z.ZodString>;
            executionId: z.ZodOptional<z.ZodString>;
            name: z.ZodString;
            workflowVersion: z.ZodInt;
            shape: z.ZodReadonly<z.ZodObject<{
                nodes: z.ZodReadonly<z.ZodArray<z.ZodReadonly<z.ZodObject<{
                    name: z.ZodString;
                    kind: z.ZodEnum<{
                        child: "child";
                        command: "command";
                        eventWait: "eventWait";
                        map: "map";
                        parallel: "parallel";
                        sleep: "sleep";
                        step: "step";
                        waitFor: "waitFor";
                    }>;
                    undo: z.ZodBoolean;
                    onCancel: z.ZodOptional<z.ZodEnum<{
                        cancel: "cancel";
                        detach: "detach";
                    }>>;
                    signal: z.ZodOptional<z.ZodString>;
                    command: z.ZodOptional<z.ZodString>;
                    undoCommand: z.ZodOptional<z.ZodString>;
                    on: z.ZodOptional<z.ZodReadonly<z.ZodArray<z.ZodReadonly<z.ZodObject<{
                        label: z.ZodString;
                        entity: z.ZodString;
                        events: z.ZodReadonly<z.ZodArray<z.ZodString>>;
                    }, z.core.$strip>>>>>;
                    wait: z.ZodOptional<z.ZodEnum<{
                        all: "all";
                        any: "any";
                    }>>;
                    branches: z.ZodOptional<z.ZodReadonly<z.ZodArray<z.ZodReadonly<z.ZodObject<{
                        name: z.ZodString;
                        shape: z.ZodType<import("./shape.js").WorkflowShape>;
                    }, z.core.$strip>>>>>;
                }, z.core.$strip>>>>;
            }, z.core.$strip>>;
            shapeHash: z.ZodString;
            input: z.ZodUnknown;
            deadlineAt: z.ZodNullable<z.ZodISODateTime>;
            parentId: z.ZodNullable<z.ZodString>;
            parentPath: z.ZodNullable<z.ZodString>;
            concurrencyKey: z.ZodNullable<z.ZodString>;
            scope: z.ZodOptional<z.ZodNullable<z.ZodString>>;
            tags: z.ZodOptional<z.ZodReadonly<z.ZodArray<z.ZodString>>>;
            metadata: z.ZodOptional<z.ZodReadonly<z.ZodRecord<z.ZodString, z.ZodUnknown>>>;
            rootId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
            startAt: z.ZodOptional<z.ZodNullable<z.ZodISODateTime>>;
            ttlAt: z.ZodOptional<z.ZodNullable<z.ZodISODateTime>>;
            ttlMs: z.ZodOptional<z.ZodNullable<z.ZodInt>>;
            maxAttempts: z.ZodOptional<z.ZodInt>;
            stepTimeoutMs: z.ZodOptional<z.ZodInt>;
            priority: z.ZodOptional<z.ZodInt32>;
            limits: z.ZodOptional<z.ZodReadonly<z.ZodArray<z.ZodString>>>;
            triggerSeq: z.ZodOptional<z.ZodInt>;
            results: z.ZodOptional<z.ZodReadonly<z.ZodRecord<z.ZodString, z.ZodUnknown>>>;
            batchId: z.ZodOptional<z.ZodString>;
            replayOf: z.ZodOptional<z.ZodString>;
            at: z.ZodISODateTime;
        }, z.core.$strip>> | import("../types.js").EventDef<"RunTagged", z.ZodObject<{
            actorId: z.ZodOptional<z.ZodString>;
            reason: z.ZodOptional<z.ZodString>;
            executionId: z.ZodOptional<z.ZodString>;
            tags: z.ZodReadonly<z.ZodArray<z.ZodString>>;
            at: z.ZodISODateTime;
        }, z.core.$strip>> | import("../types.js").EventDef<"SignalReceived", z.ZodObject<{
            actorId: z.ZodOptional<z.ZodString>;
            reason: z.ZodOptional<z.ZodString>;
            executionId: z.ZodOptional<z.ZodString>;
            name: z.ZodString;
            deliveryId: z.ZodString;
            at: z.ZodISODateTime;
        }, z.core.$strip>> | import("../types.js").EventDef<"TimerFired", z.ZodObject<{
            node: z.ZodString;
            at: z.ZodISODateTime;
        }, z.core.$strip>> | import("../types.js").EventDef<"WaitEventTaken", z.ZodObject<{
            node: z.ZodString;
            label: z.ZodString;
            seq: z.ZodInt;
            deliveryId: z.ZodString;
            at: z.ZodISODateTime;
        }, z.core.$strip>>)[], undefined>;
        reset: import("../api.js").Command<z.ZodReadonly<z.ZodObject<{
            name: z.ZodString;
            key: z.ZodOptional<z.ZodString>;
            op: z.ZodReadonly<z.ZodObject<{
                actor: z.ZodString;
                reason: z.ZodOptional<z.ZodString>;
                executionId: z.ZodOptional<z.ZodString>;
            }, z.core.$strip>>;
        }, z.core.$strip>>, Promise<Failure<"journal.not_found", {
            detail: string;
        }> | LimitView | CommandFailure>, SchemaOutput<Meta>, Tx, (import("../types.js").EventDef<"CancelRequested", z.ZodObject<{
            reason: z.ZodString;
            actorId: z.ZodNullable<z.ZodString>;
            executionId: z.ZodOptional<z.ZodString>;
            at: z.ZodISODateTime;
        }, z.core.$strip>> | import("../types.js").EventDef<"ChildrenPlanned", z.ZodObject<{
            actorId: z.ZodOptional<z.ZodString>;
            reason: z.ZodOptional<z.ZodString>;
            executionId: z.ZodOptional<z.ZodString>;
            path: z.ZodString;
            base: z.ZodString;
            def: z.ZodObject<{
                name: z.ZodString;
                version: z.ZodInt;
            }, z.core.$strip>;
            children: z.ZodArray<z.ZodObject<{
                id: z.ZodString;
                input: z.ZodUnknown;
                def: z.ZodOptional<z.ZodObject<{
                    name: z.ZodString;
                    version: z.ZodInt;
                }, z.core.$strip>>;
            }, z.core.$strip>>;
            start: z.ZodOptional<z.ZodInt>;
            at: z.ZodISODateTime;
        }, z.core.$strip>> | import("../types.js").EventDef<"CompensationStarted", z.ZodObject<{
            at: z.ZodISODateTime;
        }, z.core.$strip>> | import("../types.js").EventDef<"DeadlineReached", z.ZodObject<{
            at: z.ZodISODateTime;
        }, z.core.$strip>> | import("../types.js").EventDef<"JobRetried", z.ZodObject<{
            actorId: z.ZodOptional<z.ZodString>;
            reason: z.ZodOptional<z.ZodString>;
            executionId: z.ZodOptional<z.ZodString>;
            jobId: z.ZodString;
            node: z.ZodNullable<z.ZodString>;
            at: z.ZodISODateTime;
        }, z.core.$strip>> | import("../types.js").EventDef<"LimitKeyOverridden", z.ZodObject<{
            actorId: z.ZodOptional<z.ZodString>;
            reason: z.ZodOptional<z.ZodString>;
            executionId: z.ZodOptional<z.ZodString>;
            perKey: z.ZodInt;
            until: z.ZodISODateTime;
            key: z.ZodString;
            expired: z.ZodReadonly<z.ZodArray<z.ZodString>>;
            at: z.ZodISODateTime;
        }, z.core.$strip>> | import("../types.js").EventDef<"LimitOverridden", z.ZodObject<{
            actorId: z.ZodOptional<z.ZodString>;
            reason: z.ZodOptional<z.ZodString>;
            executionId: z.ZodOptional<z.ZodString>;
            total: z.ZodOptional<z.ZodInt>;
            perKey: z.ZodOptional<z.ZodInt>;
            at: z.ZodISODateTime;
        }, z.core.$strip>> | import("../types.js").EventDef<"LimitPaused", z.ZodObject<{
            actorId: z.ZodOptional<z.ZodString>;
            reason: z.ZodOptional<z.ZodString>;
            executionId: z.ZodOptional<z.ZodString>;
            at: z.ZodISODateTime;
        }, z.core.$strip>> | import("../types.js").EventDef<"LimitReset", z.ZodObject<{
            actorId: z.ZodOptional<z.ZodString>;
            reason: z.ZodOptional<z.ZodString>;
            executionId: z.ZodOptional<z.ZodString>;
            key: z.ZodOptional<z.ZodString>;
            at: z.ZodISODateTime;
        }, z.core.$strip>> | import("../types.js").EventDef<"LimitResumed", z.ZodObject<{
            actorId: z.ZodOptional<z.ZodString>;
            reason: z.ZodOptional<z.ZodString>;
            executionId: z.ZodOptional<z.ZodString>;
            at: z.ZodISODateTime;
        }, z.core.$strip>> | import("../types.js").EventDef<"MetadataChanged", z.ZodObject<{
            actorId: z.ZodOptional<z.ZodString>;
            reason: z.ZodOptional<z.ZodString>;
            executionId: z.ZodOptional<z.ZodString>;
            change: z.ZodReadonly<z.ZodDiscriminatedUnion<[z.ZodObject<{
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
            at: z.ZodISODateTime;
        }, z.core.$strip>> | import("../types.js").EventDef<"NodeCompleted", z.ZodObject<{
            path: z.ZodString;
            phase: z.ZodEnum<{
                do: "do";
                undo: "undo";
            }>;
            result: z.ZodUnknown;
            resolvedBy: z.ZodNullable<z.ZodString>;
            at: z.ZodISODateTime;
            reason: z.ZodOptional<z.ZodString>;
            executionId: z.ZodOptional<z.ZodString>;
        }, z.core.$strip>> | import("../types.js").EventDef<"NodeFailed", z.ZodObject<{
            path: z.ZodString;
            phase: z.ZodEnum<{
                do: "do";
                undo: "undo";
            }>;
            attempt: z.ZodInt;
            error: z.ZodString;
            at: z.ZodISODateTime;
        }, z.core.$strip>> | import("../types.js").EventDef<"NodeScheduled", z.ZodObject<{
            actorId: z.ZodOptional<z.ZodString>;
            reason: z.ZodOptional<z.ZodString>;
            executionId: z.ZodOptional<z.ZodString>;
            path: z.ZodString;
            phase: z.ZodEnum<{
                do: "do";
                undo: "undo";
            }>;
            attempt: z.ZodInt;
            key: z.ZodString;
            jobId: z.ZodNullable<z.ZodString>;
            at: z.ZodISODateTime;
            resolution: z.ZodOptional<z.ZodObject<{
                result: z.ZodUnknown;
            }, z.core.$strip>>;
            priority: z.ZodOptional<z.ZodInt32>;
        }, z.core.$strip>> | import("../types.js").EventDef<"NodeSkipped", z.ZodObject<{
            path: z.ZodString;
            phase: z.ZodEnum<{
                do: "do";
                undo: "undo";
            }>;
            cause: z.ZodEnum<{
                compensating: "compensating";
                detached: "detached";
                expired: "expired";
                "no-undo": "no-undo";
                operator: "operator";
                when: "when";
            }>;
            reason: z.ZodString;
            actorId: z.ZodNullable<z.ZodString>;
            at: z.ZodISODateTime;
            executionId: z.ZodOptional<z.ZodString>;
        }, z.core.$strip>> | import("../types.js").EventDef<"Parked", z.ZodObject<{
            node: z.ZodString;
            waitingFor: z.ZodNullable<z.ZodString>;
            wakeAt: z.ZodNullable<z.ZodISODateTime>;
            priority: z.ZodOptional<z.ZodInt32>;
            at: z.ZodISODateTime;
        }, z.core.$strip>> | import("../types.js").EventDef<"RunCancelled", z.ZodObject<{
            at: z.ZodISODateTime;
            keepUntil: z.ZodNullable<z.ZodISODateTime>;
        }, z.core.$strip>> | import("../types.js").EventDef<"RunCompleted", z.ZodObject<{
            output: z.ZodUnknown;
            at: z.ZodISODateTime;
            keepUntil: z.ZodNullable<z.ZodISODateTime>;
        }, z.core.$strip>> | import("../types.js").EventDef<"RunDequeued", z.ZodObject<{
            at: z.ZodISODateTime;
        }, z.core.$strip>> | import("../types.js").EventDef<"RunExpired", z.ZodObject<{
            at: z.ZodISODateTime;
            keepUntil: z.ZodNullable<z.ZodISODateTime>;
        }, z.core.$strip>> | import("../types.js").EventDef<"RunFailed", z.ZodObject<{
            error: z.ZodString;
            at: z.ZodISODateTime;
            keepUntil: z.ZodNullable<z.ZodISODateTime>;
        }, z.core.$strip>> | import("../types.js").EventDef<"RunQueued", z.ZodObject<{
            limitName: z.ZodString;
            reason: z.ZodEnum<{
                full: "full";
                paused: "paused";
            }>;
            ttlAt: z.ZodNullable<z.ZodISODateTime>;
            priority: z.ZodOptional<z.ZodInt32>;
            at: z.ZodISODateTime;
        }, z.core.$strip>> | import("../types.js").EventDef<"RunRescheduled", z.ZodObject<{
            actorId: z.ZodOptional<z.ZodString>;
            reason: z.ZodOptional<z.ZodString>;
            executionId: z.ZodOptional<z.ZodString>;
            startAt: z.ZodISODateTime;
            ttlAt: z.ZodNullable<z.ZodISODateTime>;
            deadlineAt: z.ZodNullable<z.ZodISODateTime>;
            at: z.ZodISODateTime;
        }, z.core.$strip>> | import("../types.js").EventDef<"RunStarted", z.ZodObject<{
            actorId: z.ZodOptional<z.ZodString>;
            reason: z.ZodOptional<z.ZodString>;
            executionId: z.ZodOptional<z.ZodString>;
            name: z.ZodString;
            workflowVersion: z.ZodInt;
            shape: z.ZodReadonly<z.ZodObject<{
                nodes: z.ZodReadonly<z.ZodArray<z.ZodReadonly<z.ZodObject<{
                    name: z.ZodString;
                    kind: z.ZodEnum<{
                        child: "child";
                        command: "command";
                        eventWait: "eventWait";
                        map: "map";
                        parallel: "parallel";
                        sleep: "sleep";
                        step: "step";
                        waitFor: "waitFor";
                    }>;
                    undo: z.ZodBoolean;
                    onCancel: z.ZodOptional<z.ZodEnum<{
                        cancel: "cancel";
                        detach: "detach";
                    }>>;
                    signal: z.ZodOptional<z.ZodString>;
                    command: z.ZodOptional<z.ZodString>;
                    undoCommand: z.ZodOptional<z.ZodString>;
                    on: z.ZodOptional<z.ZodReadonly<z.ZodArray<z.ZodReadonly<z.ZodObject<{
                        label: z.ZodString;
                        entity: z.ZodString;
                        events: z.ZodReadonly<z.ZodArray<z.ZodString>>;
                    }, z.core.$strip>>>>>;
                    wait: z.ZodOptional<z.ZodEnum<{
                        all: "all";
                        any: "any";
                    }>>;
                    branches: z.ZodOptional<z.ZodReadonly<z.ZodArray<z.ZodReadonly<z.ZodObject<{
                        name: z.ZodString;
                        shape: z.ZodType<import("./shape.js").WorkflowShape>;
                    }, z.core.$strip>>>>>;
                }, z.core.$strip>>>>;
            }, z.core.$strip>>;
            shapeHash: z.ZodString;
            input: z.ZodUnknown;
            deadlineAt: z.ZodNullable<z.ZodISODateTime>;
            parentId: z.ZodNullable<z.ZodString>;
            parentPath: z.ZodNullable<z.ZodString>;
            concurrencyKey: z.ZodNullable<z.ZodString>;
            scope: z.ZodOptional<z.ZodNullable<z.ZodString>>;
            tags: z.ZodOptional<z.ZodReadonly<z.ZodArray<z.ZodString>>>;
            metadata: z.ZodOptional<z.ZodReadonly<z.ZodRecord<z.ZodString, z.ZodUnknown>>>;
            rootId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
            startAt: z.ZodOptional<z.ZodNullable<z.ZodISODateTime>>;
            ttlAt: z.ZodOptional<z.ZodNullable<z.ZodISODateTime>>;
            ttlMs: z.ZodOptional<z.ZodNullable<z.ZodInt>>;
            maxAttempts: z.ZodOptional<z.ZodInt>;
            stepTimeoutMs: z.ZodOptional<z.ZodInt>;
            priority: z.ZodOptional<z.ZodInt32>;
            limits: z.ZodOptional<z.ZodReadonly<z.ZodArray<z.ZodString>>>;
            triggerSeq: z.ZodOptional<z.ZodInt>;
            results: z.ZodOptional<z.ZodReadonly<z.ZodRecord<z.ZodString, z.ZodUnknown>>>;
            batchId: z.ZodOptional<z.ZodString>;
            replayOf: z.ZodOptional<z.ZodString>;
            at: z.ZodISODateTime;
        }, z.core.$strip>> | import("../types.js").EventDef<"RunTagged", z.ZodObject<{
            actorId: z.ZodOptional<z.ZodString>;
            reason: z.ZodOptional<z.ZodString>;
            executionId: z.ZodOptional<z.ZodString>;
            tags: z.ZodReadonly<z.ZodArray<z.ZodString>>;
            at: z.ZodISODateTime;
        }, z.core.$strip>> | import("../types.js").EventDef<"SignalReceived", z.ZodObject<{
            actorId: z.ZodOptional<z.ZodString>;
            reason: z.ZodOptional<z.ZodString>;
            executionId: z.ZodOptional<z.ZodString>;
            name: z.ZodString;
            deliveryId: z.ZodString;
            at: z.ZodISODateTime;
        }, z.core.$strip>> | import("../types.js").EventDef<"TimerFired", z.ZodObject<{
            node: z.ZodString;
            at: z.ZodISODateTime;
        }, z.core.$strip>> | import("../types.js").EventDef<"WaitEventTaken", z.ZodObject<{
            node: z.ZodString;
            label: z.ZodString;
            seq: z.ZodInt;
            deliveryId: z.ZodString;
            at: z.ZodISODateTime;
        }, z.core.$strip>>)[], undefined>;
        pause: import("../api.js").Command<z.ZodReadonly<z.ZodObject<{
            name: z.ZodString;
            op: z.ZodReadonly<z.ZodObject<{
                actor: z.ZodString;
                reason: z.ZodOptional<z.ZodString>;
                executionId: z.ZodOptional<z.ZodString>;
            }, z.core.$strip>>;
        }, z.core.$strip>>, Promise<Failure<"journal.not_found", {
            detail: string;
        }> | LimitView | CommandFailure>, SchemaOutput<Meta>, Tx, (import("../types.js").EventDef<"CancelRequested", z.ZodObject<{
            reason: z.ZodString;
            actorId: z.ZodNullable<z.ZodString>;
            executionId: z.ZodOptional<z.ZodString>;
            at: z.ZodISODateTime;
        }, z.core.$strip>> | import("../types.js").EventDef<"ChildrenPlanned", z.ZodObject<{
            actorId: z.ZodOptional<z.ZodString>;
            reason: z.ZodOptional<z.ZodString>;
            executionId: z.ZodOptional<z.ZodString>;
            path: z.ZodString;
            base: z.ZodString;
            def: z.ZodObject<{
                name: z.ZodString;
                version: z.ZodInt;
            }, z.core.$strip>;
            children: z.ZodArray<z.ZodObject<{
                id: z.ZodString;
                input: z.ZodUnknown;
                def: z.ZodOptional<z.ZodObject<{
                    name: z.ZodString;
                    version: z.ZodInt;
                }, z.core.$strip>>;
            }, z.core.$strip>>;
            start: z.ZodOptional<z.ZodInt>;
            at: z.ZodISODateTime;
        }, z.core.$strip>> | import("../types.js").EventDef<"CompensationStarted", z.ZodObject<{
            at: z.ZodISODateTime;
        }, z.core.$strip>> | import("../types.js").EventDef<"DeadlineReached", z.ZodObject<{
            at: z.ZodISODateTime;
        }, z.core.$strip>> | import("../types.js").EventDef<"JobRetried", z.ZodObject<{
            actorId: z.ZodOptional<z.ZodString>;
            reason: z.ZodOptional<z.ZodString>;
            executionId: z.ZodOptional<z.ZodString>;
            jobId: z.ZodString;
            node: z.ZodNullable<z.ZodString>;
            at: z.ZodISODateTime;
        }, z.core.$strip>> | import("../types.js").EventDef<"LimitKeyOverridden", z.ZodObject<{
            actorId: z.ZodOptional<z.ZodString>;
            reason: z.ZodOptional<z.ZodString>;
            executionId: z.ZodOptional<z.ZodString>;
            perKey: z.ZodInt;
            until: z.ZodISODateTime;
            key: z.ZodString;
            expired: z.ZodReadonly<z.ZodArray<z.ZodString>>;
            at: z.ZodISODateTime;
        }, z.core.$strip>> | import("../types.js").EventDef<"LimitOverridden", z.ZodObject<{
            actorId: z.ZodOptional<z.ZodString>;
            reason: z.ZodOptional<z.ZodString>;
            executionId: z.ZodOptional<z.ZodString>;
            total: z.ZodOptional<z.ZodInt>;
            perKey: z.ZodOptional<z.ZodInt>;
            at: z.ZodISODateTime;
        }, z.core.$strip>> | import("../types.js").EventDef<"LimitPaused", z.ZodObject<{
            actorId: z.ZodOptional<z.ZodString>;
            reason: z.ZodOptional<z.ZodString>;
            executionId: z.ZodOptional<z.ZodString>;
            at: z.ZodISODateTime;
        }, z.core.$strip>> | import("../types.js").EventDef<"LimitReset", z.ZodObject<{
            actorId: z.ZodOptional<z.ZodString>;
            reason: z.ZodOptional<z.ZodString>;
            executionId: z.ZodOptional<z.ZodString>;
            key: z.ZodOptional<z.ZodString>;
            at: z.ZodISODateTime;
        }, z.core.$strip>> | import("../types.js").EventDef<"LimitResumed", z.ZodObject<{
            actorId: z.ZodOptional<z.ZodString>;
            reason: z.ZodOptional<z.ZodString>;
            executionId: z.ZodOptional<z.ZodString>;
            at: z.ZodISODateTime;
        }, z.core.$strip>> | import("../types.js").EventDef<"MetadataChanged", z.ZodObject<{
            actorId: z.ZodOptional<z.ZodString>;
            reason: z.ZodOptional<z.ZodString>;
            executionId: z.ZodOptional<z.ZodString>;
            change: z.ZodReadonly<z.ZodDiscriminatedUnion<[z.ZodObject<{
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
            at: z.ZodISODateTime;
        }, z.core.$strip>> | import("../types.js").EventDef<"NodeCompleted", z.ZodObject<{
            path: z.ZodString;
            phase: z.ZodEnum<{
                do: "do";
                undo: "undo";
            }>;
            result: z.ZodUnknown;
            resolvedBy: z.ZodNullable<z.ZodString>;
            at: z.ZodISODateTime;
            reason: z.ZodOptional<z.ZodString>;
            executionId: z.ZodOptional<z.ZodString>;
        }, z.core.$strip>> | import("../types.js").EventDef<"NodeFailed", z.ZodObject<{
            path: z.ZodString;
            phase: z.ZodEnum<{
                do: "do";
                undo: "undo";
            }>;
            attempt: z.ZodInt;
            error: z.ZodString;
            at: z.ZodISODateTime;
        }, z.core.$strip>> | import("../types.js").EventDef<"NodeScheduled", z.ZodObject<{
            actorId: z.ZodOptional<z.ZodString>;
            reason: z.ZodOptional<z.ZodString>;
            executionId: z.ZodOptional<z.ZodString>;
            path: z.ZodString;
            phase: z.ZodEnum<{
                do: "do";
                undo: "undo";
            }>;
            attempt: z.ZodInt;
            key: z.ZodString;
            jobId: z.ZodNullable<z.ZodString>;
            at: z.ZodISODateTime;
            resolution: z.ZodOptional<z.ZodObject<{
                result: z.ZodUnknown;
            }, z.core.$strip>>;
            priority: z.ZodOptional<z.ZodInt32>;
        }, z.core.$strip>> | import("../types.js").EventDef<"NodeSkipped", z.ZodObject<{
            path: z.ZodString;
            phase: z.ZodEnum<{
                do: "do";
                undo: "undo";
            }>;
            cause: z.ZodEnum<{
                compensating: "compensating";
                detached: "detached";
                expired: "expired";
                "no-undo": "no-undo";
                operator: "operator";
                when: "when";
            }>;
            reason: z.ZodString;
            actorId: z.ZodNullable<z.ZodString>;
            at: z.ZodISODateTime;
            executionId: z.ZodOptional<z.ZodString>;
        }, z.core.$strip>> | import("../types.js").EventDef<"Parked", z.ZodObject<{
            node: z.ZodString;
            waitingFor: z.ZodNullable<z.ZodString>;
            wakeAt: z.ZodNullable<z.ZodISODateTime>;
            priority: z.ZodOptional<z.ZodInt32>;
            at: z.ZodISODateTime;
        }, z.core.$strip>> | import("../types.js").EventDef<"RunCancelled", z.ZodObject<{
            at: z.ZodISODateTime;
            keepUntil: z.ZodNullable<z.ZodISODateTime>;
        }, z.core.$strip>> | import("../types.js").EventDef<"RunCompleted", z.ZodObject<{
            output: z.ZodUnknown;
            at: z.ZodISODateTime;
            keepUntil: z.ZodNullable<z.ZodISODateTime>;
        }, z.core.$strip>> | import("../types.js").EventDef<"RunDequeued", z.ZodObject<{
            at: z.ZodISODateTime;
        }, z.core.$strip>> | import("../types.js").EventDef<"RunExpired", z.ZodObject<{
            at: z.ZodISODateTime;
            keepUntil: z.ZodNullable<z.ZodISODateTime>;
        }, z.core.$strip>> | import("../types.js").EventDef<"RunFailed", z.ZodObject<{
            error: z.ZodString;
            at: z.ZodISODateTime;
            keepUntil: z.ZodNullable<z.ZodISODateTime>;
        }, z.core.$strip>> | import("../types.js").EventDef<"RunQueued", z.ZodObject<{
            limitName: z.ZodString;
            reason: z.ZodEnum<{
                full: "full";
                paused: "paused";
            }>;
            ttlAt: z.ZodNullable<z.ZodISODateTime>;
            priority: z.ZodOptional<z.ZodInt32>;
            at: z.ZodISODateTime;
        }, z.core.$strip>> | import("../types.js").EventDef<"RunRescheduled", z.ZodObject<{
            actorId: z.ZodOptional<z.ZodString>;
            reason: z.ZodOptional<z.ZodString>;
            executionId: z.ZodOptional<z.ZodString>;
            startAt: z.ZodISODateTime;
            ttlAt: z.ZodNullable<z.ZodISODateTime>;
            deadlineAt: z.ZodNullable<z.ZodISODateTime>;
            at: z.ZodISODateTime;
        }, z.core.$strip>> | import("../types.js").EventDef<"RunStarted", z.ZodObject<{
            actorId: z.ZodOptional<z.ZodString>;
            reason: z.ZodOptional<z.ZodString>;
            executionId: z.ZodOptional<z.ZodString>;
            name: z.ZodString;
            workflowVersion: z.ZodInt;
            shape: z.ZodReadonly<z.ZodObject<{
                nodes: z.ZodReadonly<z.ZodArray<z.ZodReadonly<z.ZodObject<{
                    name: z.ZodString;
                    kind: z.ZodEnum<{
                        child: "child";
                        command: "command";
                        eventWait: "eventWait";
                        map: "map";
                        parallel: "parallel";
                        sleep: "sleep";
                        step: "step";
                        waitFor: "waitFor";
                    }>;
                    undo: z.ZodBoolean;
                    onCancel: z.ZodOptional<z.ZodEnum<{
                        cancel: "cancel";
                        detach: "detach";
                    }>>;
                    signal: z.ZodOptional<z.ZodString>;
                    command: z.ZodOptional<z.ZodString>;
                    undoCommand: z.ZodOptional<z.ZodString>;
                    on: z.ZodOptional<z.ZodReadonly<z.ZodArray<z.ZodReadonly<z.ZodObject<{
                        label: z.ZodString;
                        entity: z.ZodString;
                        events: z.ZodReadonly<z.ZodArray<z.ZodString>>;
                    }, z.core.$strip>>>>>;
                    wait: z.ZodOptional<z.ZodEnum<{
                        all: "all";
                        any: "any";
                    }>>;
                    branches: z.ZodOptional<z.ZodReadonly<z.ZodArray<z.ZodReadonly<z.ZodObject<{
                        name: z.ZodString;
                        shape: z.ZodType<import("./shape.js").WorkflowShape>;
                    }, z.core.$strip>>>>>;
                }, z.core.$strip>>>>;
            }, z.core.$strip>>;
            shapeHash: z.ZodString;
            input: z.ZodUnknown;
            deadlineAt: z.ZodNullable<z.ZodISODateTime>;
            parentId: z.ZodNullable<z.ZodString>;
            parentPath: z.ZodNullable<z.ZodString>;
            concurrencyKey: z.ZodNullable<z.ZodString>;
            scope: z.ZodOptional<z.ZodNullable<z.ZodString>>;
            tags: z.ZodOptional<z.ZodReadonly<z.ZodArray<z.ZodString>>>;
            metadata: z.ZodOptional<z.ZodReadonly<z.ZodRecord<z.ZodString, z.ZodUnknown>>>;
            rootId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
            startAt: z.ZodOptional<z.ZodNullable<z.ZodISODateTime>>;
            ttlAt: z.ZodOptional<z.ZodNullable<z.ZodISODateTime>>;
            ttlMs: z.ZodOptional<z.ZodNullable<z.ZodInt>>;
            maxAttempts: z.ZodOptional<z.ZodInt>;
            stepTimeoutMs: z.ZodOptional<z.ZodInt>;
            priority: z.ZodOptional<z.ZodInt32>;
            limits: z.ZodOptional<z.ZodReadonly<z.ZodArray<z.ZodString>>>;
            triggerSeq: z.ZodOptional<z.ZodInt>;
            results: z.ZodOptional<z.ZodReadonly<z.ZodRecord<z.ZodString, z.ZodUnknown>>>;
            batchId: z.ZodOptional<z.ZodString>;
            replayOf: z.ZodOptional<z.ZodString>;
            at: z.ZodISODateTime;
        }, z.core.$strip>> | import("../types.js").EventDef<"RunTagged", z.ZodObject<{
            actorId: z.ZodOptional<z.ZodString>;
            reason: z.ZodOptional<z.ZodString>;
            executionId: z.ZodOptional<z.ZodString>;
            tags: z.ZodReadonly<z.ZodArray<z.ZodString>>;
            at: z.ZodISODateTime;
        }, z.core.$strip>> | import("../types.js").EventDef<"SignalReceived", z.ZodObject<{
            actorId: z.ZodOptional<z.ZodString>;
            reason: z.ZodOptional<z.ZodString>;
            executionId: z.ZodOptional<z.ZodString>;
            name: z.ZodString;
            deliveryId: z.ZodString;
            at: z.ZodISODateTime;
        }, z.core.$strip>> | import("../types.js").EventDef<"TimerFired", z.ZodObject<{
            node: z.ZodString;
            at: z.ZodISODateTime;
        }, z.core.$strip>> | import("../types.js").EventDef<"WaitEventTaken", z.ZodObject<{
            node: z.ZodString;
            label: z.ZodString;
            seq: z.ZodInt;
            deliveryId: z.ZodString;
            at: z.ZodISODateTime;
        }, z.core.$strip>>)[], undefined>;
        resume: import("../api.js").Command<z.ZodReadonly<z.ZodObject<{
            name: z.ZodString;
            op: z.ZodReadonly<z.ZodObject<{
                actor: z.ZodString;
                reason: z.ZodOptional<z.ZodString>;
                executionId: z.ZodOptional<z.ZodString>;
            }, z.core.$strip>>;
        }, z.core.$strip>>, Promise<Failure<"journal.not_found", {
            detail: string;
        }> | LimitView | CommandFailure>, SchemaOutput<Meta>, Tx, (import("../types.js").EventDef<"CancelRequested", z.ZodObject<{
            reason: z.ZodString;
            actorId: z.ZodNullable<z.ZodString>;
            executionId: z.ZodOptional<z.ZodString>;
            at: z.ZodISODateTime;
        }, z.core.$strip>> | import("../types.js").EventDef<"ChildrenPlanned", z.ZodObject<{
            actorId: z.ZodOptional<z.ZodString>;
            reason: z.ZodOptional<z.ZodString>;
            executionId: z.ZodOptional<z.ZodString>;
            path: z.ZodString;
            base: z.ZodString;
            def: z.ZodObject<{
                name: z.ZodString;
                version: z.ZodInt;
            }, z.core.$strip>;
            children: z.ZodArray<z.ZodObject<{
                id: z.ZodString;
                input: z.ZodUnknown;
                def: z.ZodOptional<z.ZodObject<{
                    name: z.ZodString;
                    version: z.ZodInt;
                }, z.core.$strip>>;
            }, z.core.$strip>>;
            start: z.ZodOptional<z.ZodInt>;
            at: z.ZodISODateTime;
        }, z.core.$strip>> | import("../types.js").EventDef<"CompensationStarted", z.ZodObject<{
            at: z.ZodISODateTime;
        }, z.core.$strip>> | import("../types.js").EventDef<"DeadlineReached", z.ZodObject<{
            at: z.ZodISODateTime;
        }, z.core.$strip>> | import("../types.js").EventDef<"JobRetried", z.ZodObject<{
            actorId: z.ZodOptional<z.ZodString>;
            reason: z.ZodOptional<z.ZodString>;
            executionId: z.ZodOptional<z.ZodString>;
            jobId: z.ZodString;
            node: z.ZodNullable<z.ZodString>;
            at: z.ZodISODateTime;
        }, z.core.$strip>> | import("../types.js").EventDef<"LimitKeyOverridden", z.ZodObject<{
            actorId: z.ZodOptional<z.ZodString>;
            reason: z.ZodOptional<z.ZodString>;
            executionId: z.ZodOptional<z.ZodString>;
            perKey: z.ZodInt;
            until: z.ZodISODateTime;
            key: z.ZodString;
            expired: z.ZodReadonly<z.ZodArray<z.ZodString>>;
            at: z.ZodISODateTime;
        }, z.core.$strip>> | import("../types.js").EventDef<"LimitOverridden", z.ZodObject<{
            actorId: z.ZodOptional<z.ZodString>;
            reason: z.ZodOptional<z.ZodString>;
            executionId: z.ZodOptional<z.ZodString>;
            total: z.ZodOptional<z.ZodInt>;
            perKey: z.ZodOptional<z.ZodInt>;
            at: z.ZodISODateTime;
        }, z.core.$strip>> | import("../types.js").EventDef<"LimitPaused", z.ZodObject<{
            actorId: z.ZodOptional<z.ZodString>;
            reason: z.ZodOptional<z.ZodString>;
            executionId: z.ZodOptional<z.ZodString>;
            at: z.ZodISODateTime;
        }, z.core.$strip>> | import("../types.js").EventDef<"LimitReset", z.ZodObject<{
            actorId: z.ZodOptional<z.ZodString>;
            reason: z.ZodOptional<z.ZodString>;
            executionId: z.ZodOptional<z.ZodString>;
            key: z.ZodOptional<z.ZodString>;
            at: z.ZodISODateTime;
        }, z.core.$strip>> | import("../types.js").EventDef<"LimitResumed", z.ZodObject<{
            actorId: z.ZodOptional<z.ZodString>;
            reason: z.ZodOptional<z.ZodString>;
            executionId: z.ZodOptional<z.ZodString>;
            at: z.ZodISODateTime;
        }, z.core.$strip>> | import("../types.js").EventDef<"MetadataChanged", z.ZodObject<{
            actorId: z.ZodOptional<z.ZodString>;
            reason: z.ZodOptional<z.ZodString>;
            executionId: z.ZodOptional<z.ZodString>;
            change: z.ZodReadonly<z.ZodDiscriminatedUnion<[z.ZodObject<{
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
            at: z.ZodISODateTime;
        }, z.core.$strip>> | import("../types.js").EventDef<"NodeCompleted", z.ZodObject<{
            path: z.ZodString;
            phase: z.ZodEnum<{
                do: "do";
                undo: "undo";
            }>;
            result: z.ZodUnknown;
            resolvedBy: z.ZodNullable<z.ZodString>;
            at: z.ZodISODateTime;
            reason: z.ZodOptional<z.ZodString>;
            executionId: z.ZodOptional<z.ZodString>;
        }, z.core.$strip>> | import("../types.js").EventDef<"NodeFailed", z.ZodObject<{
            path: z.ZodString;
            phase: z.ZodEnum<{
                do: "do";
                undo: "undo";
            }>;
            attempt: z.ZodInt;
            error: z.ZodString;
            at: z.ZodISODateTime;
        }, z.core.$strip>> | import("../types.js").EventDef<"NodeScheduled", z.ZodObject<{
            actorId: z.ZodOptional<z.ZodString>;
            reason: z.ZodOptional<z.ZodString>;
            executionId: z.ZodOptional<z.ZodString>;
            path: z.ZodString;
            phase: z.ZodEnum<{
                do: "do";
                undo: "undo";
            }>;
            attempt: z.ZodInt;
            key: z.ZodString;
            jobId: z.ZodNullable<z.ZodString>;
            at: z.ZodISODateTime;
            resolution: z.ZodOptional<z.ZodObject<{
                result: z.ZodUnknown;
            }, z.core.$strip>>;
            priority: z.ZodOptional<z.ZodInt32>;
        }, z.core.$strip>> | import("../types.js").EventDef<"NodeSkipped", z.ZodObject<{
            path: z.ZodString;
            phase: z.ZodEnum<{
                do: "do";
                undo: "undo";
            }>;
            cause: z.ZodEnum<{
                compensating: "compensating";
                detached: "detached";
                expired: "expired";
                "no-undo": "no-undo";
                operator: "operator";
                when: "when";
            }>;
            reason: z.ZodString;
            actorId: z.ZodNullable<z.ZodString>;
            at: z.ZodISODateTime;
            executionId: z.ZodOptional<z.ZodString>;
        }, z.core.$strip>> | import("../types.js").EventDef<"Parked", z.ZodObject<{
            node: z.ZodString;
            waitingFor: z.ZodNullable<z.ZodString>;
            wakeAt: z.ZodNullable<z.ZodISODateTime>;
            priority: z.ZodOptional<z.ZodInt32>;
            at: z.ZodISODateTime;
        }, z.core.$strip>> | import("../types.js").EventDef<"RunCancelled", z.ZodObject<{
            at: z.ZodISODateTime;
            keepUntil: z.ZodNullable<z.ZodISODateTime>;
        }, z.core.$strip>> | import("../types.js").EventDef<"RunCompleted", z.ZodObject<{
            output: z.ZodUnknown;
            at: z.ZodISODateTime;
            keepUntil: z.ZodNullable<z.ZodISODateTime>;
        }, z.core.$strip>> | import("../types.js").EventDef<"RunDequeued", z.ZodObject<{
            at: z.ZodISODateTime;
        }, z.core.$strip>> | import("../types.js").EventDef<"RunExpired", z.ZodObject<{
            at: z.ZodISODateTime;
            keepUntil: z.ZodNullable<z.ZodISODateTime>;
        }, z.core.$strip>> | import("../types.js").EventDef<"RunFailed", z.ZodObject<{
            error: z.ZodString;
            at: z.ZodISODateTime;
            keepUntil: z.ZodNullable<z.ZodISODateTime>;
        }, z.core.$strip>> | import("../types.js").EventDef<"RunQueued", z.ZodObject<{
            limitName: z.ZodString;
            reason: z.ZodEnum<{
                full: "full";
                paused: "paused";
            }>;
            ttlAt: z.ZodNullable<z.ZodISODateTime>;
            priority: z.ZodOptional<z.ZodInt32>;
            at: z.ZodISODateTime;
        }, z.core.$strip>> | import("../types.js").EventDef<"RunRescheduled", z.ZodObject<{
            actorId: z.ZodOptional<z.ZodString>;
            reason: z.ZodOptional<z.ZodString>;
            executionId: z.ZodOptional<z.ZodString>;
            startAt: z.ZodISODateTime;
            ttlAt: z.ZodNullable<z.ZodISODateTime>;
            deadlineAt: z.ZodNullable<z.ZodISODateTime>;
            at: z.ZodISODateTime;
        }, z.core.$strip>> | import("../types.js").EventDef<"RunStarted", z.ZodObject<{
            actorId: z.ZodOptional<z.ZodString>;
            reason: z.ZodOptional<z.ZodString>;
            executionId: z.ZodOptional<z.ZodString>;
            name: z.ZodString;
            workflowVersion: z.ZodInt;
            shape: z.ZodReadonly<z.ZodObject<{
                nodes: z.ZodReadonly<z.ZodArray<z.ZodReadonly<z.ZodObject<{
                    name: z.ZodString;
                    kind: z.ZodEnum<{
                        child: "child";
                        command: "command";
                        eventWait: "eventWait";
                        map: "map";
                        parallel: "parallel";
                        sleep: "sleep";
                        step: "step";
                        waitFor: "waitFor";
                    }>;
                    undo: z.ZodBoolean;
                    onCancel: z.ZodOptional<z.ZodEnum<{
                        cancel: "cancel";
                        detach: "detach";
                    }>>;
                    signal: z.ZodOptional<z.ZodString>;
                    command: z.ZodOptional<z.ZodString>;
                    undoCommand: z.ZodOptional<z.ZodString>;
                    on: z.ZodOptional<z.ZodReadonly<z.ZodArray<z.ZodReadonly<z.ZodObject<{
                        label: z.ZodString;
                        entity: z.ZodString;
                        events: z.ZodReadonly<z.ZodArray<z.ZodString>>;
                    }, z.core.$strip>>>>>;
                    wait: z.ZodOptional<z.ZodEnum<{
                        all: "all";
                        any: "any";
                    }>>;
                    branches: z.ZodOptional<z.ZodReadonly<z.ZodArray<z.ZodReadonly<z.ZodObject<{
                        name: z.ZodString;
                        shape: z.ZodType<import("./shape.js").WorkflowShape>;
                    }, z.core.$strip>>>>>;
                }, z.core.$strip>>>>;
            }, z.core.$strip>>;
            shapeHash: z.ZodString;
            input: z.ZodUnknown;
            deadlineAt: z.ZodNullable<z.ZodISODateTime>;
            parentId: z.ZodNullable<z.ZodString>;
            parentPath: z.ZodNullable<z.ZodString>;
            concurrencyKey: z.ZodNullable<z.ZodString>;
            scope: z.ZodOptional<z.ZodNullable<z.ZodString>>;
            tags: z.ZodOptional<z.ZodReadonly<z.ZodArray<z.ZodString>>>;
            metadata: z.ZodOptional<z.ZodReadonly<z.ZodRecord<z.ZodString, z.ZodUnknown>>>;
            rootId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
            startAt: z.ZodOptional<z.ZodNullable<z.ZodISODateTime>>;
            ttlAt: z.ZodOptional<z.ZodNullable<z.ZodISODateTime>>;
            ttlMs: z.ZodOptional<z.ZodNullable<z.ZodInt>>;
            maxAttempts: z.ZodOptional<z.ZodInt>;
            stepTimeoutMs: z.ZodOptional<z.ZodInt>;
            priority: z.ZodOptional<z.ZodInt32>;
            limits: z.ZodOptional<z.ZodReadonly<z.ZodArray<z.ZodString>>>;
            triggerSeq: z.ZodOptional<z.ZodInt>;
            results: z.ZodOptional<z.ZodReadonly<z.ZodRecord<z.ZodString, z.ZodUnknown>>>;
            batchId: z.ZodOptional<z.ZodString>;
            replayOf: z.ZodOptional<z.ZodString>;
            at: z.ZodISODateTime;
        }, z.core.$strip>> | import("../types.js").EventDef<"RunTagged", z.ZodObject<{
            actorId: z.ZodOptional<z.ZodString>;
            reason: z.ZodOptional<z.ZodString>;
            executionId: z.ZodOptional<z.ZodString>;
            tags: z.ZodReadonly<z.ZodArray<z.ZodString>>;
            at: z.ZodISODateTime;
        }, z.core.$strip>> | import("../types.js").EventDef<"SignalReceived", z.ZodObject<{
            actorId: z.ZodOptional<z.ZodString>;
            reason: z.ZodOptional<z.ZodString>;
            executionId: z.ZodOptional<z.ZodString>;
            name: z.ZodString;
            deliveryId: z.ZodString;
            at: z.ZodISODateTime;
        }, z.core.$strip>> | import("../types.js").EventDef<"TimerFired", z.ZodObject<{
            node: z.ZodString;
            at: z.ZodISODateTime;
        }, z.core.$strip>> | import("../types.js").EventDef<"WaitEventTaken", z.ZodObject<{
            node: z.ZodString;
            label: z.ZodString;
            seq: z.ZodInt;
            deliveryId: z.ZodString;
            at: z.ZodISODateTime;
        }, z.core.$strip>>)[], undefined>;
    };
};
export {};
//# sourceMappingURL=runner.d.ts.map