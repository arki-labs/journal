/**
 * The words of `dot explain --as journal-flow`'s graph, one `as const` list each: the types in
 * `projection.ts` and the schema in `journal-flow-schema.ts` both read them. No Zod here, so the
 * public `./projection` entry stays free of Zod types.
 */
/** The edge kinds of the graph: `from` is the subject, `to` the object. */
export declare const JOURNAL_FLOW_EDGE_KINDS: readonly ['folds', 'projects', 'reacts', 'owned-by'];
/** When a consumer of an event runs: inside the write's transaction, or after it commits. */
export declare const JOURNAL_FLOW_TIMINGS: readonly ['same-transaction', 'after-commit'];
/** How often an after-commit consumer sees an event. */
export declare const JOURNAL_FLOW_DELIVERIES: readonly ['exactly-once', 'at-least-once', 'at-most-once'];
//# sourceMappingURL=journal-flow-kinds.d.ts.map