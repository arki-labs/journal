export type JournalErrorCode = 'CONFLICT' | 'NO_ROW' | 'ROW_EXISTS' | 'UNKNOWN_EVENT' | 'VERSION_MISMATCH' | 'NO_HISTORY' | 'HISTORY_GAP' | 'FORWARD_PENDING' | 'FORWARD_DIVERGED' | 'REPLAY_FAILED' | 'UNSTABLE_SCHEMA' | 'ID_MISMATCH' | 'VALUE_MISMATCH' | 'IGNORED_FAILURE' | 'INVALID_ACCEPT' | 'BAD_DEFINITION' | 'JOB_NOT_DEAD' | 'JOB_NOT_PENDING' | 'JOB_RUNNING' | 'JOB_EXISTS' | 'JOB_MANAGED' | 'BAD_ARGUMENT' | 'LEASE_LOST' | 'STEP_TIMEOUT' | 'WORKFLOW_LIMIT' | 'WORKFLOW_UNKNOWN' | 'WORKFLOW_SHAPE_CHANGED' | 'WORKFLOW_VERSION_RETIRED' | 'WORKFLOW_NOT_FOUND' | 'WORKFLOW_FINISHED' | 'WORKFLOW_COMPENSATING' | 'STEP_NOT_DEAD' | 'STEP_NOT_RESOLVABLE' | 'WORKFLOW_READ_MISMATCH';
/**
 * An error about one entity's row or history: a write, replay, verify or repair
 * that the journal refuses. Match on `code`, never on the message.
 *
 * Not every error the journal lets out is a `JournalError`:
 * - A wrong definition is a `JournalError` with code `BAD_DEFINITION`, thrown when the
 *   declaration runs (a bad name, a bad key column, a duplicate reducer or handler name),
 *   or when a command writes an event its `writes` list does not declare.
 * - A misuse at run time is a plain `Error` whose message starts with `journal:` (two
 *   operations at once on one transaction, `drain` inside a transaction).
 * - A misused `accept` (a value the handler never received, accepted twice, called late,
 *   or not a failure) is a `JournalError` with code `INVALID_ACCEPT`.
 * - Command input, event data or `meta` that fails its schema returns `InvalidInput`
 *   from `@arki/failure`, with `data.issues`. An async schema in a sync call returns
 *   `AsyncSchema`; a throwing validator returns `ValidatorDefect`.
 * - An error thrown by a command handler, an `events` function, a reducer or a
 *   projection is normalized by command transaction ownership to `TransactionDefect` with a private cause.
 *   Direct low-level operations keep their documented exception contract. A rejected business rule is not thrown:
 *   it is returned as a failure (`CommandNotFound` and the others below), and
 *   `journal.run` returns it.
 * An error thrown by an effect is caught by `drain` and stored on the job.
 */
export declare class JournalError extends Error {
    readonly code: JournalErrorCode;
    readonly kind: string;
    readonly entityId: string;
    /** The message reads: `CODE: what happened (kind id): detail. What to do next.` */
    constructor(code: JournalErrorCode, kind: string, entityId: string, detail?: string, options?: ErrorOptions);
}
export declare function isJournalError(error: unknown, code?: JournalErrorCode): error is JournalError;
/**
 * The four failures a command returns when a rule of the app says no. Return one from a
 * command handler, its `authorize`, or the `events` function of a `write`: the command's
 * transaction rolls back, exactly as for a throw, and `journal.run` returns the same
 * failure to the caller. `detail` is the message, written for the client. An app may
 * return its own `defineFailure` values too; any failure rolls the command back.
 * @fix Check the resource identifier and use an existing resource visible to this command.
 * @verify bun run test -- src/returned-failure.test.ts
 */
export declare const CommandNotFound: import("@arki/failure").FailureDefinition<"journal.not_found", import("@standard-schema/spec").StandardSchemaV1<{
    detail: string;
}, {
    detail: string;
}>>;
/** A {@link CommandNotFound} failure value. */
export type CommandNotFound = ReturnType<typeof CommandNotFound>;
/** The request is wrong in a way the input schema cannot see. See {@link CommandNotFound}.
 * @fix Correct the domain request described by the client-facing detail before submitting again.
 * @verify bun run test -- src/returned-failure.test.ts
 */
export declare const CommandInvalid: import("@arki/failure").FailureDefinition<"journal.invalid", import("@standard-schema/spec").StandardSchemaV1<{
    detail: string;
}, {
    detail: string;
}>>;
/** A {@link CommandInvalid} failure value. */
export type CommandInvalid = ReturnType<typeof CommandInvalid>;
/** The caller may not do this. See {@link CommandNotFound}.
 * @fix Use a caller authorized for this command; do not retry the same unauthorized request.
 * @verify bun run test -- src/returned-failure.test.ts
 */
export declare const CommandForbidden: import("@arki/failure").FailureDefinition<"journal.forbidden", import("@standard-schema/spec").StandardSchemaV1<{
    detail: string;
}, {
    detail: string;
}>>;
/** A {@link CommandForbidden} failure value. */
export type CommandForbidden = ReturnType<typeof CommandForbidden>;
/** The current state does not allow it, such as an order that is already paid. See {@link CommandNotFound}.
 * @fix Refresh the resource state and choose an operation permitted by its current state.
 * @verify bun run test -- src/returned-failure.test.ts
 */
export declare const CommandConflict: import("@arki/failure").FailureDefinition<"journal.conflict", import("@standard-schema/spec").StandardSchemaV1<{
    detail: string;
}, {
    detail: string;
}>>;
/** A {@link CommandConflict} failure value. */
export type CommandConflict = ReturnType<typeof CommandConflict>;
/** The pinned workflow code is unavailable or incompatible; keep the run unchanged until an operator restores it.
 * @fix Restore the pinned workflow version and original node shape before resuming the run.
 * @verify bun run test -- src/returned-failure.test.ts
 */
export declare const WorkflowStranded: import("@arki/failure").FailureDefinition<"journal.workflow_stranded", import("@standard-schema/spec").StandardSchemaV1<{
    runId: string;
    name: string;
    version: number;
    reason: "WORKFLOW_SHAPE_CHANGED" | "WORKFLOW_UNKNOWN";
    detail: string;
}, {
    runId: string;
    name: string;
    version: number;
    reason: "WORKFLOW_SHAPE_CHANGED" | "WORKFLOW_UNKNOWN";
    detail: string;
}>>;
export type WorkflowStranded = ReturnType<typeof WorkflowStranded>;
/** A start found a limit it holds full or paused (`reason`). `limitName` names it: `workflow/<name>` for the
 * workflow's own `concurrency.limit` and `total`, else a `j.limit`. `limit` is the count that is reached (0 for a
 * pause), `key` the start's concurrency key (`null` without one: only a `total` can block such a start). `running` lists the runs of the caller's own scope that
 * hold the limit, oldest first, at most 100; another scope's run ids are never shown. Returned when `onBusy` is
 * `'refuse'`, for a pause, for a full limit other than the workflow's own `perKey`, and always for a child run: a
 * child cannot join a run that another parent started.
 * @fix Wait for one of the running runs to finish, start the run with another concurrency key, or ask an operator to
 * raise or resume the limit (`journal.limits`).
 * @verify bun run test -- src/workflow/concurrency.test.ts
 */
export declare const WorkflowBusy: import("@arki/failure").FailureDefinition<"journal.workflow_busy", import("@standard-schema/spec").StandardSchemaV1<{
    name: string;
    key: string | null;
    limit: number;
    running: string[];
    limitName?: string | undefined;
    reason?: "full" | "paused" | undefined;
    detail: string;
}, {
    name: string;
    key: string | null;
    limit: number;
    running: string[];
    limitName?: string | undefined;
    reason?: "full" | "paused" | undefined;
    detail: string;
}>>;
/** A {@link WorkflowBusy} failure value. */
export type WorkflowBusy = ReturnType<typeof WorkflowBusy>;
/** A run tried to start a node past its workflow's `limits.transitions`, so it stops: it compensates, then ends `failed`
 * with this failure as its error. `limit` is the workflow's `limits.transitions`; `transitions` is the count the run
 * had reached. A transition is the first try of a node: each visit of a node in a loop counts, and so does a node its
 * `when` skips; a retry and an undo do not.
 * @fix Find why the run loops (a `next` that never leaves the loop), or raise `limits.transitions` when the loop is as long as the work needs.
 * @verify bun run test -- src/workflow/transitions.pg.test.ts
 */
export declare const WorkflowTransitionLimit: import("@arki/failure").FailureDefinition<"journal.workflow_transition_limit", import("@standard-schema/spec").StandardSchemaV1<{
    runId: string;
    name: string;
    limit: number;
    transitions: number;
    detail: string;
}, {
    runId: string;
    name: string;
    limit: number;
    transitions: number;
    detail: string;
}>>;
/** A {@link WorkflowTransitionLimit} failure value. */
export type WorkflowTransitionLimit = ReturnType<typeof WorkflowTransitionLimit>;
/** What `def.read` returns when a stored value of the run does not fit its schema. `field` is `input`, `output` or
 * `results.<node>`; `detail` is the `WORKFLOW_READ_MISMATCH` message, and the cause is the schema's `InvalidInput`,
 * with its issues.
 * @fix Read the run untyped with journal.workflows.run, or let the schema take the values older runs stored.
 * @verify bun run test -- src/workflow/def-read.test.ts
 */
export declare const WorkflowReadMismatch: import("@arki/failure").FailureDefinition<"journal.workflow_read_mismatch", import("@standard-schema/spec").StandardSchemaV1<{
    runId: string;
    field: string;
    detail: string;
}, {
    runId: string;
    field: string;
    detail: string;
}>>;
/** A {@link WorkflowReadMismatch} failure value. */
export type WorkflowReadMismatch = ReturnType<typeof WorkflowReadMismatch>;
/** `def.settled` or `def.startAndWait` stopped waiting before the run ended. The run goes on: a wait never cancels it.
 * `runId` is the run to read again later (`def.settled`), or to cancel on purpose.
 * @fix Read the run again with def.settled, or take the run id and return to the caller now; do not start the work again.
 * @verify bun run test -- src/workflow/outcomes.test.ts
 */
export declare const WorkflowPending: import("@arki/failure").FailureDefinition<"journal.workflow_pending", import("@standard-schema/spec").StandardSchemaV1<{
    runId: string;
}, {
    runId: string;
}>>;
/** A {@link WorkflowPending} failure value. */
export type WorkflowPending = ReturnType<typeof WorkflowPending>;
/** A run that `def.startAndWait` waited for ended `failed` (or `expired`): a step died, or a node refused. `error` is the text the run recorded.
 * @fix Read the run (def.read) to see which node failed, and retry that step or start the run again.
 * @verify bun run test -- src/workflow/outcomes.test.ts
 */
export declare const WorkflowRunFailed: import("@arki/failure").FailureDefinition<"journal.workflow_run_failed", import("@standard-schema/spec").StandardSchemaV1<{
    runId: string;
    state: "expired" | "failed";
    error: string;
}, {
    runId: string;
    state: "expired" | "failed";
    error: string;
}>>;
/** A {@link WorkflowRunFailed} failure value. */
export type WorkflowRunFailed = ReturnType<typeof WorkflowRunFailed>;
/** A run that `def.startAndWait` waited for was cancelled. `reason` is the cancel's reason, or `null` when none was recorded.
 * @fix Start the run again if the work is still wanted.
 * @verify bun run test -- src/workflow/outcomes.test.ts
 */
export declare const WorkflowRunCancelled: import("@arki/failure").FailureDefinition<"journal.workflow_run_cancelled", import("@standard-schema/spec").StandardSchemaV1<{
    runId: string;
    reason: string | null;
}, {
    runId: string;
    reason: string | null;
}>>;
/** A {@link WorkflowRunCancelled} failure value. */
export type WorkflowRunCancelled = ReturnType<typeof WorkflowRunCancelled>;
/** Failures owned by command execution, in addition to the command definition's inferred refusals. */
export declare const COMMAND_FAILURES: readonly [import("@arki/failure").FailureDefinition<"schema.invalid_input", import("@standard-schema/spec").StandardSchemaV1<unknown, {
    issues: readonly import("@standard-schema/spec").StandardSchemaV1.Issue[];
}>>, import("@arki/failure").FailureDefinition<"schema.async_required", undefined>, import("@arki/failure").FailureDefinition<"schema.validator_defect", undefined>, import("@arki/failure").FailureDefinition<"db.transaction_conflict", import("@standard-schema/spec").StandardSchemaV1<{
    attempts: number;
    sqlState: "40001" | "40P01";
}, {
    attempts: number;
    sqlState: "40001" | "40P01";
}>>, import("@arki/failure").FailureDefinition<"db.transaction_unavailable", undefined>, import("@arki/failure").FailureDefinition<"db.transaction_rejected", import("@standard-schema/spec").StandardSchemaV1<{
    sqlState: string;
}, {
    sqlState: string;
}>>, import("@arki/failure").FailureDefinition<"db.transaction_commit_uncertain", undefined>, import("@arki/failure").FailureDefinition<"db.transaction_cancelled", undefined>, import("@arki/failure").FailureDefinition<"db.transaction_defect", undefined>, import("@arki/failure").FailureDefinition<"contracts.random_source_unavailable", undefined>, import("@arki/failure").FailureDefinition<"failure.unexpected_defect", undefined>, import("@arki/failure").FailureDefinition<"journal.conflict", import("@standard-schema/spec").StandardSchemaV1<{
    detail: string;
}, {
    detail: string;
}>>];
export type CommandFailure = ReturnType<(typeof COMMAND_FAILURES)[number]>;
//# sourceMappingURL=errors.d.ts.map