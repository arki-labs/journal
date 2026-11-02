import type { JournalTables } from './pg.js';
/** The units an age string takes: minutes, hours, days. */
export declare const AGE_UNITS: readonly ['m', 'h', 'd'];
/** Seconds, or a string with unit `m`, `h` or `d` (`'30d'`): the same shape `@arki/schedule` takes for its lock durations. */
export type RetentionAge = number | `${number}${(typeof AGE_UNITS)[number]}`;
/**
 * What to do with a finished job's archive row.
 * - `false`: never written. The job is deleted the moment it finishes.
 * - `'forever'`: kept until someone deletes it.
 * - `'untilExported'`: kept only until the archive sink has it, then deleted. Needs a sink.
 * - an age: kept this long.
 * - `{ age, max }`: kept this long, and at most `max` rows per outcome and effect or job name (the oldest go first).
 */
export type Keep = false | 'forever' | 'untilExported' | RetentionAge | {
    readonly age: RetentionAge | 'forever';
    readonly max?: number;
};
/** A finished job as the archive stores it. */
export type ArchivedJob = JournalTables['jobArchive']['$inferSelect'];
/** Where archive rows go after the table. At-least-once: dedupe on `row.id`. */
export type ArchiveSink = {
    readonly name: string;
    write(rows: readonly ArchivedJob[], ctx: {
        readonly signal: AbortSignal;
    }): Promise<void>;
};
/**
 * How long a finished workflow run's row is kept, by how it ended. Values are {@link Keep}s, with two limits that
 * `BAD_DEFINITION` enforces: `'untilExported'` (a run has no sink) and `max` (there is no per-name row cap for runs).
 * `false` deletes the run row at the next sweep. A run's events are never pruned.
 */
export type RunRetention = {
    /** Default `'7d'`. */
    readonly completed?: Keep;
    /** Default `'90d'`. */
    readonly failed?: Keep;
    /** Default: the `failed` value. */
    readonly cancelled?: Keep;
    /** A run whose `ttl` passed before it started. Default: the `failed` value, as for `cancelled`. */
    readonly expired?: Keep;
};
/** The journal-wide policy. Every field is optional; the defaults are in {@link defaultRetention}. */
export type JobRetention = {
    /** A dead job stays in the hot table, retryable, this long; then the sweeper archives it. Default `'30d'`. */
    readonly retryableFor?: RetentionAge;
    readonly archive?: {
        /** Default `'7d'`. */
        readonly completed?: Keep;
        /** Outcomes dead, discarded and cancelled. Default `'90d'`. */
        readonly dead?: Keep;
        readonly sink?: ArchiveSink;
    };
    /** The operations audit. Default `'forever'`. */
    readonly operations?: Keep;
    /** Finished workflow runs: how long each kind of ending keeps its run row. */
    readonly workflows?: RunRetention;
    /** Default `{ every: '1h', batch: 1000 }`. `false`: the app schedules the sweep verbs itself. */
    readonly sweep?: false | {
        readonly every?: RetentionAge;
        readonly batch?: number;
    };
};
/** The per-effect (or per queue job name) override. */
export type EffectRetention = {
    readonly completed?: Keep;
    readonly dead?: Keep;
    readonly retryableFor?: RetentionAge;
};
/** An archive outcome. */
export type ArchiveOutcome = ArchivedJob['outcome'];
/** A {@link Keep} after parsing. */
export type ResolvedKeep = {
    readonly store: false;
} | {
    readonly store: true;
    /** Milliseconds to keep the row; null keeps it forever. */
    readonly ageMs: number | null;
    /** Kept only until the sink has it. */
    readonly untilExported: boolean;
    /** Row cap per outcome and effect or job name. */
    readonly max: number | undefined;
};
/** The journal-wide policy after parsing, defaults applied. */
export type ResolvedRetention = {
    readonly retryableForMs: number;
    readonly completed: ResolvedKeep;
    readonly dead: ResolvedKeep;
    readonly sink: ArchiveSink | undefined;
    readonly operations: ResolvedKeep;
    readonly workflows: {
        readonly completed: ResolvedKeep;
        readonly failed: ResolvedKeep;
        readonly cancelled: ResolvedKeep;
        readonly expired: ResolvedKeep;
    };
    readonly sweep: false | {
        readonly everyMs: number;
        readonly batch: number;
    };
};
/** An age in milliseconds. A number is seconds. Throws `BAD_DEFINITION` on anything else. */
export declare function parseAge(age: RetentionAge): number;
/** Parse one {@link Keep}. Throws `BAD_DEFINITION` on a bad age or `max`. */
export declare function parseKeep(keep: Keep): ResolvedKeep;
/** The most rows one verb call takes: the same bound `purgeDead` has. */
export declare const MAX_SWEEP_BATCH = 5000;
/** The defaults, as the synthesis fixes them: completed 7d, dead 90d, retryable 30d, operations forever, sweep hourly. */
export declare const defaultRetention: {
    readonly retryableFor: '30d';
    readonly completed: '7d';
    readonly dead: '90d';
    readonly operations: 'forever';
    readonly workflows: {
        readonly completed: '7d';
        readonly failed: '90d';
    };
    readonly sweep: {
        readonly every: '1h';
        readonly batch: 1000;
    };
};
/**
 * Parse one {@link RunRetention} value. Throws `BAD_DEFINITION` for `'untilExported'` and for `max`: neither means
 * anything for a run row. `where` names the setting in the message.
 */
export declare function parseRunKeep(keep: Keep, where: string): ResolvedKeep;
/** Parse the journal-wide policy and fill the defaults. Throws `BAD_DEFINITION` on a bad value. */
export declare function resolveRetention(retention: JobRetention | undefined): ResolvedRetention;
/**
 * The keep rule for one archived row: the effect's (or queue job name's) override if it names this class,
 * else the journal's, which already holds the default. `dead`, `discarded` and `cancelled` share the `dead` class.
 */
export declare function keepFor(policy: ResolvedRetention, outcome: ArchiveOutcome, override: EffectRetention | undefined): ResolvedKeep;
/**
 * The keep rule for a run that ended as `outcome`. The workflow's own setting wins over the journal's. A workflow
 * that sets `failed` but not `cancelled` (or `expired`) gives both the same time, as the journal's default does.
 */
export declare function runKeepFor(policy: ResolvedRetention, own: RunRetention, outcome: keyof ResolvedRetention['workflows'], workflow: string): ResolvedKeep;
/** The `keep_until` of a run that ended at `now`. `false` is `now`: the next sweep deletes the row. Null keeps it. */
export declare function runKeepUntil(keep: ResolvedKeep, now: Date): Date | null;
/** How long a dead job stays retryable in the hot table, in milliseconds. */
export declare function retryableForMs(policy: ResolvedRetention, override: EffectRetention | undefined): number;
/**
 * The `keep_until` to store when a row is archived at `now`. Null keeps it forever.
 * `'untilExported'` stores `now`: the prune step deletes a row past `keep_until` once the sink has it,
 * so the row goes right after export. Call only when `keep.store` is true; a `false` keep writes no row.
 */
export declare function keepUntil(keep: Extract<ResolvedKeep, {
    store: true;
}>, now: Date): Date | null;
/** An effect as retention sees it: its name and the override on its schedule. */
type RetentionSource = {
    readonly name: string;
    readonly schedule: {
        readonly retention?: EffectRetention;
    };
};
/**
 * The override for a job row's effect, by name. The one lookup the worker's ack and the operator verbs share, so a
 * job is archived under the same rule whoever removes it. Queue rows have none here: a queue job's override comes
 * from its runner, which only a worker holds.
 */
export declare function effectOverrides(effects: readonly RetentionSource[]): (job: {
    readonly effect: string | null;
}) => EffectRetention | undefined;
/**
 * Boot check. `'untilExported'` means "keep only until the sink has it", so it needs a sink; effects are defined
 * before the runtime journal exists, so the type cannot say this and the journal checks it once, at init.
 * Also parses every effect override, so a bad age fails at init instead of at the first ack.
 */
export declare function assertRetention(policy: ResolvedRetention, effects: readonly RetentionSource[]): void;
/** Where `ndjsonArchiveSink` puts a file. A method type on purpose: `@arki/fs`'s `StorageAdapter.put(key, Buffer, options?)` fits it. */
export type ArchiveObjectStore = {
    put(key: string, body: Uint8Array | string): Promise<unknown>;
};
/**
 * An {@link ArchiveSink} that writes one NDJSON file per batch: one JSON line per archived job, in batch order.
 * The key is `<prefix>/YYYY/MM/DD/<first archived_at in ms>-<first id>.ndjson` (UTC). Resending a batch after a
 * crash between write and mark gives the same key when the batch starts at the same row, so a store that overwrites
 * by key makes the retry harmless; a different start gives another file and the reader dedupes on `id`.
 */
export declare function ndjsonArchiveSink(options: ArchiveObjectStore & {
    /** Default `journal-archive`. */
    readonly prefix?: string;
}): ArchiveSink;
export {};
//# sourceMappingURL=retention.d.ts.map