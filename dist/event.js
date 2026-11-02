import { isSchemaFailure } from '@arki/failure';
import { parse } from '@arki/schema';
import { assertStoredName } from './id.js';
/**
 * Declare an event. `schema` is any Standard Schema. Calling the result validates the data
 * synchronously and returns a pending event or a canonical schema failure. Writes, replay and upcasters parse sync too.
 * `opts.erased` gives the event's erased form for `forget`; see the README, Erasure.
 * `opts.upcasters` lifts data stored under older schemas; see the README, Changing events later.
 */
export function defineEvent(type, schema, opts) {
    assertStoredName('event type', type);
    const upcasters = opts?.upcasters ?? [];
    const make = (data) => {
        const parsed = parse(schema, data);
        return isSchemaFailure(parsed) ? parsed : { type, data: parsed };
    };
    return Object.assign(make, {
        type,
        schema,
        version: upcasters.length + 1,
        upcasters,
        ...(opts?.erased === undefined ? {} : { erased: opts.erased }),
    });
}
//# sourceMappingURL=event.js.map