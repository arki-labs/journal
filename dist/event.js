import { assertStoredName } from './id.js';
/**
 * Declare an event. Calling the result validates the data and returns a pending event.
 * `opts.erased` gives the event's erased form for `forget`; see the README, Erasure.
 * `opts.upcasters` lifts data stored under older schemas; see the README, Changing events later.
 */
export function defineEvent(type, schema, opts) {
    assertStoredName('event type', type);
    const upcasters = opts?.upcasters ?? [];
    const make = (data) => ({ type, data: schema.parse(data) });
    return Object.assign(make, {
        type,
        schema,
        version: upcasters.length + 1,
        upcasters,
        ...(opts?.erased === undefined ? {} : { erased: opts.erased }),
    });
}
//# sourceMappingURL=event.js.map