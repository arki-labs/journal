/** The limits on the run fields: `scope` length, number of `tags`, length of one tag, and `metadata` as JSON bytes. */
export const RUN_FIELD_LIMITS = { scope: 256, tags: 10, tag: 128, metadataBytes: 262_144 };
/** The most items one `def.startBatch` takes, and the most run ids `journal.workflows.batch` lists. */
export const BATCH_LIMIT = 1000;
/**
 * The bounds of a run's overrides: `maxAttempts` at most 100 tries of a step, and `timeout` at most what a timer can
 * wait (`setTimeout` fires at once past 2^31 - 1 ms).
 */
export const RUN_OVERRIDE_LIMITS = { maxAttempts: 100, timeoutMs: 2_147_483_647 };
/**
 * Why `change` cannot apply to `metadata`, or null when it can: `increment` needs a number (or nothing) at its key,
 * and `append` an array (or nothing). The size is checked after, on the changed metadata.
 */
export function metadataRefusal(metadata, change) {
    if (change.kind === 'increment') {
        const now = metadata[change.key];
        return now === undefined || typeof now === 'number' ? null : `metadata "${change.key}" is not a number`;
    }
    if (change.kind === 'append') {
        const now = metadata[change.key];
        return now === undefined || Array.isArray(now) ? null : `metadata "${change.key}" is not an array`;
    }
    return null;
}
/**
 * `metadata` after `change`. Pure: the `MetadataChanged` reducer and the command that checks the change both call it,
 * so a replay rebuilds what the command stored. The command refuses a change `metadataRefusal` names, so the fallbacks
 * below (0 for a value that is not a number, an empty array for one that is not an array) never meet a stored event.
 */
export function changedMetadata(metadata, change) {
    switch (change.kind) {
        case 'set': {
            return { ...metadata, ...change.patch };
        }
        case 'increment': {
            const now = metadata[change.key];
            return { ...metadata, [change.key]: (typeof now === 'number' ? now : 0) + change.by };
        }
        case 'append': {
            const now = metadata[change.key];
            return { ...metadata, [change.key]: [...(Array.isArray(now) ? now : []), change.value] };
        }
        case 'remove': {
            const { [change.key]: _removed, ...rest } = metadata;
            return rest;
        }
    }
}
/**
 * The tags `added` brings to a run that has `tags`: each one once, in the order given, without those it has. An empty
 * list means nothing changes.
 */
export const newTags = (tags, added) => [...new Set(added)].filter(tag => !tags.includes(tag));
//# sourceMappingURL=run-fields.js.map