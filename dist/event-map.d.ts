import type { EventMapDocument, EventMapProblem, EventMapScanEntry } from './projection.js';
import { projectGraph } from './projection.js';
export { eventMapPage as consolePage } from './event-map-page.js';
export { render } from './projection.js';
/** What the scan found: one entry per procedure file, and the files or imports it could not read. */
export type EventMapScan = {
    readonly entries: EventMapScanEntry[];
    readonly problems: EventMapProblem[];
};
/**
 * Scan the procedure files under `root` (an absolute folder). Files are found by the `entrypoints` folder
 * convention; the result is sorted by file, so the same app gives the same scan on every machine.
 */
export declare function scanEntrypoints(options: {
    readonly root: string;
}): Promise<EventMapScan>;
type ManifestLike = Parameters<typeof projectGraph>[0];
/**
 * The module Dot loads for `dot explain --as event-map`: the manifest's graph plus the scan of the
 * entrypoint root, which is resolved against `cwd` (the folder `dot` runs in, by default).
 */
export declare function project(manifest: ManifestLike, cwd?: string): Promise<EventMapDocument>;
/** The result of `checkEventMapFile`. A `stale` or `missing` file carries a line diff for the test report. */
export type EventMapFileCheck = {
    readonly state: 'fresh';
} | {
    readonly state: 'written';
} | {
    readonly state: 'stale' | 'missing';
    readonly diff: string;
};
/**
 * Keep a Mermaid file in an app's docs fresh. In a test, call it with the file and `eventMapMermaid(document)`
 * and expect `{ state: 'fresh' }`; a stale file fails the test and the report shows the diff. To regenerate,
 * run the test with `update: true` (apps wire it to an env var, e.g. `EVENT_MAP_UPDATE=1 bun run test`); the file is written
 * and `{ state: 'written' }` comes back, which also fails an expectation of `fresh`, so an update never passes quietly in CI.
 */
export declare function checkEventMapFile(options: {
    readonly file: string;
    readonly mermaid: string;
    readonly update?: boolean;
}): Promise<EventMapFileCheck>;
//# sourceMappingURL=event-map.d.ts.map