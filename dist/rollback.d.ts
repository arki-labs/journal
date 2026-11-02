/**
 * A returned failure rolls its transaction back. Drizzle rolls back only when the
 * callback throws, so the failure leaves the transaction as a private signal and
 * comes back as the result right outside it. `write` uses it; command transactions use @arki/db ownership.
 * Leaf file: imports nothing from this package.
 */
import type { Failure } from '@arki/failure';
/**
 * `isFailure` for a value whose type is still generic, where `isFailure` cannot check that
 * it is not a promise. Narrows to the failures in `Value`. Not for `unknown`: it has none.
 */
export declare const isReturnedFailure: <Value>(value: Value) => value is Extract<Value, Failure>;
/**
 * For one transaction (or savepoint) whose callback resolves with a `T`:
 * `source.transaction(async tx => settle(value)).catch(recover)`.
 * - `settle(value)`, inside the callback, returns `value`; when `value` is a failure
 *   (`@arki/failure`) it throws instead, so the transaction rolls back.
 * - `recover`, on the transaction's promise, turns that throw back into the failure,
 *   the same instance. Any other error passes through.
 */
export declare function rollbackOnFailure<T>(): {
    settle: (value: T) => T;
    recover: (error: unknown) => T;
};
//# sourceMappingURL=rollback.d.ts.map