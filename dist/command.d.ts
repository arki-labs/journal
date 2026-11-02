import type { SchemaInput, SchemaOutput, StandardSchemaV1 } from '@arki/schema';
import type { Command, RunOptions } from './api.js';
import type { CommandFailure } from './errors.js';
import type { HookPointInternal } from './hooks.js';
import type { PgStore } from './store.js';
import type { CommandHookContext, DbHandle, TransactionSource } from './types.js';
import type { Writer } from './write.js';
/** What command execution needs from the journal. */
export type CommandDeps<Meta extends StandardSchemaV1<unknown, Record<string, unknown>>, Tx extends TransactionSource<Tx>> = {
    readonly metaSchema: Meta;
    readonly writeWithValidatedMeta: Writer<Meta, Tx>['writeWithValidatedMeta'];
    /** Wakes this journal's workers. Called after a root-database run that queued a job. */
    readonly wake: () => void;
    /** The command hooks. Frozen by the first run. */
    readonly hooks: HookPointInternal<CommandHookContext<SchemaOutput<Meta>>>;
    /** Claims and settles idempotency receipts. */
    readonly store: PgStore;
};
/**
 * Runs first inside a command's transaction and throws to refuse it. A workflow body's `ctx.run` passes the check that
 * its attempt is still the job's open attempt. Child commands run inside the same transaction, so only the top one is fenced.
 */
export type Fence = (tx: DbHandle) => Promise<void>;
export declare function createCommandRunner<Meta extends StandardSchemaV1<unknown, Record<string, unknown>>, Tx extends TransactionSource<Tx>>(deps: CommandDeps<Meta, Tx>): <S extends StandardSchemaV1, R>(source: TransactionSource<Tx>, command: Command<S, R, SchemaOutput<Meta>, Tx>, input: NoInfer<SchemaInput<S>>, meta: SchemaInput<Meta>, opts?: RunOptions, cause?: {
    readonly seq: number;
    readonly correlationId: string | null;
}, fence?: Fence) => Promise<Awaited<R> | CommandFailure>;
//# sourceMappingURL=command.d.ts.map