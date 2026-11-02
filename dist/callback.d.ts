/** Callback exceptions are defects; transaction-driver failures belong to the transaction owner. */
import { UnexpectedDefect } from '@arki/failure';
export declare function callbackDefect(cause: unknown): ReturnType<typeof UnexpectedDefect>;
//# sourceMappingURL=callback.d.ts.map