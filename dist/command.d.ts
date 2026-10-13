/**
 * Command execution: parse the input, open the transaction, give the handler a
 * context bound to it, and refuse to close while an operation is still running.
 * May import `api`, `write` (types), `storage`, `transaction-guard` and leaf files.
 * Must not import `journal`, `history` or `worker`.
 */
import type { z } from 'zod';
import type { Command, RunOptions } from './api.js';
import type { HookPointInternal } from './hooks.js';
import type { JournalTables } from './pg.js';
import type { CommandHookContext, TransactionSource } from './types.js';
import type { Writer } from './write.js';
/** What command execution needs from the journal. */
export type CommandDeps<Meta extends z.ZodObject, Tx extends TransactionSource<Tx>> = {
    readonly metaSchema: Meta;
    readonly writeWithValidatedMeta: Writer<Meta, Tx>['writeWithValidatedMeta'];
    /** Wakes this journal's workers. Called after a root-database run that queued a job. */
    readonly wake: () => void;
    /** The command hooks. Frozen by the first run. */
    readonly hooks: HookPointInternal<CommandHookContext<z.output<Meta>>>;
    readonly tables: Pick<JournalTables, 'receipts'>;
};
export declare function createCommandRunner<Meta extends z.ZodObject, Tx extends TransactionSource<Tx>>(deps: CommandDeps<Meta, Tx>): <S extends z.ZodType, R>(source: TransactionSource<Tx>, command: Command<S, R, z.output<Meta>, Tx>, input: NoInfer<z.input<S>>, meta: z.input<Meta>, opts?: RunOptions, cause?: {
    readonly seq: number;
    readonly correlationId: string | null;
}) => Promise<Awaited<R>>;
//# sourceMappingURL=command.d.ts.map