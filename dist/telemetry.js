import { context, ROOT_CONTEXT, SpanStatusCode, trace } from '@opentelemetry/api';
import { isFailure, isFault } from '@arki/failure';
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
/**
 * Runs `work` in the root context, so the spans it opens start their own trace. In a Dot app the worker starts
 * inside the `dot.unit.start` span, which ends at once: a background job must not look like part of app startup.
 * A context manager that throws is ignored, and `work` runs exactly once.
 */
export function inRootContext(work) {
    let ran;
    const once = () => {
        if (ran === undefined) {
            try {
                ran = { value: work() };
            }
            catch (error) {
                ran = { error };
            }
        }
        return ran;
    };
    void observe(() => context.with(ROOT_CONTEXT, once));
    const outcome = once();
    if ('error' in outcome)
        throw outcome.error;
    return outcome.value;
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
            // An expected outcome (4xx) leaves the status unset; only a fault (5xx) is an error.
            if (isFault(result))
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