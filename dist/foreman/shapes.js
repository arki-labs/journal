/**
 * The coded refusals of the job actions. They are `ARKI_ADMIN_E0xx` codes of `@arki/admin`, so the
 * dispatcher answers them with the right HTTP status (409, or 400 for the purge bound).
 */
export const JOURNAL_JOBS_ERROR_CODES = {
    /** The job (or the set of jobs) changed since the preview the approval pinned. HTTP 409.
     * @fix Refresh the job preview and obtain approval for its current revision before executing.
     * @verify bun run test -- src/foreman/index.test.ts
     */
    staleRevision: 'ARKI_JOURNAL_E001',
    /** The action needs a dead job and the job is not dead, or is gone. HTTP 409.
     * @fix Select an existing dead job; refresh its state before retrying or discarding it.
     * @verify bun run test -- src/foreman/index.test.ts
     */
    notDead: 'ARKI_JOURNAL_E002',
    /** The purge bound is shorter than `journal.retention.retryableFor`. HTTP 400.
     * @fix Set the purge age at least as long as journal.retention.retryableFor.
     * @verify bun run test -- src/foreman/index.test.ts
     */
    boundTooShort: 'ARKI_JOURNAL_E003',
    /** Cancel needs a ready or delayed job and the job is running, dead or gone. HTTP 409.
     * @fix Cancel only a ready or delayed job; refresh the job state first.
     * @verify bun run test -- src/foreman/index.test.ts
     */
    notPending: 'ARKI_JOURNAL_E004',
    /** Replay is blocked by an unfinished job that holds the same dedupe key. HTTP 409.
     * @fix Wait for or reconcile the unfinished job holding the dedupe key before replaying.
     * @verify bun run test -- src/foreman/index.test.ts
     */
    exists: 'ARKI_JOURNAL_E005',
    /** The job belongs to a workflow run, so the raw job actions refuse it. HTTP 409.
     * @fix Use the workflow operations for this job instead of raw job actions.
     * @verify bun run test -- src/foreman/index.test.ts
     */
    managed: 'ARKI_JOURNAL_E006',
};
/**
 * The coded refusals of the workflow actions. They are module errors, so the dispatcher answers them with the status
 * written here. Canonical generation failures keep their original 500 status.
 */
export const JOURNAL_WORKFLOWS_ERROR_CODES = {
    /** The run changed since the preview the approval pinned. HTTP 409.
     * @fix Refresh the workflow preview and obtain approval for the current run revision.
     * @verify bun run test -- src/foreman/workflows.test.ts
     */
    staleRevision: 'ARKI_JOURNAL_E010',
    /** The run is over: completed, failed or cancelled. HTTP 409.
     * @fix Inspect the terminal run result; start a new run instead of mutating the finished run.
     * @verify bun run test -- src/foreman/workflows.test.ts
     */
    finished: 'ARKI_JOURNAL_E011',
    /** The step is not dead (or never ran), so there is nothing to retry, resolve or skip. HTTP 409.
     * @fix Select a dead step and refresh the run before retrying, resolving or skipping it.
     * @verify bun run test -- src/foreman/workflows.test.ts
     */
    stepNotDead: 'ARKI_JOURNAL_E012',
    /** The signal name is unknown to the run's version, or its payload does not match the signal's schema. HTTP 400.
     * @fix Use a signal declared by the pinned workflow version and supply a payload matching its schema.
     * @verify bun run test -- src/foreman/workflows.test.ts
     */
    badSignal: 'ARKI_JOURNAL_E013',
    /** The run is already undoing its work. HTTP 409.
     * @fix Let compensation finish and inspect its outcome before further workflow operations.
     * @verify bun run test -- src/foreman/workflows.test.ts
     */
    compensating: 'ARKI_JOURNAL_E014',
    /** The step cannot be resolved by hand: no `output` schema, not a step, or the run is not running. 409; 400 for a result that does not match the schema.
     * @fix Resolve a dead step of a running workflow that declares an output schema, using a result accepted by that schema.
     * @verify bun run test -- src/foreman/workflows.test.ts
     */
    stepNotResolvable: 'ARKI_JOURNAL_E015',
    /** No run has this id. HTTP 404.
     * @fix Check the run id against the journal and use an existing run.
     * @verify bun run test -- src/foreman/workflows.test.ts
     */
    notFound: 'ARKI_JOURNAL_E016',
    /** The run's code is not registered on this journal, or has other nodes, so nothing can move it. HTTP 409.
     * @fix Restore the workflow definition and version pinned by the run with its original node shape.
     * @verify bun run test -- src/foreman/workflows.test.ts
     */
    stranded: 'ARKI_JOURNAL_E017',
};
//# sourceMappingURL=shapes.js.map