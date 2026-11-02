import type { JobRunner, RootDb } from './types.js';
/**
 * One runner from several, for a worker that runs more than one kind of queue row:
 * `journal.worker(db, { jobs: combineRunners(outboxRunner(...), webhooks.runner) })`.
 * Each row goes to the runner that names its job. Two runners that claim the same name
 * throw `BAD_DEFINITION`: the worker could not tell which one owns the row.
 */
export declare function combineRunners<AppDb extends RootDb>(...runners: readonly JobRunner<AppDb>[]): JobRunner<AppDb>;
//# sourceMappingURL=runners.d.ts.map