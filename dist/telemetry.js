import { context, SpanStatusCode, trace } from '@opentelemetry/api';
import { isFailure } from '@arki/failure';
/** The span names the journal emits. */
export const JOURNAL_SPANS = ['journal.command', 'journal.effect', 'journal.step'];
/** The values of the `journal.outcome` attribute. */
export const JOURNAL_OUTCOMES = ['ok', 'failure', 'defect'];
/** Runs an instrumentation call; a throw from it is dropped. */
function observe(operation) {
    try {
        return operation();
    }
    catch {
        return undefined;
    }
}
/** Runs `work` inside span `name`, as the active span, so commands it runs become child spans. */
export async function withJournalSpan(name, attributes, work) {
    const span = observe(() => trace.getTracer('@arki/journal').startSpan(name, { attributes }));
    let pending;
    const once = () => (pending ??= work());
    // A context manager may throw before or after it calls `once`. `once` keeps the work to one run either way.
    if (span !== undefined)
        void observe(() => context.with(trace.setSpan(context.active(), span), once));
    const outcome = (value) => observe(() => span?.setAttribute('journal.outcome', value));
    try {
        const result = await once();
        if (isFailure(result)) {
            outcome('failure');
            observe(() => span?.setAttribute('failure.code', result.code));
            observe(() => span?.setStatus({ code: SpanStatusCode.ERROR, message: result.code }));
        }
        else {
            outcome('ok');
        }
        return result;
    }
    catch (error) {
        outcome('defect');
        observe(() => span?.setStatus({ code: SpanStatusCode.ERROR }));
        throw error;
    }
    finally {
        observe(() => span?.end());
    }
}
//# sourceMappingURL=telemetry.js.map