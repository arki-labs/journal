import type { Projection } from './types.js';
import type { EVENT_MAP_DELIVERIES, EVENT_MAP_EDGE_KINDS, EVENT_MAP_NODE_KINDS, EVENT_MAP_TIMINGS } from './event-map-kinds.js';
export { EVENT_MAP_DELIVERIES, EVENT_MAP_EDGE_KINDS, EVENT_MAP_NODE_KINDS, EVENT_MAP_TIMINGS, } from './event-map-kinds.js';
export { eventMapMermaid } from './event-map-mermaid.js';
export type EventMapTiming = (typeof EVENT_MAP_TIMINGS)[number];
export type EventMapDelivery = (typeof EVENT_MAP_DELIVERIES)[number];
export type EventMapNodeKind = (typeof EVENT_MAP_NODE_KINDS)[number];
export type EventMapEdgeKind = (typeof EVENT_MAP_EDGE_KINDS)[number];
/** An effect's retry policy: the journal's default, or its own `schedule.retry`. `maxRetries` is `null` for no limit. */
export type EventMapRetry = {
    readonly policy: 'default' | 'custom';
    readonly maxRetries: number | null;
};
/** One node. `id` is `<kind>:<name>` (`effect:send-receipt`, `workflow:refund@1`). */
export type EventMapNode = {
    readonly id: string;
    readonly kind: 'event';
    readonly name: string;
} | {
    readonly id: string;
    readonly kind: 'entity';
    readonly name: string;
    readonly table: string;
} | {
    readonly id: string;
    readonly kind: 'projection';
    readonly name: string;
    readonly lane: Projection['lane'];
} | {
    readonly id: string;
    readonly kind: 'effect';
    readonly name: string;
    /** The deps the effect picked from its feature (`needsOf((_: Deps) => ['mailer'])`). */
    readonly deps: string[];
    readonly retry: EventMapRetry;
} | {
    readonly id: string;
    readonly kind: 'tap';
    readonly name: string;
    readonly deps: string[];
} | {
    readonly id: string;
    readonly kind: 'workflow';
    readonly name: string;
    readonly version: number;
    readonly deps: string[];
    readonly signals: string[];
    /**
     * The `.step` nodes, by name. A step body may call `ctx.run`, and the map cannot see inside it, so no
     * edge is drawn for such a call. A command that must show on the map belongs in a `.command` node.
     */
    readonly opaqueSteps: string[];
} | {
    readonly id: string;
    readonly kind: 'feature';
    readonly name: string;
}
/** A `j.command`. `name` is the command's name; the events it writes are its `writes` edges. */
 | {
    readonly id: string;
    readonly kind: 'command';
    readonly name: string;
}
/** One procedure file the scan read. `name` and `file` are the path under the scan root; `feature` owns the file. */
 | {
    readonly id: string;
    readonly kind: 'entrypoint';
    readonly name: string;
    readonly feature: string;
    readonly file: string;
};
/**
 * One edge, subject to object. `timing` and `delivery` are set on edges to an event only. On a workflow edge,
 * `node` is the workflow node it comes from (a branch node is `parallel.branch.node`), `label` is the name of an
 * event wait's source, and `undo` is `true` when the command is the node's `undo`.
 */
export type EventMapEdge = {
    readonly kind: EventMapEdgeKind;
    readonly from: string;
    readonly to: string;
    readonly timing?: EventMapTiming;
    readonly delivery?: EventMapDelivery;
    readonly node?: string;
    readonly label?: string;
    readonly undo?: true;
};
/** The graph `journal({ j })` derives from the features' declarations. */
/** Plain arrays, as the manifest's JSON types them: the graph travels in a projection's `meta`. */
export type EventMapGraph = {
    readonly nodes: EventMapNode[];
    readonly edges: EventMapEdge[];
};
/** What `journal({ j })` registers in the manifest: the graph, and the folder the entrypoint scan reads. */
export type EventMapMeta = EventMapGraph & {
    readonly entrypointRoot: string;
};
/** A procedure file the scan could not read, and why. The map is drawn without it. */
export type EventMapProblem = {
    readonly file: string;
    readonly reason: string;
};
/** `dot explain --as event-map --json`: the whole app's graph. */
export type EventMapDocument = EventMapGraph & {
    readonly format: 'event-map';
    readonly problems: EventMapProblem[];
};
/** One procedure file with the journal commands it imports. `file` is the path under the scan root. */
export type EventMapScanEntry = {
    readonly feature: string;
    readonly file: string;
    readonly commands: readonly {
        readonly name: string;
        readonly writes: readonly string[];
    }[];
};
/** The key that makes an edge unique: two edges of one kind between the same nodes differ by node, label or undo. */
export declare const edgeKey: (edge: EventMapEdge) => string;
type ManifestLike = {
    readonly projections: readonly {
        readonly format: string;
        readonly module: string;
        readonly meta?: unknown;
    }[];
};
/**
 * The app's graph, merged from every journal the app mounts (a renamed second journal adds its own),
 * without the entrypoint scan. A node is listed once; an edge once. `entrypointRoot` is the folder
 * the scan reads: the first journal's.
 */
export declare function projectGraph(manifest: ManifestLike): {
    readonly document: EventMapDocument;
    readonly entrypointRoot: string | undefined;
};
/**
 * The graph with a scan's findings added: an `entrypoint` node per file, a `command` node per command it
 * imports (once), the command's `writes` edges, and an `entrypoint calls command` edge. A command that
 * is imported and never called still gets its edge: the scan reads imports, not calls.
 */
export declare function withEntrypoints(document: EventMapDocument, scanned: readonly EventMapScanEntry[], problems: readonly EventMapProblem[]): EventMapDocument;
/**
 * `dot explain --as event-map`: the graph per event, each writer and consumer with its timing, owner, deps
 * and retry; then each workflow's nodes, each entrypoint's commands, and the procedure files the scan could not read.
 */
export declare function render(document: unknown): string;
//# sourceMappingURL=projection.d.ts.map