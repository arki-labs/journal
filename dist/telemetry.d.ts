/**
 * OpenTelemetry spans for the journal's three execution boundaries:
 * - `journal.command`: one command run, inside its transaction, around the app's command hooks.
 * - `journal.effect`: one effect attempt, inside its lease, around the app's effect hooks.
 * - `journal.step`: the body (or the undo) of one workflow step attempt. It runs inside the `workflow.step` effect,
 *   which also loads the run, writes the checkpoint and routes, so the step span is a narrower boundary, not a copy.
 *
 * Telemetry never owns the work. A tracer, context manager or span that throws is ignored, the work runs exactly
 * once, and its result or throw passes through unchanged. A returned failure is recorded as `failure.code` with
 * `journal.outcome = failure`, never as an exception event; a throw is `journal.outcome = defect`. Inputs, payloads,
 * meta, results and error messages are never attributes. With no SDK installed, every call is a no-op.
 * Leaf file.
 */
import type { Attributes } from '@opentelemetry/api';
/** The span names the journal emits. */
export declare const JOURNAL_SPANS: readonly ['journal.command', 'journal.effect', 'journal.step'];
export type JournalSpan = (typeof JOURNAL_SPANS)[number];
/** The values of the `journal.outcome` attribute. */
export declare const JOURNAL_OUTCOMES: readonly ['ok', 'failure', 'defect'];
export type JournalOutcome = (typeof JOURNAL_OUTCOMES)[number];
/** Runs `work` inside span `name`, as the active span, so commands it runs become child spans. */
export declare function withJournalSpan<T>(name: JournalSpan, attributes: Attributes, work: () => Promise<T>): Promise<T>;
//# sourceMappingURL=telemetry.d.ts.map