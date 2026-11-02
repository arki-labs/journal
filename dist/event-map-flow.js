/** `true` when data flows from the edge's object (`to`) to its subject (`from`). */
export const FLOWS_FROM_OBJECT = {
    writes: false,
    folds: true,
    projects: true,
    reacts: true,
    'waits-for': true,
    runs: false,
    calls: false,
    'owned-by': false,
};
/** The two ends of an edge in the direction data flows: `source` first, `target` last. Ids, as the edge holds them. */
export function flowOf(edge) {
    return FLOWS_FROM_OBJECT[edge.kind] ? { source: edge.to, target: edge.from } : { source: edge.from, target: edge.to };
}
//# sourceMappingURL=event-map-flow.js.map