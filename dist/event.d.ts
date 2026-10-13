import type { z } from 'zod';
import type { EventDef, EventOptions } from './types.js';
/**
 * Declare an event. Calling the result validates the data and returns a pending event.
 * `opts.erased` gives the event's erased form for `forget`; see the README, Erasure.
 * `opts.upcasters` lifts data stored under older schemas; see the README, Changing events later.
 */
export declare function defineEvent<T extends string, S extends z.ZodType, const U extends readonly z.ZodType[] = readonly []>(type: T, schema: S, opts?: EventOptions<S, U>): EventDef<T, S>;
//# sourceMappingURL=event.d.ts.map