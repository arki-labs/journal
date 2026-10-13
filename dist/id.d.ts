export declare const eventId: () => `evt_${string}`;
export declare const jobId: () => `job_${string}`;
export declare const commandId: () => `cmd_${string}`;
export declare const correlationId: () => `cor_${string}`;
export declare const leaseToken: () => string;
declare const NAME_KINDS: {
    readonly 'entity kind': 64;
    readonly 'event type': 128;
    readonly 'effect name': 128;
};
/**
 * Throws unless `name` fits the `varchar` column the journal stores it in: non-empty,
 * well-formed UTF-16 (a lone surrogate would be stored as U+FFFD and alias another name),
 * and at most the column length in code points. Hermes-safe: no `isWellFormed`, no lookbehind.
 */
export declare function assertStoredName(what: keyof typeof NAME_KINDS, name: string): void;
export {};
//# sourceMappingURL=id.d.ts.map