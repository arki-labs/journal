import { isFailure } from '@arki/failure';
/**
 * `isFailure` for a value whose type is still generic, where `isFailure` cannot check that
 * it is not a promise. Narrows to the failures in `Value`. Not for `unknown`: it has none.
 */
export const isReturnedFailure = (value) => isFailure(value);
/**
 * For one transaction (or savepoint) whose callback resolves with a `T`:
 * `source.transaction(async tx => settle(value)).catch(recover)`.
 * - `settle(value)`, inside the callback, returns `value`; when `value` is a failure
 *   (`@arki/failure`) it throws instead, so the transaction rolls back.
 * - `recover`, on the transaction's promise, turns that throw back into the failure,
 *   the same instance. Any other error passes through.
 */
export function rollbackOnFailure() {
    // One signal per transaction, so a nested one never catches the signal of the one around it.
    const signal = new Error('journal: a returned failure is rolling back its transaction');
    const held = {};
    return {
        settle: (value) => {
            if (!isReturnedFailure(value))
                return value;
            held.failure = { value };
            throw signal;
        },
        recover: (error) => {
            if (error === signal && held.failure !== undefined)
                return held.failure.value;
            throw error;
        },
    };
}
//# sourceMappingURL=rollback.js.map