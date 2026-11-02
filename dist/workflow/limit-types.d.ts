/**
 * The types and bounds of named limits, with no runtime schema: `pg.ts` and the public signatures name these, so their
 * declarations stay free of Zod (A-43), and this file imports nothing that reaches a schema. The verbs' type,
 * `LimitOps`, is in `api.ts`. The entity, the schemas and the start gate are in `limits.ts`.
 */
import type { RetentionAge } from '../retention.js';
import type { LIMIT_BUSY_REASONS } from './states.js';
/** The name of a workflow's own limit is this prefix and the workflow name. A `j.limit` name may not start with it. */
export declare const WORKFLOW_LIMIT_PREFIX = "workflow/";
/**
 * The bounds of limits: a `j.limit` name is at most 128 characters, a workflow lists at most 2 shared limits (as
 * trigger.dev does), and `WorkflowBusy.running` names at most 100 runs. When a slot frees, at most `promoteTries`
 * queued runs are checked, oldest first, so a run end or an operator verb does a bounded amount of work.
 */
export declare const LIMIT_BOUNDS: {
    readonly name: 128;
    readonly shared: 2;
    readonly runningShown: 100;
    readonly promoteTries: 50;
};
/** How long a `perKey` override of one key lasts: 7 days unless `ttl` says otherwise, and at most 30 days. */
export declare const LIMIT_KEY_TTL: {
    readonly default: '7d';
    readonly max: '30d';
};
/**
 * A limit several workflows share: `total` caps the unfinished runs that hold it, `perKey` those that hold it with one
 * concurrency key (the `key` of each workflow's `concurrency`). At least one of the two, each a positive whole number.
 */
export type LimitDef = {
    readonly name: string;
    readonly total?: number | undefined;
    readonly perKey?: number | undefined;
};
/** `j.limit`: checks the limit and returns it frozen, so the values every workflow sees are the ones checked here. */
export declare function defineLimit(def: LimitDef): LimitDef;
/** The name of the limit a workflow's own `concurrency.limit` and `total` form. */
export declare const workflowLimitName: (workflow: string) => string;
/** Why a limit refuses a start: it is `full`, or an operator `paused` it. */
export type LimitBusyReason = (typeof LIMIT_BUSY_REASONS)[number];
/** A `perKey` an operator set for one key, until `until` (ISO). `journal_limits.keys` holds them by key. */
export type LimitKeyOverride = {
    readonly perKey: number;
    readonly until: string;
};
/**
 * One limit a start holds, with its code values. `workflow` is set for a workflow's own limit: it counts that
 * workflow's runs by name, so the runs started before `workflow_runs.limits` existed count too. A shared limit counts
 * the runs whose `limits` name it.
 */
export type HeldLimit = {
    readonly name: string;
    readonly total: number | undefined;
    readonly perKey: number | undefined;
    readonly workflow: string | undefined;
};
/** A limit the journal knows: one in a registered workflow's `concurrency`, or a registered workflow's own. */
export type KnownLimit = HeldLimit & {
    /** The workflows whose starts hold it. */
    readonly workflows: readonly string[];
    /** False for the own limit of a workflow without `concurrency`: only a pause applies to it. */
    readonly gated: boolean;
    /** Whether a start that holds it has a concurrency key, so a `perKey` can apply. */
    readonly keyed: boolean;
};
/**
 * What blocks a start: a paused limit, or one whose `total` or `perKey` is full. `value` is the effective count that
 * is reached (0 for a pause). Slice 2C's queue reads the same answer to decide that a start waits.
 */
export type LimitBlock = {
    readonly limit: HeldLimit;
    readonly reason: LimitBusyReason;
    readonly scale: 'total' | 'perKey' | undefined;
    readonly value: number;
};
/** A limit's `total` and `perKey`; null for none. */
export type LimitValues = {
    readonly total: number | null;
    readonly perKey: number | null;
};
/** A `perKey` override of one key, as `journal.limits` shows it. */
export type LimitKeyView = {
    readonly key: string;
} & LimitKeyOverride;
/** One limit as `journal.limits` shows it: the code values, what an operator changed, and what applies now. */
export type LimitView = {
    readonly name: string;
    readonly workflows: readonly string[];
    readonly code: LimitValues;
    /** The `total` and `perKey` an operator set, which replace the code values until `reset`. */
    readonly override: LimitValues;
    /** The `perKey` overrides of single keys that have not expired. */
    readonly keys: readonly LimitKeyView[];
    /** The values a start is checked against: an override, or else the code value. A key override is not in it. */
    readonly effective: LimitValues;
    readonly paused: boolean;
    /** How many unfinished runs hold the limit now. A queued run holds no slot, so it is not one of them. */
    readonly running: number;
    /** How many queued runs wait for room in the limit (`onBusy: 'queue'`). */
    readonly queued: number;
    /** The `journal.limit` entity's version: 0 until an operator first changes it. An approval to change it is taken on it. */
    readonly version: number;
};
/**
 * `override` sets the `perKey` of one key for `ttl` (default `LIMIT_KEY_TTL.default`, at most `.max`), or the
 * limit's own `total` and `perKey` (at least one) until `reset`. 0 admits no run: `perKey: 0` blocks a key.
 */
export type LimitOverrideArgs = {
    readonly name: string;
    readonly key: string;
    readonly perKey: number;
    readonly ttl?: RetentionAge | undefined;
} | {
    readonly name: string;
    readonly total?: number | undefined;
    readonly perKey?: number | undefined;
};
/** `reset` drops the override of one key, or without `key` every override of the limit (not its pause). */
export type LimitResetArgs = {
    readonly name: string;
    readonly key?: string | undefined;
};
/** `pause` and `resume` name the limit. */
export type LimitNameArgs = {
    readonly name: string;
};
//# sourceMappingURL=limit-types.d.ts.map