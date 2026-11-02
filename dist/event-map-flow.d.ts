/**
 * Which way data moves along an edge. The graph reads subject, verb, object (`entity folds event`), but a
 * picture shows flow: the command writes the event, the event feeds the entity, the workflow runs the command.
 * One table says which edge kinds flow from their object to their subject; the Mermaid view and the console
 * page both read it through `flowOf`, so they cannot draw an arrow differently.
 */
import type { EventMapEdge, EventMapEdgeKind } from './projection.js';
/** `true` when data flows from the edge's object (`to`) to its subject (`from`). */
export declare const FLOWS_FROM_OBJECT: Readonly<Record<EventMapEdgeKind, boolean>>;
/** The two ends of an edge in the direction data flows: `source` first, `target` last. Ids, as the edge holds them. */
export declare function flowOf(edge: Pick<EventMapEdge, 'kind' | 'from' | 'to'>): {
    readonly source: string;
    readonly target: string;
};
//# sourceMappingURL=event-map-flow.d.ts.map