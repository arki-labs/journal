import type { StandardSchemaV1 } from '@arki/schema';
import type { EventDef, EventOptions } from './types.js';
/**
 * Declare an event. `schema` is any Standard Schema. Calling the result validates the data
 * synchronously and returns a pending event or a canonical schema failure. Writes, replay and upcasters parse sync too.
 * `opts.erased` gives the event's erased form for `forget`; see the README, Erasure.
 * `opts.upcasters` lifts data stored under older schemas; see the README, Changing events later.
 */
export declare function defineEvent<T extends string, S extends StandardSchemaV1, const U extends readonly StandardSchemaV1[] = readonly []>(type: T, schema: S, opts?: EventOptions<S, U>): EventDef<T, S>;
//# sourceMappingURL=event.d.ts.map