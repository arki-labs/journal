import type { EventMapDocument } from './projection.js';
/**
 * The event map as Mermaid `flowchart LR` text, ending in a newline. Arrows follow the data: command to event,
 * event to its consumers, workflow to the commands it runs. An after-commit link is dotted, a same-transaction
 * or direct link is solid. `owned-by` edges and feature nodes are left out; the text view names owners.
 */
export declare function eventMapMermaid(document: Pick<EventMapDocument, 'nodes' | 'edges'>): string;
//# sourceMappingURL=event-map-mermaid.d.ts.map