import { JournalError } from './errors.js';
/**
 * One runner from several, for a worker that runs more than one kind of queue row:
 * `journal.worker(db, { jobs: combineRunners(outboxRunner(...), webhooks.runner) })`.
 * Each row goes to the runner that names its job. Two runners that claim the same name
 * throw `BAD_DEFINITION`: the worker could not tell which one owns the row.
 */
export function combineRunners(...runners) {
    const owners = new Map();
    for (const runner of runners) {
        for (const name of runner.names) {
            if (owners.has(name))
                throw new JournalError('BAD_DEFINITION', 'job runner', name, 'two runners claim this job name');
            owners.set(name, runner);
        }
    }
    const owner = (job) => {
        const found = owners.get(job.name);
        // The worker claims only `names`, so a row always has an owner; this guards a hand-made call.
        if (found === undefined)
            throw new JournalError('BAD_DEFINITION', 'job runner', job.name, 'no runner names this job');
        return found;
    };
    return {
        names: [...owners.keys()],
        run: (job, ctx) => owner(job).run(job, ctx),
        retryDelay: (job, error) => owner(job).retryDelay(job, error),
    };
}
//# sourceMappingURL=runners.js.map