import { driven, driver, sliceOf } from '@arki/dot/feature';
import { DotPluginError, plugin, service } from '@arki/dot/plugin';
import { debugWorker } from './debug.js';
import { JournalError } from './errors.js';
import { givenServices } from './handlers.js';
export const JOURNAL_ACTION_META_SCHEMA = '@arki/journal/action-meta@1';
export const JOURNAL_PLUGIN_ERROR_CODES = { badSlice: 'ARKI_JOURNAL_PLUGIN_E001' };
function effectAction(effect) {
    return {
        id: `${effect.name}.run`,
        binding: 'journal',
        direction: 'in',
        address: effect.name,
        metaSchema: JOURNAL_ACTION_META_SCHEMA,
        meta: { entities: effect.entities.map(entity => entity.kind), events: [...effect.types] },
    };
}
/**
 * Declare a feature's projections, effects and taps
 * (`feature('orders', { use: [journalHandlers({ projections, effects })] })`).
 * `journal({ j, tables })` reads them from the feature value and composes the journal.
 *
 * An effect with needs (`j.effect(name, entity, { mailer: need<Mailer>() }, on)`) gets
 * them from the booted services of this feature, by name, when `journalWorker()` runs it.
 * The feature must declare each one in its own `needs`: the slice's `resolve` does not
 * type-check otherwise, and throws at the feature's boot when the types were bypassed.
 * Two features may use the same need name for two different services.
 *
 * Actions: one per effect. Projections add none: they run inside the write, not
 * at an app boundary.
 */
export function journalHandlers(handlers) {
    const { projections = [], effects = [], taps = [] } = handlers;
    return {
        key: 'journal',
        actions: effects.map(effect => effectAction(effect)),
        handlers: { projections, effects, taps },
        // The kernel hands the feature's services over untyped, so they are read by name here.
        resolve: (services) => {
            const given = isServices(services) ? services : {};
            // Checked at the feature's boot, so a missing service never waits for the first job.
            for (const effect of effects)
                givenServices('effect', effect, given);
            for (const tap of taps)
                givenServices('tap', tap, given);
            return { services: given };
        },
    };
}
const isServices = (value) => typeof value === 'object' && value !== null;
const isHandler = (value) => typeof value === 'object' &&
    value !== null &&
    'name' in value &&
    typeof value.name === 'string' &&
    'run' in value &&
    typeof value.run === 'function';
const isHandlerList = (value) => Array.isArray(value) && value.every(item => isHandler(item));
/** A slice's static `handlers` are read untyped from the feature, so their shape is checked here. */
function isJournalDeclarations(value) {
    return (typeof value === 'object' &&
        value !== null &&
        'projections' in value &&
        isHandlerList(value.projections) &&
        'effects' in value &&
        isHandlerList(value.effects) &&
        'taps' in value &&
        isHandlerList(value.taps));
}
function badSlice(feature, what) {
    return new DotPluginError({
        code: JOURNAL_PLUGIN_ERROR_CODES.badSlice,
        message: `[journal] feature "${feature.name}" has a \`journal\` slice whose ${what}.`,
        remediation: 'Declare the slice with journalHandlers({ projections, effects, taps }) from @arki/journal/dot.',
        docsUrl: 'https://github.com/arki-labs/arki/blob/HEAD/packages/journal/docs/agent-guide.md#dot-boot-errors',
    });
}
/**
 * Throws when another handler of this kind already has the name, and names the
 * features that hold the two. `j.compose` makes the same check, but it gets
 * one flat list and cannot say which feature a handler came from.
 */
function claimName(kind, owners, name, feature) {
    const owner = owners.get(`${kind}:${name}`);
    if (owner !== undefined) {
        const where = owner === feature ? `feature "${feature.name}", twice` : `features "${owner.name}" and "${feature.name}"`;
        throw new JournalError('BAD_DEFINITION', kind, name, `journal: duplicate ${kind} name "${name}" (${where})`);
    }
    owners.set(`${kind}:${name}`, feature);
}
/**
 * Read each feature's `journal` slice declarations, in feature order. Refuses a name
 * that is listed twice. `owners` maps `effect:<name>` and `tap:<name>` (and
 * `projection:<name>`) to the feature that lists it.
 */
function readDeclarations(features) {
    const projections = [];
    const effects = [];
    const taps = [];
    const owners = new Map();
    for (const feature of features) {
        const slice = feature.use.find(item => item.key === 'journal');
        if (slice === undefined) {
            debugWorker.debug('[journal] feature "{featureName}" did not contribute a journal slice', {
                featureName: feature.name,
            });
            continue;
        }
        const declared = 'handlers' in slice ? slice.handlers : undefined;
        if (!isJournalDeclarations(declared))
            throw badSlice(feature, 'handlers are not lists of projections, effects and taps');
        for (const { name } of declared.projections)
            claimName('projection', owners, name, feature);
        for (const { name } of declared.effects)
            claimName('effect', owners, name, feature);
        for (const { name } of declared.taps)
            claimName('tap', owners, name, feature);
        projections.push(...declared.projections);
        effects.push(...declared.effects);
        taps.push(...declared.taps);
    }
    return { declarations: { projections, effects, taps }, owners };
}
function journalPlugin(build) {
    const needs = {
        db: service(),
    };
    return plugin({
        name: 'journal',
        needs,
        configure(ctx) {
            ctx.registerService('journal', 'custom');
            ctx.declareProvides('journal');
        },
        boot: () => ({ journal: build() }),
    });
}
export function journal(options) {
    if ('journal' in options) {
        const composed = options.journal;
        return journalPlugin(() => composed);
    }
    const { j, tables } = options;
    return driven(features => journalPlugin(() => 
    // `'worker'`: the effects' services exist only once the features boot, after this journal.
    j.compose({ tables, ...readDeclarations(features).declarations, services: 'worker' })));
}
/** The services a feature's `journal` slice published at its boot. */
function sliceServices(ctx, feature) {
    const payload = sliceOf(ctx, feature).journal;
    if (typeof payload !== 'object' || payload === null || !('services' in payload) || !isServices(payload.services))
        throw badSlice(feature, 'boot payload holds no services; it was not made by journalHandlers');
    return payload.services;
}
/**
 * The driving part, for `.serve()`: one worker between `start` and `stop`, for the
 * journal that `journal(...)` published. Each effect and tap of a feature gets the
 * services of that feature. A process that serves no worker still writes: its jobs
 * wait for a process that does.
 */
export function journalWorker(options = {}) {
    return driver(features => {
        let worker;
        return plugin({
            name: 'journal-worker',
            needs: { db: service(), journal: service() },
            boot(ctx) {
                const { owners } = readDeclarations(features);
                const byFeature = new Map();
                // Every owner listed a `journal` slice, so each has a slice record.
                for (const feature of new Set(owners.values()))
                    byFeature.set(feature, sliceServices(ctx, feature));
                const services = ({ kind, name }) => {
                    const owner = owners.get(`${kind}:${name}`);
                    return (owner === undefined ? undefined : byFeature.get(owner)) ?? {};
                };
                // Built at boot, not at start: a missing service fails the boot.
                worker = ctx.journal.worker(ctx.db, { ...options, services });
            },
            async start() {
                await worker?.start();
            },
            async stop() {
                await worker?.stop();
            },
        });
    });
}
//# sourceMappingURL=dot.js.map