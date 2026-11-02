import type { Failure } from '@arki/failure';
import type { Backoff } from '@arki/resilience';
import type { SchemaInput, SchemaOutput, StandardSchemaV1 } from '@arki/schema';
import type { RetentionAge, RunRetention } from '../retention.js';
import type { AcceptFailure, AnyEntity, AnyEventDef, BivariantFn, EntityDef, EntityIdOf, EntityTable, EventsOf, Needed, Needs, NoNeeds, Recorded, RecordedOf, RootDb, ServicesFor } from '../types.js';
import type { LimitDef } from './limit-types.js';
import type { ON_BUSY } from './states.js';
import type { RunDetail } from './read.js';
import type { MetadataContext, TagsContext } from './run-fields.js';
import type { WorkflowShape } from './shape.js';
import { START_TIMINGS } from './states.js';
/** What a node body sees. `results` has one key per earlier node. */
export type StepContext<Input, Results, N extends Needs = NoNeeds, AppDb = RootDb, Run = unknown> = Needed<N> & {
    readonly runId: string;
    readonly path: string;
    readonly attempt: number;
    readonly input: Input;
    readonly results: Results;
    /** This step's idempotency key. Stable across attempts and re-claims. */
    readonly key: string;
    /** Aborted on lease loss, stop, or the step's timeout. */
    readonly signal: AbortSignal;
    readonly db: AppDb;
    readonly run: Run;
    readonly accept: AcceptFailure;
    /** Changes this run's metadata, one committed event per call. A refusal is returned and does not fail the step. */
    readonly metadata: MetadataContext;
    /** Adds tags to this run, one committed event per call, like `metadata`. */
    readonly tags: TagsContext;
};
/** The context as the runner builds it: nothing is known about the input or the results. */
export type ErasedContext = StepContext<unknown, Readonly<Record<string, unknown>>, Needs, unknown, unknown>;
/**
 * The library's claim for typed reads. The runner keeps a run's results erased (`results` by node name, `unknown`),
 * while `def.read` hands them out typed per node (`types.results`) and the output typed by the `output` schema
 * (`types.readOutput`). The compiler cannot connect the two, so the types rest on these facts:
 * - the runner stores at `results[K]` only what node K produced, after node K's own schema took it;
 * - the builder puts in `Checked` exactly the nodes `resultSchemaOf` finds a schema for, with that schema's output;
 * - `read` checks every stored result of such a node with that same schema, and a completed run's output with the
 *   `output` schema, before it gives them out.
 * This guard is the one place the claim is made. At run time it checks the last fact: that `read` did check each of
 * them (`checked` holds `output` and `results.<node>`). The first two are the runner's and the builder's contract.
 */
export declare function isCheckedRead<Input, ReadOutput, ReadResults extends AnyResults>(def: WorkflowDef<StandardSchemaV1, unknown, AnySignals, Needs, ReadOutput, ReadResults>, detail: RunDetail<Input>, checked: ReadonlySet<string>): detail is RunDetail<Input, ReadOutput, ReadResults>;
/**
 * The schema a stored node result is checked with, and whether `null` (skipped, or timed out into `continue`) is kept.
 * `each`: the stored result is a list and the schema checks every item (a `map` that waits for all).
 */
export declare function resultSchemaOf(node: WorkflowNode): {
    readonly schema: StandardSchemaV1;
    readonly nullable: boolean;
    readonly each?: true;
} | undefined;
/** A stored body. Bivariant so a body typed for one workflow fits the erased slot without a cast. */
type Body<Out, Extra extends unknown[] = []> = BivariantFn<[...Extra, ctx: ErasedContext], Out>;
/**
 * What a command node's `input`, `when` and `undo.input` see. Plain data, no database and no command runner: a command
 * node's only work is its command. `key` is stable across attempts.
 */
export type CommandNodeView<Input, Results> = {
    readonly runId: string;
    readonly key: string;
    readonly input: Input;
    readonly results: Results;
};
type ErasedCommandView = CommandNodeView<unknown, Readonly<Record<string, unknown>>>;
/** What an event wait's `match`, `until`, `when` and `where` see. Plain data, with no worker behind it. */
export type WaitView<Input, Results> = Pick<CommandNodeView<Input, Results>, 'runId' | 'input' | 'results'>;
type ErasedWaitView = WaitView<unknown, Readonly<Record<string, unknown>>>;
/** One label of an event wait, as a node keeps it: nothing is known about its entity or its events. */
export type ErasedWaitSource = {
    readonly label: string;
    readonly entity: AnyEntity;
    readonly events: readonly AnyEventDef[];
    readonly match: BivariantFn<[view: ErasedWaitView], string>;
    readonly where?: BivariantFn<[view: ErasedWaitView & {
        readonly event: Recorded;
    }], boolean> | undefined;
};
/**
 * A command as a node keeps it: nothing is known about its input, its result or its journal. `Command` needs the
 * journal's meta and transaction types, which a definition does not carry, so the slot is structural, and bivariant
 * (`BivariantFn`) so every command fits it and it fits `run` without a cast.
 */
export type ErasedCommand = {
    readonly name: string;
    readonly input: StandardSchemaV1;
    readonly writes: readonly AnyEventDef[];
    readonly output?: StandardSchemaV1 | undefined;
    readonly handler: BivariantFn<[input: never, context: never], unknown>;
};
/** A failure definition as a node keeps it. Enough for `is`, `serialize` and `revive`. */
export type ErasedFailureDefinition = {
    (...args: never[]): Failure;
    readonly code: string;
    readonly dataSchema: StandardSchemaV1 | undefined;
    is(value: unknown): boolean;
};
export type WorkflowNode = {
    readonly kind: 'step';
    readonly name: string;
    readonly undo: boolean;
    readonly run: Body<unknown>;
    readonly options: {
        readonly output?: StandardSchemaV1;
        readonly undo?: BivariantFn<[ctx: ErasedContext & {
            readonly result: unknown;
        }], unknown>;
        readonly key?: Body<string>;
        readonly retry?: Backoff;
        readonly timeout?: RetentionAge;
        readonly when?: Body<boolean>;
        /** The failures the step may return and the run goes on from, when `onFailure` is `'continue'`. */
        readonly failures?: readonly ErasedFailureDefinition[];
        readonly onFailure?: 'continue';
        /** An earlier node name, `'next'`, or a function that picks one. */
        readonly next?: string | BivariantFn<[ctx: ErasedContext & {
            readonly result: unknown;
        }], string>;
    };
} | {
    readonly kind: 'waitFor';
    readonly name: string;
    readonly undo: false;
    readonly signal: string;
    readonly schema: StandardSchemaV1;
    readonly timeout?: RetentionAge;
    readonly onTimeout: 'fail' | 'continue';
    readonly when?: Body<boolean>;
} | {
    readonly kind: 'eventWait';
    readonly name: string;
    readonly undo: false;
    readonly on: readonly ErasedWaitSource[];
    readonly timeout?: RetentionAge | undefined;
    readonly until?: BivariantFn<[view: ErasedWaitView], Date> | undefined;
    readonly onTimeout: 'fail' | 'continue';
    readonly when?: BivariantFn<[view: ErasedWaitView], boolean> | undefined;
} | {
    readonly kind: 'sleep';
    readonly name: string;
    readonly undo: false;
    readonly until: RetentionAge | Body<Date>;
    /** An earlier node, `'next'`, or a function that picks one, as on a step. */
    readonly next?: string | BivariantFn<[view: ErasedWaitView], string> | undefined;
} | {
    readonly kind: 'child';
    readonly name: string;
    /** True when the node has an `undo` of its own, which then replaces compensating the child run. */
    readonly undo: boolean;
    readonly def: WorkflowDef | Body<WorkflowDef>;
    readonly input: Body<unknown>;
    readonly onCancel: 'cancel' | 'detach';
    readonly options: {
        readonly undo?: BivariantFn<[ctx: ErasedContext & {
            readonly result: unknown;
        }], unknown>;
    };
} | {
    readonly kind: 'map';
    readonly name: string;
    readonly undo: false;
    readonly def: WorkflowDef;
    readonly items: Body<readonly unknown[]>;
    readonly input: BivariantFn<[ctx: ErasedContext, item: unknown, index: number], unknown>;
    readonly wait: 'all' | 'any';
    readonly concurrency?: number;
} | {
    readonly kind: 'parallel';
    readonly name: string;
    readonly undo: false;
    /** One definition per branch, built with the parent's name, version and limits. See `branchDefs`. */
    readonly branches: readonly {
        readonly name: string;
        readonly def: WorkflowDef;
    }[];
    /** `'all'`: every branch completes. `'any'`: the first to complete wins and the others are cancelled. */
    readonly wait: 'all' | 'any';
} | {
    readonly kind: 'command';
    readonly name: string;
    readonly undo: boolean;
    readonly command: ErasedCommand;
    readonly input: BivariantFn<[view: ErasedCommandView], unknown>;
    readonly accept: readonly ErasedFailureDefinition[];
    readonly options: {
        readonly undo?: {
            readonly command: ErasedCommand;
            readonly input: BivariantFn<[view: ErasedCommandView & {
                readonly result: unknown;
            }], unknown>;
        } | undefined;
        readonly when?: BivariantFn<[view: ErasedCommandView], boolean> | undefined;
        readonly retry?: Backoff | undefined;
    };
};
export type WorkflowLimits = {
    readonly payload: number;
    /**
     * The most nodes a run may start on a first try (1000 by default). Each visit of a node in a loop counts, and so does
     * a node its `when` skips; a retry and an undo do not. A node past the cap does not run: the run compensates and ends
     * `failed` with `WorkflowTransitionLimit`.
     */
    readonly transitions: number;
    readonly children: number;
};
/** The signals a workflow waits for: each signal name with the schema of its payload. */
export type AnySignals = Readonly<Record<string, StandardSchemaV1>>;
export type NoSignals = Readonly<Record<never, never>>;
/**
 * The finished definition. `types` is a phantom: it carries the output type and the signals, and holds no value.
 * `Signals` defaults to any signal map, so a bare `WorkflowDef` accepts every definition.
 */
export type WorkflowDef<Input extends StandardSchemaV1 = StandardSchemaV1, Output = unknown, Signals extends AnySignals = AnySignals, N extends Needs = Needs, ReadOutput = unknown, ReadResults extends AnyResults = AnyResults> = {
    readonly name: string;
    readonly version: number;
    readonly shape: WorkflowShape;
    readonly shapeHash: string;
    readonly input: Input;
    /** The declared output schema, if any. */
    readonly output: StandardSchemaV1 | undefined;
    readonly deadline: RetentionAge | undefined;
    readonly concurrency: {
        readonly key: BivariantFn<[input: unknown], string> | undefined;
        readonly limit: number | undefined;
        readonly total: number | undefined;
        readonly shared: readonly LimitDef[];
        readonly onBusy: (typeof ON_BUSY)[number];
    } | undefined;
    readonly onDeadStep: 'wait' | 'compensate';
    /** The workflow's own run retention; a field left out takes the journal's (`retention.workflows`). */
    readonly retention: RunRetention;
    readonly limits: WorkflowLimits;
    readonly needs: Needs;
    /** The journal event that starts a run, if any. Only the highest registered version may declare one. */
    readonly startOn: ErasedStartOn | undefined;
    /** What runs when a run of this version ends, if anything. See `LifecycleHooks`. */
    readonly on: ErasedLifecycleHooks | undefined;
    readonly nodes: readonly WorkflowNode[];
    /**
     * The nodes of the parent that came before a `parallel` node, for the definition of one of its branches; empty
     * anywhere else. The branch run starts with the parent's results, and these say how to read them (an event wait's
     * event, an accepted failure).
     */
    readonly inherited: readonly WorkflowNode[];
    /** Without a body, the run's output is the last node's result. */
    readonly finish: BivariantFn<[ctx: Pick<ErasedContext, 'runId' | 'input' | 'results'>], unknown> | undefined;
    /** `readOutput` and `results` are what `def.read` gives after its checks; see `CheckedRead`. */
    readonly types?: {
        readonly output: Output;
        readonly signals: Signals;
        readonly needs: N;
        readonly readOutput: ReadOutput;
        readonly results: ReadResults;
    };
};
/** The needs a workflow definition declared, read from its type: written once, in `workflow(name, { needs })`. */
type NeedsOfDef<D> = D extends {
    readonly types?: {
        readonly needs: infer N extends Needs;
    };
} ? N : Needs;
/**
 * What a list of workflows needs, as one object of services, like `ServicesFor` does for effects. `compose` and the
 * Dot adapter both check a workflow's services with it.
 */
export type WorkflowServices<W extends readonly WorkflowDef[]> = ServicesFor<{
    readonly [K in keyof W]: {
        readonly needs: NeedsOfDef<W[K]>;
    };
}>;
/** When `startOn` starts a run. `START_TIMINGS` says what each means. */
export type StartTiming = (typeof START_TIMINGS)[number];
/**
 * `startOn`: the event of `entity` that starts a run. `id` gives the run id and `input` the run's input, both from the
 * recorded event, typed by the entity's key and the event's data. `timing` is required: see `START_TIMINGS`. `id` and
 * `input` are method signatures, so a typed `startOn` fits the erased one a definition keeps; see `BivariantFn`.
 */
export type StartOn<Input extends StandardSchemaV1, E, D, MetaOut, Timing extends StartTiming = StartTiming> = {
    readonly entity: E;
    readonly event: D;
    readonly timing: Timing;
    id(event: RecordedOf<D, MetaOut, EntityIdOf<E>>): string;
    input(event: RecordedOf<D, MetaOut, EntityIdOf<E>>): SchemaInput<Input>;
};
/** A `startOn` as the runner keeps it: nothing is known about the entity, the event or the input. */
export type ErasedStartOn = {
    readonly entity: AnyEntity;
    readonly event: AnyEventDef;
    readonly timing: StartTiming;
    id(event: Recorded<string, unknown, unknown>): string;
    input(event: Recorded<string, unknown, unknown>): unknown;
};
/** The meta an entity's events carry, read from the entity: a standalone `workflow()` has no journal to take it from. */
type MetaOfEntity<E> = E extends EntityDef<string, EntityTable, AnyEventDef, infer Meta, string> ? Meta : unknown;
/**
 * What `onBusy` may say. A `with-event` start runs in the business transaction, so a limit must never refuse it:
 * `'refuse'` is a type error there. A `join` that finds no run to join, or a paused limit, queues the run instead.
 */
type OnBusyFor<Start extends ErasedStartOn> = [Start['timing']] extends ['with-event'] ? Exclude<(typeof ON_BUSY)[number], 'refuse'> : (typeof ON_BUSY)[number];
/**
 * How a run ended, as a lifecycle hook sees it: the end state, with the output of a completed run and the error text
 * of a failed one. `Output` is what `def.read` gives: the `output` schema's output, checked again, or `unknown` without
 * a schema (the stored JSON).
 */
export type RunEnding<Output> = {
    readonly state: 'completed';
    readonly output: Output;
} | {
    readonly state: 'failed';
    readonly error: string;
} | {
    readonly state: 'cancelled';
} | {
    readonly state: 'expired';
};
/** One end of `RunEnding`, by its state. */
type EndingIn<Output, State extends RunEnding<unknown>['state']> = Extract<RunEnding<Output>, {
    readonly state: State;
}>;
/**
 * What a lifecycle hook sees: the run that ended (`runId`, `workflow`, `version`, `scope`, `tags`, `metadata`, the
 * typed `input`, and how it ended), the context of the hook's job (`db`, `run`, `accept`, `signal`, `jobId`, `attempt`),
 * and the definition's needs by name, as a step gets them. `run` without a meta records the app's `workflowMeta`, as
 * in a step. `metadata` is the run's metadata as it ended: the run is over, so a hook reads it and cannot change it.
 */
export type LifecycleHookContext<Input, Ending, N extends Needs = NoNeeds, AppDb = RootDb, Run = unknown> = Needed<N> & Ending & {
    readonly runId: string;
    readonly workflow: string;
    readonly version: number;
    readonly scope: string | null;
    readonly tags: readonly string[];
    readonly metadata: Readonly<Record<string, unknown>>;
    readonly input: Input;
    readonly jobId: string;
    /** 1 on the hook job's first try, 2 on its next, and so on. */
    readonly attempt: number;
    readonly signal: AbortSignal;
    readonly db: AppDb;
    readonly run: Run;
    readonly accept: AcceptFailure;
};
/**
 * `on`: what runs when a run ends. Hooks are durable, not callbacks: the end of a run queues one job (the
 * `workflow.on` effect) in the transaction that ends it, so a hook runs only after that commit, and at least once. The
 * job runs the hooks of the run's own version: the specific one, then `complete`. A throw is retried as an effect's
 * is; a returned failure is final. The run has ended: no hook changes its state. Method signatures, so a typed `on`
 * fits the erased one a definition keeps; see `BivariantFn`.
 */
export type LifecycleHooks<Input, Output, N extends Needs = NoNeeds, AppDb = RootDb, Run = unknown> = {
    /** The run completed. `ctx.output` is its output. */
    success?(ctx: LifecycleHookContext<Input, EndingIn<Output, 'completed'>, N, AppDb, Run>): unknown;
    /** The run failed. `ctx.error` is the text of its error, as `RunFailed` recorded it. */
    failure?(ctx: LifecycleHookContext<Input, EndingIn<Output, 'failed'>, N, AppDb, Run>): unknown;
    /** The run was cancelled, after any undo it had to do. */
    cancel?(ctx: LifecycleHookContext<Input, EndingIn<Output, 'cancelled'>, N, AppDb, Run>): unknown;
    /** The run's `ttl` passed before its first node started, so nothing ran. */
    expired?(ctx: LifecycleHookContext<Input, EndingIn<Output, 'expired'>, N, AppDb, Run>): unknown;
    /** Every end, after the specific hook, or alone. `ctx.state` says which end. */
    complete?(ctx: LifecycleHookContext<Input, RunEnding<Output>, N, AppDb, Run>): unknown;
};
/** The hooks as the runner keeps them: nothing is known about the input, the output, the needs or the host. */
export type ErasedLifecycleHooks = LifecycleHooks<unknown, unknown, Needs, unknown, unknown>;
export type WorkflowOptions<Input extends StandardSchemaV1, N extends Needs, Output extends StandardSchemaV1 | undefined, Start extends ErasedStartOn = ErasedStartOn, Where extends Host = Host> = {
    readonly version: number;
    readonly input: Input;
    readonly output?: Output;
    readonly deadline?: RetentionAge;
    /**
     * The limits a start must find room in, or `onBusy` decides. `limit` caps the unfinished runs per `key` and `total`
     * all of them: together the workflow's own limit, `workflow/<name>`. `shared` lists at most two `j.limit`s, each
     * counted across every workflow that lists it, its `perKey` with this workflow's `key`. A start is admitted only
     * when every limit it holds has room. At a busy limit, `onBusy` refuses, joins the oldest running run of the key, or
     * queues the run until a slot frees (`ON_BUSY`).
     */
    readonly concurrency?: {
        readonly key?: (input: SchemaOutput<Input>) => string;
        readonly limit?: number;
        readonly total?: number;
        readonly shared?: readonly LimitDef[];
        readonly onBusy: OnBusyFor<Start>;
    };
    readonly onDeadStep?: 'wait' | 'compensate';
    /** How long the run row stays after it ends, by how it ended. Overrides `retention.workflows` of `initJournal`. */
    readonly retention?: RunRetention;
    readonly limits?: Partial<WorkflowLimits>;
    readonly needs?: N;
    /**
     * Starts a run when `entity` records `event`, with the app's `workflowMeta`, at the highest registered version.
     * `timing` says when (`START_TIMINGS`). Either way the start commits with the event, so the run starts once, and an
     * id that already has a run starts nothing.
     */
    readonly startOn?: Start;
    /** What runs when a run ends: `success`, `failure`, `cancel`, `expired`, and `complete` for every end. See `LifecycleHooks`. */
    readonly on?: LifecycleHooks<SchemaOutput<Input>, ReadOutputOf<Output>, N, Where['db'], Where['run']>;
};
/** Results by node name, as the runner stores them. */
export type AnyResults = Readonly<Record<string, unknown>>;
export type NoResults = Readonly<Record<never, never>>;
/** `Results` plus one key. Written as a mapped type so the shape prints and compares flat. */
type Add<Results extends AnyResults, Name extends string, Value> = {
    readonly [K in keyof Results | Name]: K extends Name ? Value : K extends keyof Results ? Results[K] : never;
};
/** The step name itself, or `never` when an earlier node already uses it. */
type Fresh<Results extends AnyResults, Name extends string> = Name extends keyof Results ? never : Name;
/** What a step really produced: the awaited value without a returned `Failure`. */
export type Resolved<Returned> = Exclude<Awaited<Returned>, Failure>;
/**
 * What a journal gives its bodies. `commandContext` says which commands fit: a command handler must take this context,
 * so a command of another journal does not fit a command node. A standalone `workflow()` has `never`: any command fits.
 */
type Host = {
    readonly db: unknown;
    readonly run: unknown;
    readonly commandContext: unknown;
};
type StandaloneHost = {
    readonly db: RootDb;
    readonly run: unknown;
    readonly commandContext: never;
};
type OutputOf<Def extends WorkflowDef> = NonNullable<Def['types']>['output'];
/** What `def.read` gives for a child's run output: the child's `output` schema's output, `unknown` without one. */
type ReadOutputOfDef<Def extends WorkflowDef> = NonNullable<Def['types']>['readOutput'];
/** A list of checked items, or `unknown` when the item is not checked (no schema): an unchecked list is not known to be one. */
type CheckedList<Item> = unknown extends Item ? unknown : Item[];
/** `Signals` plus one signal. A name used twice keeps the later schema; `define` refuses two different schemas for one name. */
type AddSignal<Signals extends AnySignals, Name extends string, Payload extends StandardSchemaV1> = {
    readonly [K in keyof Signals | Name]: K extends Name ? Payload : K extends keyof Signals ? Signals[K] : never;
};
type StepOptions<Context, Result, Earlier extends string, Kept = never> = {
    /** Parses the stored result. Needed for an operator to supply a result by hand. */
    readonly output?: StandardSchemaV1<unknown, Result>;
    readonly undo?: (ctx: Context & {
        readonly result: Result;
    }) => unknown;
    readonly key?: (ctx: Context) => string;
    readonly retry?: Backoff;
    readonly timeout?: RetentionAge;
    /** Backward jump only: an earlier node, or `'next'` to carry on. */
    readonly next?: Earlier | 'next' | ((ctx: Context & {
        readonly result: Result | Kept;
    }) => Earlier | 'next');
};
/** What a command node reads of a command. `Output` is the command's `output` schema, when it declares one. */
type NodeCommand<S extends StandardSchemaV1, R, Output, Context> = {
    readonly name: string;
    readonly input: S;
    readonly writes: readonly AnyEventDef[];
    readonly output?: Output;
    readonly handler: (input: SchemaOutput<S>, context: Context) => R;
};
/** The failures a command's handler returns. */
type RefusalOf<R> = Extract<Awaited<R>, Failure>;
/** A failure definition whose failure is one that `Refusal` names. Anything else is a type error in `accept`. */
type AcceptedBy<Refusal> = {
    (...args: never[]): Refusal;
    readonly code: string;
    readonly dataSchema: StandardSchemaV1 | undefined;
    is(value: unknown): boolean;
};
/** The failures a step keeps as its result: its listed `failures`, when `onFailure` is `'continue'`. */
type KeptFailures<OnFailure, Failures extends readonly AcceptedBy<unknown>[]> = OnFailure extends 'continue' ? ReturnType<Failures[number]> : never;
/** What a command node stores: the output of the command's `output` schema, or `null` when it declares none. */
type StoredResult<Output> = [Output] extends [StandardSchemaV1] ? SchemaOutput<Output> : null;
/** A command node's result: what it stores, or an accepted failure, and `null` when its `when` can skip it. */
type CommandResult<Output, Accept extends readonly AcceptedBy<unknown>[], When> = Skippable<StoredResult<Output> | ReturnType<Accept[number]>, When>;
/** The options of a `child` node, for the child workflow `Def`. */
type ChildOptions<Input extends StandardSchemaV1, Results extends AnyResults, N extends Needs, Where extends Host, Def extends WorkflowDef> = {
    readonly input: (ctx: Ctx<Input, Results, N, Where>) => SchemaInput<Def['input']>;
    /** What a cancel of this run does to the child: cancel it (default) or leave it running. */
    readonly onCancel?: 'cancel' | 'detach';
    /** Undoes the node when the run compensates. Without it, the child run itself is compensated. */
    readonly undo?: (ctx: Ctx<Input, Results, N, Where> & {
        readonly result: OutputOf<Def>;
    }) => unknown;
};
/** `.child(name, def, options)` and `.child(name, ctx => def, options)`: two forms, because only the first can be checked on read. */
type ChildNode<Input extends StandardSchemaV1, Results extends AnyResults, N extends Needs, Declared extends StandardSchemaV1 | undefined, Where extends Host, Ext extends DefExtension, Signals extends AnySignals, Checked extends AnyResults> = {
    <Name extends string, Def extends WorkflowDef>(name: Fresh<Results, Name>, def: Def, options: ChildOptions<Input, Results, N, Where, Def>): WorkflowBuilder<Input, Add<Results, Name, OutputOf<Def>>, N, Declared, OutputOf<Def>, Where, Ext, Signals, Add<Checked, Name, ReadOutputOfDef<Def>>>;
    <Name extends string, Def extends WorkflowDef>(name: Fresh<Results, Name>, def: (ctx: Ctx<Input, Results, N, Where>) => Def, options: ChildOptions<Input, Results, N, Where, Def>): WorkflowBuilder<Input, Add<Results, Name, OutputOf<Def>>, N, Declared, OutputOf<Def>, Where, Ext, Signals, Checked>;
};
/** The builder a branch of a `parallel` node gets: the parent's input and results, and results of its own. */
type BranchBuilder<Input extends StandardSchemaV1, Results extends AnyResults, N extends Needs, Where extends Host> = WorkflowBuilder<Input, Results, N, undefined, never, Where> & {
    /**
     * Gives the branch an `output` schema, as a workflow has one: the branch run checks its output with it when it
     * finishes, and `finish` must return its output. Call it first. When every branch has one, `def.read` types and
     * checks the node's result with them.
     */
    output<Output extends StandardSchemaV1>(schema: Output): WorkflowBuilder<Input, Results, N, Output, never, Where>;
};
/**
 * The branches of a `parallel` node: each one builds its definition from the builder it is given. Written over the
 * definitions it builds (`Defs`), so a branch's `finish()` is typed by its own nodes and not by this type's bound.
 */
type BranchSet<Input extends StandardSchemaV1, Results extends AnyResults, N extends Needs, Where extends Host, Defs extends Readonly<Record<string, WorkflowDef>>> = {
    readonly [B in keyof Defs]: (builder: BranchBuilder<Input, Results, N, Where>) => Defs[B];
};
/** `wait: 'all'`: the output of every branch, by branch name. */
type ParallelAll<Defs extends Readonly<Record<string, WorkflowDef>>> = {
    readonly [B in keyof Defs & string]: OutputOf<Defs[B]>;
};
/** `wait: 'any'`: the winner, by branch name, with its output. Narrowing `branch` types `result`. */
type ParallelAny<Defs extends Readonly<Record<string, WorkflowDef>>> = {
    [B in keyof Defs & string]: {
        readonly branch: B;
        readonly result: OutputOf<Defs[B]>;
    };
}[keyof Defs & string];
type ParallelResult<Defs extends Readonly<Record<string, WorkflowDef>>, Wait> = Wait extends 'any' ? ParallelAny<Defs> : ParallelAll<Defs>;
/** `def.read` of a parallel node: typed by the branches' `output` schemas when every branch has one, else `unknown`. */
type ParallelRead<Defs extends Readonly<Record<string, WorkflowDef>>, Wait> = true extends {
    [B in keyof Defs]: unknown extends ReadOutputOfDef<Defs[B]> ? true : false;
}[keyof Defs] ? unknown : Wait extends 'any' ? {
    [B in keyof Defs & string]: {
        readonly branch: B;
        readonly result: ReadOutputOfDef<Defs[B]>;
    };
}[keyof Defs & string] : {
    readonly [B in keyof Defs & string]: ReadOutputOfDef<Defs[B]>;
};
/** The signal maps of the parent and of every branch. */
type SignalMaps<Signals extends AnySignals, Defs extends Readonly<Record<string, WorkflowDef>>> = Signals | (Defs[keyof Defs] extends infer Def ? (Def extends WorkflowDef ? NonNullable<Def['types']>['signals'] : never) : never);
type SignalNames<Maps> = Maps extends unknown ? keyof Maps & string : never;
/** The schemas one signal name has across the maps: more than one type is a clash. */
type SignalSchemas<Maps, Name extends string> = Maps extends unknown ? (Name extends keyof Maps ? Maps[Name] : never) : never;
type IsUnion<T, All = T> = T extends unknown ? ([All] extends [T] ? false : true) : never;
/** The signal names that two waits use with payloads of different types. */
type SignalClashes<Maps> = {
    [Name in SignalNames<Maps>]: IsUnion<SignalSchemas<Maps, Name>> extends false ? never : Name;
}[SignalNames<Maps>];
type MergedSignals<Maps> = {
    readonly [Name in SignalNames<Maps>]: Extract<SignalSchemas<Maps, Name>, StandardSchemaV1>;
};
/** The error a clashing signal gives: the message names the signal. */
export type SignalClash<Name extends string> = `branches wait for signal '${Name}' with payloads of different types; share one schema object`;
type SignalGuard<Clashes extends string> = [Clashes] extends [never] ? unknown : {
    readonly signalClash: SignalClash<Clashes>;
};
/** `.parallel(name, branches, { wait })`: see `WorkflowBuilder.parallel`. */
type ParallelNode<Input extends StandardSchemaV1, Results extends AnyResults, N extends Needs, Declared extends StandardSchemaV1 | undefined, Where extends Host, Ext extends DefExtension, Signals extends AnySignals, Checked extends AnyResults> = <Name extends string, Defs extends Readonly<Record<string, WorkflowDef>>, Wait extends 'all' | 'any'>(name: Fresh<Results, Name>, branches: BranchSet<Input, Results, N, Where, Defs>, options: {
    /** `'all'`: the node completes when every branch has. `'any'`: when the first has, and the others are cancelled. */
    readonly wait: Wait;
    /** What happens to the branches that lost an `'any'`: they are cancelled, and the node completes once each has stopped. */
    readonly losers?: 'cancel';
} & SignalGuard<SignalClashes<SignalMaps<Signals, Defs>>>) => WorkflowBuilder<Input, Add<Results, Name, ParallelResult<Defs, Wait>>, N, Declared, ParallelResult<Defs, Wait>, Where, Ext, MergedSignals<SignalMaps<Signals, Defs>>, Add<Checked, Name, ParallelRead<Defs, Wait>>>;
export type WorkflowBuilder<Input extends StandardSchemaV1, Results extends AnyResults, N extends Needs, Declared extends StandardSchemaV1 | undefined, Last, Where extends Host, Ext extends DefExtension = NoExtension, Signals extends AnySignals = NoSignals, 
/** The nodes whose stored result `def.read` checks with a schema of the node, with the type that check gives. */
Checked extends AnyResults = NoResults> = {
    step<Name extends string, Returned, When extends ((ctx: Ctx<Input, Results, N, Where>) => boolean) | undefined, Output extends StandardSchemaV1<unknown, Resolved<Returned>> | undefined = undefined, const Failures extends readonly AcceptedBy<Failure>[] = readonly [], OnFailure extends 'continue' | undefined = undefined>(name: Fresh<Results, Name>, run: (ctx: Ctx<Input, Results, N, Where>) => Returned, options?: StepOptions<Ctx<Input, Results, N, Where>, NoInfer<Resolved<Returned>>, keyof Results & string, KeptFailures<OnFailure, Failures>> & {
        /** When it returns false the step is skipped and its result is `null`. */
        readonly when?: When;
        readonly output?: Output;
        /**
         * The failures the step may return, each with the schema that checks its stored data. (The list is not tied to the
         * body's return type: that tie would fix the body's type before its context is typed.) Without `onFailure` a returned failure fails the step, as ever.
         */
        readonly failures?: Failures;
        /**
         * `'continue'`: a returned failure that `failures` lists is the step's result and the run goes on from it. The
         * result is stored as the failure's envelope and read back as a real failure. Any other failure fails the step.
         */
        readonly onFailure?: [Output] extends [StandardSchemaV1] ? OnFailure : never;
    }): WorkflowBuilder<Input, Add<Results, Name, StepResult<Returned, When, KeptFailures<OnFailure, Failures>>>, N, Declared, StepResult<Returned, When, KeptFailures<OnFailure, Failures>>, Where, Ext, Signals, [
        Output
    ] extends [StandardSchemaV1] ? Add<Checked, Name, StepResult<SchemaOutput<Output>, When, KeptFailures<OnFailure, Failures>>> : Checked>;
    /**
     * Parks the run until something arrives. Two forms:
     *
     * - `{ signal, schema }`: a signal from outside the app (`def.signal`). The result is its payload.
     * - `{ on: { [label]: { entity, events, match, where? } } }`: an event of the app. `match` gives the entity id to
     *   watch and must return that entity's id type; `events` must be events of that entity. `where` drops an event the
     *   wait does not want. The result is `{ via: label, event }`, and narrowing `event.type` types `event.data`.
     *
     * An event wait counts every event since the run was admitted (its `startOn` event, or its start), so one recorded
     * before the worker gets here is kept. It takes the oldest it finds; a later visit in a `next` loop reads on from the
     * last one it took, and one event is taken once per run. `timeout` or `until` end the wait: `onTimeout: 'continue'`
     * gives `null` and goes on, which makes the wait a sleep that an event cuts short.
     */
    waitFor: WaitForSignal<Input, Results, N, Declared, Where, Ext, Signals, Checked> & WaitForEvent<Input, Results, N, Declared, Where, Ext, Signals, Checked>;
    /**
     * Parks the run until a time. `next` loops as a step's does: an earlier node, `'next'`, or a function that picks one.
     * Its function sees plain data, and runs in the transaction that ends the sleep.
     */
    sleep<Name extends string>(name: Fresh<Results, Name>, until: RetentionAge | ((ctx: Ctx<Input, Results, N, Where>) => Date), options?: {
        /** Backward jump only: an earlier node, or `'next'` to carry on. */
        readonly next?: (keyof Results & string) | 'next' | ((view: WaitView<SchemaOutput<Input>, Results>) => (keyof Results & string) | 'next');
    }): WorkflowBuilder<Input, Add<Results, Name, null>, N, Declared, null, Where, Ext, Signals, Add<Checked, Name, null>>;
    /**
     * Runs another workflow as a child run and takes its output as the result. With the definition itself, `def.read`
     * checks the stored result with the child's `output` schema, and types it. With a function that picks the
     * definition at run time, there is no schema to check with, so `def.read` gives `unknown`.
     */
    child: ChildNode<Input, Results, N, Declared, Where, Ext, Signals, Checked>;
    /**
     * Runs branches side by side and joins them. Each branch is a function that gets a builder and returns its finished
     * definition; it runs as a child run of its own, on a snapshot of this run's input and results when the node
     * starts, and its nodes may wait for signals and events. `wait: 'all'`: the result is the output of every branch,
     * by branch name, and a branch that fails or is cancelled fails the node. `wait: 'any'`: the result is
     * `{ branch, result }` of the first branch to complete, the others are cancelled, and the node completes once each
     * has stopped; it fails only when no branch can complete. A branch's node names must differ from the nodes before
     * the parallel. A signal for this run reaches every branch that waits for it, and two waits for one signal name must
     * share the same schema object. An event wait in a branch counts from this run's start, as in the main line. Each
     * branch run counts its own transitions against `limits.transitions`.
     */
    parallel: ParallelNode<Input, Results, N, Declared, Where, Ext, Signals, Checked>;
    map<Name extends string, Item, Def extends WorkflowDef, Wait extends 'all' | 'any' = 'all'>(name: Fresh<Results, Name>, def: Def, options: {
        readonly items: (ctx: Ctx<Input, Results, N, Where>) => readonly Item[];
        readonly input: (ctx: Ctx<Input, Results, N, Where>, item: Item, index: number) => SchemaInput<Def['input']>;
        readonly wait?: Wait;
        readonly concurrency?: number;
    }): WorkflowBuilder<Input, Add<Results, Name, Wait extends 'any' ? OutputOf<Def> : OutputOf<Def>[]>, N, Declared, Wait extends 'any' ? OutputOf<Def> : OutputOf<Def>[], Where, Ext, Signals, Add<Checked, Name, Wait extends 'any' ? ReadOutputOfDef<Def> : CheckedList<ReadOutputOfDef<Def>>>>;
    /**
     * A node whose body is one command. It runs as a savepoint inside the checkpoint's transaction, so the command's
     * writes, the checkpoint and the next node's scheduling commit together: once per node, even when the job runs again
     * after a crash. A refused command rolls back its savepoint, and the node fails like a step that returned the failure
     * (`retry`, then `onDeadStep`). `accept` names failures the command returns that the run goes on from: the savepoint
     * stays rolled back and the failure is the node's result. `undo` runs in compensation, the same way, and is skipped
     * for an accepted failure, because a refused command did nothing. `input`, `when` and `undo.input` see plain data
     * (`CommandNodeView`). The result is what the command's `output` schema gives, `null` without one.
     */
    command<Name extends string, S extends StandardSchemaV1, R, Output extends StandardSchemaV1 | undefined, When extends ((view: CommandNodeView<SchemaOutput<Input>, Results>) => boolean) | undefined, const Accept extends readonly AcceptedBy<RefusalOf<R>>[] = readonly [], UndoS extends StandardSchemaV1 = StandardSchemaV1>(name: Fresh<Results, Name>, command: NodeCommand<S, R, Output, Where['commandContext']>, input: (view: CommandNodeView<SchemaOutput<Input>, Results>) => SchemaInput<S>, options?: {
        /** Failures the command returns that the run goes on from. Each joins the node's typed result. */
        readonly accept?: Accept;
        /** Runs in compensation, once for each visit that stored a result. */
        readonly undo?: {
            readonly command: NodeCommand<UndoS, unknown, StandardSchemaV1 | undefined, Where['commandContext']>;
            readonly input: (view: CommandNodeView<SchemaOutput<Input>, Results> & {
                readonly result: StoredResult<Output>;
            }) => SchemaInput<UndoS>;
        };
        /** When it returns false the command does not run and the result is `null`. */
        readonly when?: When;
        /** How a refused command is tried again. A returned failure is final unless the backoff's `while` accepts it. */
        readonly retry?: Backoff;
    }): WorkflowBuilder<Input, Add<Results, Name, CommandResult<Output, Accept, When>>, N, Declared, CommandResult<Output, Accept, When>, Where, Ext, Signals, Add<Checked, Name, CommandResult<Output, Accept, When>>>;
    /**
     * Without a function the output is the last node's result. With an `output` schema the function must return that
     * schema's output (or a failure, or a promise of either): a wrong return does not compile. Without a function the
     * last result must fit the schema, or the function is required. A last node whose result can be a failure (a command's
     * `accept`, a step's `failures` with `onFailure: 'continue'`) needs the function too: a run's output is never a
     * failure, so leaving it out does not compile. `finish` still throws `BAD_DEFINITION` for an erased definition that
     * gets past the types.
     */
    finish<Returned extends FinishBound<Declared> = Last>(...run: [Last, Extract<Last, Failure>] extends [FinishBound<Declared>, never] ? [run?: (ctx: FinishContext<Input, Results>) => Returned] : [run: (ctx: FinishContext<Input, Results>) => Returned]): Finished<Input, Results, N, Declared, Returned, Signals, Checked, Ext>;
};
/** `.waitFor(name, { signal, schema })`: the form that waits for a signal from outside the app. */
type WaitForSignal<Input extends StandardSchemaV1, Results extends AnyResults, N extends Needs, Declared extends StandardSchemaV1 | undefined, Where extends Host, Ext extends DefExtension, Signals extends AnySignals, Checked extends AnyResults> = <Name extends string, Signal extends string, Payload extends StandardSchemaV1, When extends ((ctx: Ctx<Input, Results, N, Where>) => boolean) | undefined, OnTimeout extends 'fail' | 'continue' = 'fail'>(name: Fresh<Results, Name>, options: {
    /** The signal's name. One name has one payload schema: two waits for it must share the same schema object. */
    readonly signal: Signal;
    readonly schema: Payload;
    readonly timeout?: RetentionAge;
    readonly onTimeout?: OnTimeout;
    /** When it returns false the wait is skipped: the run does not park, and the result is `null`. */
    readonly when?: When;
}) => WorkflowBuilder<Input, Add<Results, Name, Waited<Payload, OnTimeout, When>>, N, Declared, Waited<Payload, OnTimeout, When>, Where, Ext, AddSignal<Signals, Signal, Payload>, Add<Checked, Name, Waited<Payload, OnTimeout, When>>>;
/** The entity of each label of an event wait. */
type WaitEntities = Readonly<Record<string, AnyEntity>>;
/** The events each label of an event wait takes, as one union per label. */
type WaitEvents<Entities extends WaitEntities> = Readonly<Record<keyof Entities, AnyEventDef>>;
/** The event a label gives: its id type and meta come from the entity, its type and data from the events it lists. */
type WaitEvent<Entity, Events> = RecordedOf<Events, MetaOfEntity<Entity>, EntityIdOf<Entity>>;
/**
 * `on` of an event wait. Two mapped types, each reversed by the compiler for one type parameter: `Entities` from each
 * label's `entity`, `Events` from its `events`. So `where` sees the event of its own label, and no caller writes a type.
 */
type WaitOn<View, Entities extends WaitEntities, Events extends WaitEvents<Entities>> = {
    readonly [L in keyof Entities]: {
        readonly entity: Entities[L];
        readonly events: readonly EventsOf<Entities[L]>[];
        /** The id of the entity to watch. It is worked out once per visit, when the run gets to the wait. */
        match(view: View): EntityIdOf<Entities[L]>;
    };
} & {
    readonly [L in keyof Events]: {
        readonly events: readonly Events[L][];
        /** Takes only the events it returns true for. It must decide from its arguments alone. */
        where?(view: View & {
            readonly event: WaitEvent<Entities[L & keyof Entities], Events[L]>;
        }): boolean;
    };
};
/** How an event wait ends with no event: after `timeout`, at `until`, or never. */
type WaitDeadline<View> = {
    readonly timeout: RetentionAge;
    readonly until?: never;
} | {
    readonly until: (view: View) => Date;
    readonly timeout?: never;
} | {
    readonly timeout?: never;
    readonly until?: never;
};
/** An event wait's result: one member per label, so `via` narrows the label and `event.type` the event. */
type WaitResult<Entities extends WaitEntities, Events extends WaitEvents<Entities>> = {
    [L in keyof Entities & string]: {
        readonly via: L;
        readonly event: WaitEvent<Entities[L], Events[L]>;
    };
}[keyof Entities & string];
/** The result of an event wait: `null` when it timed out into `continue` or its `when` skipped it. */
type EventWaited<Entities extends WaitEntities, Events extends WaitEvents<Entities>, OnTimeout, When> = OnTimeout extends 'continue' ? WaitResult<Entities, Events> | null : Skippable<WaitResult<Entities, Events>, When>;
/** `.waitFor(name, { on })`: the form that waits for an event of the app. */
type WaitForEvent<Input extends StandardSchemaV1, Results extends AnyResults, N extends Needs, Declared extends StandardSchemaV1 | undefined, Where extends Host, Ext extends DefExtension, Signals extends AnySignals, Checked extends AnyResults> = <Name extends string, Entities extends WaitEntities, Events extends WaitEvents<Entities>, When extends ((view: WaitView<SchemaOutput<Input>, Results>) => boolean) | undefined, OnTimeout extends 'fail' | 'continue' = 'fail'>(name: Fresh<Results, Name>, options: {
    readonly on: WaitOn<WaitView<SchemaOutput<Input>, Results>, Entities, Events>;
    readonly onTimeout?: OnTimeout;
    /** When it returns false the wait is skipped: the run does not park, and the result is `null`. */
    readonly when?: When;
} & WaitDeadline<WaitView<SchemaOutput<Input>, Results>>) => WorkflowBuilder<Input, Add<Results, Name, EventWaited<Entities, Events, OnTimeout, When>>, N, Declared, EventWaited<Entities, Events, OnTimeout, When>, Where, Ext, Signals, Add<Checked, Name, EventWaited<Entities, Events, OnTimeout, When>>>;
/** What `finish` builds: the definition, typed by what the builder grew, with what a journal adds to it. */
type Finished<Input extends StandardSchemaV1, Results extends AnyResults, N extends Needs, Declared extends StandardSchemaV1 | undefined, Returned, Signals extends AnySignals, Checked extends AnyResults, Ext extends DefExtension> = WorkflowDef<Input, FinishOutput<Declared, Returned>, Signals, N, ReadOutputOf<Declared>, ReadResultsOf<Results, Checked>> & ApplyExtension<Ext, Signals, ReadOutputOf<Declared>, ReadResultsOf<Results, Checked>>;
/** The name of a task's one step: `j.task` is a workflow whose only node is this step. */
export declare const TASK_STEP = "run";
/** A task's body: the body of its one step, which sees no earlier results. */
export type TaskBody<Input extends StandardSchemaV1, N extends Needs, Where extends Host, Returned> = (ctx: Ctx<Input, NoResults, N, Where>) => Returned;
/** The options of a task's one step that make sense for a single step. `next` and `when` do not, and `output` is the workflow's. */
export type TaskStepOptions<Input extends StandardSchemaV1, N extends Needs, Where extends Host, Returned> = Pick<StepOptions<Ctx<Input, NoResults, N, Where>, NoInfer<Resolved<Returned>>, never>, 'retry' | 'timeout' | 'undo' | 'key'>;
/** What `j.task` takes: the workflow's options and its step's options in one object. */
export type TaskOptions<Input extends StandardSchemaV1, N extends Needs, Declared extends StandardSchemaV1 | undefined, Start extends ErasedStartOn, Where extends Host, Returned> = WorkflowOptions<Input, N, Declared, Start, Where> & TaskStepOptions<Input, N, Where, Returned>;
/** What `j.task` builds: what `.step(TASK_STEP, body).finish()` builds. */
export type TaskDef<Input extends StandardSchemaV1, N extends Needs, Declared extends StandardSchemaV1 | undefined, Ext extends DefExtension, Returned> = Finished<Input, Add<NoResults, typeof TASK_STEP, StepResult<Returned, undefined>>, N, Declared, StepResult<Returned, undefined>, NoSignals, NoResults, Ext>;
/** A `waitFor` result: the payload, or `null` when the wait timed out into `continue` or its `when` skipped it. */
type Waited<Payload extends StandardSchemaV1, OnTimeout, When> = OnTimeout extends 'continue' ? SchemaOutput<Payload> | null : Skippable<SchemaOutput<Payload>, When>;
/** What `def.read` gives as the output: the `output` schema's output, `unknown` without one. */
type ReadOutputOf<Declared extends StandardSchemaV1 | undefined> = [Declared] extends [StandardSchemaV1] ? SchemaOutput<Declared> : unknown;
/** What `def.read` gives as the results: a checked node has its schema's type, any other `unknown`. A node that has not run is missing. */
type ReadResultsOf<Results extends AnyResults, Checked extends AnyResults> = {
    readonly [K in keyof Results]?: K extends keyof Checked ? Checked[K] : unknown;
};
/** A node's result, and `null` when the node has a `when` that can skip it. */
type Skippable<Result, When> = undefined extends When ? Result : Result | null;
type StepResult<Returned, When, Kept = never> = Skippable<Resolved<Returned> | Kept, When>;
type FinishOutput<Declared extends StandardSchemaV1 | undefined, Returned> = [Declared] extends [StandardSchemaV1] ? SchemaOutput<Declared> : Resolved<Returned>;
/** What `finish` may return: with an `output` schema, its output or a failure, or a promise of either. */
export type FinishBound<Declared extends StandardSchemaV1 | undefined> = [Declared] extends [StandardSchemaV1] ? SchemaOutput<Declared> | Failure | PromiseLike<SchemaOutput<Declared> | Failure> : unknown;
type Ctx<Input extends StandardSchemaV1, Results extends AnyResults, N extends Needs, Where extends Host> = StepContext<SchemaOutput<Input>, Results, N, Where['db'], Where['run']>;
type FinishContext<Input extends StandardSchemaV1, Results extends AnyResults> = {
    readonly runId: string;
    readonly input: SchemaOutput<Input>;
    readonly results: Results;
};
/**
 * What a journal puts on a finished definition, such as `start` and `signal`, as a type-level function of the
 * definition's signals. The signals are only complete at `finish()`, after `workflow()` has fixed the extension,
 * so the extension is `out`, written in terms of `this['signals']`, and `ApplyExtension` fills the slot in.
 */
export type DefExtension = {
    readonly signals: unknown;
    readonly readOutput: unknown;
    readonly results: unknown;
    readonly out: object;
};
/** The extension that adds nothing. */
export type NoExtension = DefExtension & {
    readonly out: Record<never, never>;
};
/** What the extension `Ext` adds to a definition with the signals `Signals` and what `def.read` gives. */
export type ApplyExtension<Ext extends DefExtension, Signals extends AnySignals, ReadOutput, ReadResults> = (Ext & {
    readonly signals: Signals;
    readonly readOutput: ReadOutput;
    readonly results: ReadResults;
})['out'];
/** Adds what a journal puts on a finished definition. It sees the definition, with its signals, without the addition. */
type Attach<Input extends StandardSchemaV1, Ext extends DefExtension> = <Signals extends AnySignals, ReadOutput, ReadResults extends AnyResults>(def: WorkflowDef<Input, unknown, Signals, Needs, ReadOutput, ReadResults>) => ApplyExtension<Ext, Signals, ReadOutput, ReadResults>;
/**
 * Every signal the nodes wait for, with its schema and where the wait is. The waits inside the branches of a `parallel`
 * node count: the parent's signal door reaches them.
 */
export declare function signalWaits(nodes: readonly WorkflowNode[], prefix?: string): readonly {
    readonly signal: string;
    readonly schema: StandardSchemaV1;
    readonly at: string;
}[];
/**
 * Starts a workflow definition. The version and input schema are required; nodes follow.
 * Throws `BAD_DEFINITION`, naming the workflow, for a duplicate node name, a `next` that is not
 * an earlier node, an `undo` on anything but a step, a child or a command, and a workflow with no node.
 * `startOn` is typed as in `j.workflow`: the event's meta comes from the entity.
 */
export declare function workflow<Input extends StandardSchemaV1, N extends Needs = NoNeeds, Declared extends StandardSchemaV1 | undefined = undefined, Where extends Host = StandaloneHost, E extends AnyEntity = never, D extends EventsOf<E> = never, Timing extends StartTiming = 'after-commit'>(name: string, options: WorkflowOptions<Input, N, Declared, StartOn<Input, E, D, MetaOfEntity<E>, Timing>, Where>): WorkflowBuilder<Input, NoResults, N, Declared, never, Where>;
/**
 * The desugaring of a task: `builder.step(TASK_STEP, run, { retry, timeout, undo, key }).finish()`. `j.task` passes
 * `j.workflow(name, options)` as the builder, so a task is a workflow definition in every way.
 */
export declare function taskOf<Input extends StandardSchemaV1, N extends Needs, Declared extends StandardSchemaV1 | undefined, Where extends Host, Ext extends DefExtension, Returned extends FinishBound<Declared>>(builder: WorkflowBuilder<Input, NoResults, N, Declared, never, Where, Ext>, options: TaskStepOptions<Input, N, Where, Returned>, run: TaskBody<Input, N, Where, Returned>): TaskDef<Input, N, Declared, Ext, Returned>;
/**
 * `workflow` with a journal's additions: `attach` runs when `finish` builds the definition and
 * returns what to merge into it (`start`, from `j.workflow`). The builder types carry that as `Ext`.
 */
export declare function workflowWith<Input extends StandardSchemaV1, N extends Needs, Declared extends StandardSchemaV1 | undefined, Where extends Host, Ext extends DefExtension, Start extends ErasedStartOn>(name: string, options: WorkflowOptions<Input, N, Declared, Start, Where>, attach: Attach<Input, Ext>): WorkflowBuilder<Input, NoResults, N, Declared, never, Where, Ext>;
export {};
//# sourceMappingURL=define.d.ts.map