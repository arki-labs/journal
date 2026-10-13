/**
 * Around-hooks: the one way to extend a command run or an effect run from the
 * outside. A hook receives the context and `next`, and runs inside the same
 * transaction (commands) or lease (effects). The rules, all enforced here:
 * `next` exactly once, or throw before it to stop; a rejection of `next` is the
 * hook's rejection too; the context is frozen; hooks run in registration order,
 * the first one outermost; registration is frozen once the journal has done work.
 * Leaf file: may import `errors` only.
 */
import { JournalError } from './errors.js';
export function createHookPoint(what) {
    const hooks = [];
    let frozen = false;
    const point = {
        around(hook) {
            if (frozen) {
                throw new JournalError('BAD_DEFINITION', 'hook', what, `journal: ${what} hooks are frozen once the journal has run a command, a drain or a worker; register hooks at boot, before any work`);
            }
            hooks.push(hook);
        },
    };
    /** From now on, `around` throws. Called by the first `run` or `drain`. */
    const freeze = () => {
        frozen = true;
    };
    /** Run `work` inside every registered hook. The result is the work's own; no hook can change it. */
    const run = async (ctx, work) => {
        if (hooks.length === 0)
            return work();
        const frozenCtx = Object.freeze(ctx);
        let result;
        const layer = async (index) => {
            const hook = hooks[index];
            if (hook === undefined) {
                result = { value: await work() };
                return;
            }
            let calls = 0;
            let failure;
            const next = async () => {
                calls += 1;
                if (calls > 1)
                    throw new Error(`journal: a ${what} hook called next twice; next runs the ${what} and may run once`);
                try {
                    await layer(index + 1);
                }
                catch (error) {
                    failure = { error };
                    throw error;
                }
            };
            await hook(frozenCtx, next);
            // A hook that swallowed the failure would turn a rolled-back command into a success for the caller.
            if (failure !== undefined)
                throw failure.error;
            if (calls === 0) {
                throw new Error(`journal: a ${what} hook returned without calling next; call next to run the ${what}, or throw to stop it`);
            }
        };
        await layer(0);
        if (result === undefined)
            throw new Error(`journal: the ${what} did not run`);
        return result.value;
    };
    return { point, freeze, run };
}
//# sourceMappingURL=hooks.js.map