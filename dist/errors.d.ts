export type JournalErrorCode = 'CONFLICT' | 'NO_ROW' | 'ROW_EXISTS' | 'UNKNOWN_EVENT' | 'VERSION_MISMATCH' | 'NO_HISTORY' | 'HISTORY_GAP' | 'REPLAY_FAILED' | 'UNSTABLE_SCHEMA' | 'ID_MISMATCH' | 'VALUE_MISMATCH' | 'BAD_DEFINITION';
/**
 * An error about one entity's row or history: a write, replay, verify or repair
 * that the journal refuses. Match on `code`, never on the message.
 *
 * Not every error the journal lets out is a `JournalError`:
 * - A wrong definition is a `JournalError` with code `BAD_DEFINITION`, thrown when the
 *   declaration runs (a bad name, a bad key column, a duplicate reducer or handler name).
 * - A misuse at run time is a plain `Error` whose message starts with `journal:` (two
 *   operations at once on one transaction, `drain` inside a transaction).
 * - Command input, event data or `meta` that fails its schema is a `ZodError`.
 * - An error thrown by a command handler, an `events` function, a reducer or a
 *   projection passes through unchanged. A rejected business rule is one of
 *   these: a `CommandError`, below.
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
/** The kind of answer a rejected request gets. The names are the usual HTTP ones: 404, 400, 403, 409. */
export type CommandErrorCode = 'NOT_FOUND' | 'BAD_REQUEST' | 'FORBIDDEN' | 'CONFLICT';
/**
 * A business rule rejected the request. App code throws it: a command handler,
 * or the `events` function of a `write`. The code names the kind of answer and
 * the message is written for the client.
 *
 * It is NOT a `JournalError`. A `JournalError` is the library's own failure: a
 * row or a history it refuses. A `CommandError` is the app's rule saying no.
 * The library never throws one and never changes one: like every error thrown
 * by app code, it leaves `journal.run` as the same instance, after the
 * command's transaction rolled back.
 *
 * Nothing here knows HTTP. The host maps the code to its own transport:
 * `@arki/journal/orpc` does it for oRPC, and any other host matches on the
 * code with `isCommandError`.
 */
export declare class CommandError extends Error {
    readonly code: CommandErrorCode;
    constructor(code: CommandErrorCode, message: string);
}
export declare function isCommandError(error: unknown, code?: CommandErrorCode): error is CommandError;
//# sourceMappingURL=errors.d.ts.map