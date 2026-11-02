import { JournalError, WorkflowStranded } from '../errors.js';
/** The part of a run row that says which code it needs. */
type RunCode = {
    readonly id: string;
    readonly name: string;
    readonly workflowVersion: number;
    readonly shapeHash: string;
};
/**
 * The code a run goes on with, or the error that says why it cannot. A run is stranded when no code is registered for
 * its `(name, version)`, or the registered code has another shape than the run started with. Pure, so a read of
 * stranded runs can use the same test as the runner.
 */
export declare function codeOf<Def extends {
    readonly shapeHash: string;
}>(run: RunCode, registered: ReadonlyMap<string, Def>): Def | JournalError;
/** A stranded run's job is dead at once: retrying it before the code is back would fail the same way. */
export declare const isStrandedError: (reason: unknown) => boolean;
/** The worker owns the durable failure outcome; preserve the pinned identity and operator diagnostic as data. */
export declare function strandedFailure(run: RunCode, error: JournalError): WorkflowStranded;
export {};
//# sourceMappingURL=stranded.d.ts.map