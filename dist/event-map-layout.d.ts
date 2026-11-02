import type { EventMapDocument, EventMapEdge, EventMapNode } from './projection.js';
export declare const COLUMN_WIDTH = 215;
export declare const NODE_WIDTH = 170;
export declare const NODE_HEIGHT = 46;
export declare const ROW_GAP = 14;
export declare const MARGIN_LEFT = 16;
export declare const MARGIN_TOP = 40;
/** The column titles, left to right. */
export declare const COLUMN_TITLES: readonly ['Entrypoints', 'Commands', 'Events', 'Reactions, workflows'];
export type PlacedNode = {
    readonly node: EventMapNode;
    readonly column: number;
    readonly x: number;
    readonly y: number;
    /** True in a feature's view when the node belongs to another feature and is drawn for context only. */
    readonly context: boolean;
};
/** `source` and `target` are node ids in the direction data flows; the curve ends at `target`. */
export type PlacedEdge = {
    readonly edge: EventMapEdge;
    readonly index: number;
    readonly source: string;
    readonly target: string;
    readonly path: string;
};
export type Layout = {
    readonly width: number;
    readonly height: number;
    readonly nodes: readonly PlacedNode[];
    readonly edges: readonly PlacedEdge[];
};
/** The feature that owns a node: the `owned-by` edge, or an entrypoint's own `feature`. */
export declare function ownersOf(document: EventMapDocument): ReadonlyMap<string, string>;
/** The feature names with something to show, sorted. */
export declare function featuresOf(document: EventMapDocument): string[];
/**
 * Lay out the graph. With `feature`, only that feature's nodes and the nodes they share an edge with are placed;
 * the neighbours are marked `context`. Rows are ordered by the average row of the neighbours in the column to the
 * left, which keeps most edges from crossing; ties break on the name.
 */
export declare function layoutEventMap(document: EventMapDocument, feature?: string): Layout;
//# sourceMappingURL=event-map-layout.d.ts.map