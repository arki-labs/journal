import { JournalError } from '../errors.js';
/** The name of a workflow's own limit is this prefix and the workflow name. A `j.limit` name may not start with it. */
export const WORKFLOW_LIMIT_PREFIX = 'workflow/';
/**
 * The bounds of limits: a `j.limit` name is at most 128 characters, a workflow lists at most 2 shared limits (as
 * trigger.dev does), and `WorkflowBusy.running` names at most 100 runs. When a slot frees, at most `promoteTries`
 * queued runs are checked, oldest first, so a run end or an operator verb does a bounded amount of work.
 */
export const LIMIT_BOUNDS = { name: 128, shared: 2, runningShown: 100, promoteTries: 50 };
/** How long a `perKey` override of one key lasts: 7 days unless `ttl` says otherwise, and at most 30 days. */
export const LIMIT_KEY_TTL = { default: '7d', max: '30d' };
const isPositiveInt = (value) => value === undefined || (Number.isInteger(value) && value > 0);
/** `j.limit`: checks the limit and returns it frozen, so the values every workflow sees are the ones checked here. */
export function defineLimit(def) {
    const refuse = (detail) => {
        throw new JournalError('BAD_DEFINITION', 'limit', def.name, `limit "${def.name}": ${detail}`);
    };
    if (def.name === '' || def.name.length > LIMIT_BOUNDS.name) {
        refuse(`a limit name is 1 to ${LIMIT_BOUNDS.name} characters`);
    }
    if (def.name.startsWith(WORKFLOW_LIMIT_PREFIX)) {
        refuse(`"${WORKFLOW_LIMIT_PREFIX}" names a workflow's own limit; give a shared limit another name`);
    }
    if (def.total === undefined && def.perKey === undefined)
        refuse('a limit needs total, perKey or both');
    if (!isPositiveInt(def.total))
        refuse(`total must be a positive whole number, got ${def.total}`);
    if (!isPositiveInt(def.perKey))
        refuse(`perKey must be a positive whole number, got ${def.perKey}`);
    return Object.freeze({ name: def.name, total: def.total, perKey: def.perKey });
}
/** The name of the limit a workflow's own `concurrency.limit` and `total` form. */
export const workflowLimitName = (workflow) => `${WORKFLOW_LIMIT_PREFIX}${workflow}`;
//# sourceMappingURL=limit-types.js.map