/**
 * The event log conformance suite. `eventLogContract` returns plain `{ name, run }` cases that any
 * runner (or none) can execute: it never imports a test framework. A case that does not apply to
 * the log under test (no global order, no erase, no transactions) throws {@link ContractSkip}
 * with the reason; the runner reports it as skipped.
 * Imports only `event-log`, `errors`, `storage` and leaf files.
 */
import type { EventLog } from './event-log.js';
import type { DbHandle } from './types.js';
/** Thrown by a case that does not apply to this log. `message` is the reason. */
export declare class ContractSkip extends Error {
    readonly name = "ContractSkip";
}
export type ContractCase = {
    readonly name: string;
    run(): Promise<void>;
};
/**
 * A fresh, empty log for one case. `db` is the app database the log joins; a log that joins
 * transactions needs it, and the transaction cases open theirs on it.
 */
export type MakeLog = () => Promise<{
    readonly log: EventLog;
    readonly db?: DbHandle;
}>;
export declare function eventLogContract(makeLog: MakeLog): readonly ContractCase[];
//# sourceMappingURL=event-log-contract.d.ts.map