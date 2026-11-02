import { jobsModule } from './jobs.js';
import { workflowsModule } from './workflows.js';
export { foremanReceiptTables, journalReceiptStore, } from './receipts.js';
export { JOURNAL_JOBS_ERROR_CODES, JOURNAL_WORKFLOWS_ERROR_CODES, } from './shapes.js';
/** The Foreman module for the journal's jobs. */
export function journalJobsModule(options) {
    return jobsModule(options);
}
/** The Foreman module for durable workflow runs. */
export function journalWorkflowsModule(options) {
    return workflowsModule(options);
}
//# sourceMappingURL=index.js.map