/** Marks an effect definition the workflow runner built, so the worker gives it `OwnedEffectContext`. */
export const journalOwnedEffect = Symbol('journal.ownedEffect');
/** The key of the unwatched runner on the context of a `journalOwnedEffect`. */
export const unwatchedRun = Symbol('journal.unwatchedRun');
//# sourceMappingURL=internal-context.js.map