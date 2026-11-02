import { JournalError, WorkflowStranded } from '../errors.js';
/**
 * The code a run goes on with, or the error that says why it cannot. A run is stranded when no code is registered for
 * its `(name, version)`, or the registered code has another shape than the run started with. Pure, so a read of
 * stranded runs can use the same test as the runner.
 */
export function codeOf(run, registered) {
    const def = registered.get(`${run.name}@${run.workflowVersion}`);
    if (def === undefined) {
        return new JournalError('WORKFLOW_UNKNOWN', 'workflow', run.id, `no registered workflow "${run.name}" v${run.workflowVersion}`);
    }
    if (def.shapeHash !== run.shapeHash) {
        return new JournalError('WORKFLOW_SHAPE_CHANGED', 'workflow', run.id, `"${run.name}" v${run.workflowVersion} has other nodes than this run started with`);
    }
    return def;
}
/** A stranded run's job is dead at once: retrying it before the code is back would fail the same way. */
export const isStrandedError = (reason) => reason instanceof JournalError && (reason.code === 'WORKFLOW_UNKNOWN' || reason.code === 'WORKFLOW_SHAPE_CHANGED');
/** The worker owns the durable failure outcome; preserve the pinned identity and operator diagnostic as data. */
export function strandedFailure(run, error) {
    return WorkflowStranded({
        runId: run.id,
        name: run.name,
        version: run.workflowVersion,
        reason: error.code === 'WORKFLOW_SHAPE_CHANGED' ? 'WORKFLOW_SHAPE_CHANGED' : 'WORKFLOW_UNKNOWN',
        detail: error.message,
    });
}
//# sourceMappingURL=stranded.js.map