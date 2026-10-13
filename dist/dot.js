import { DotPluginError, plugin, service } from '@arki/dot/plugin';
import { debugWorker } from './debug.js';
import { JournalError } from './errors.js';
import { bindEffect, bindTap } from './handlers.js';
export const JOURNAL_ACTION_META_SCHEMA = '@arki/journal/action-meta@1';
export const JOURNAL_PLUGIN_ERROR_CODES = { badSlice: 'JOURNAL_PLUGIN_E001' };
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
 * Declare a feature's projections and effects as a boot-time slice
 * (`defineFeature(..., { use: [journalHandlers({ projections, effects })] })`).
 * The payload lands under `journal` in the feature's slice token, where
 * `journal({ j, tables, features })` collects it.
 *
 * An effect with needs (`j.effect(name, entity, { mailer: need<Mailer>() }, on)`) gets
 * them from the booted services of this feature, by name. The feature must declare
 * each one in its own `needs`: the slice's `resolve` does not type-check otherwise.
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
        // The kernel hands the feature's services over untyped, so they are read by name here.
        resolve: (services) => ({
            projections,
            effects: effects.map(effect => bindEffect(effect, isServices(services) ? services : {})),
            taps: taps.map(tap => bindTap(tap, isServices(services) ? services : {})),
        }),
    };
}
const isServices = (value) => typeof value === 'object' && value !== null;
const isHandler = (value) => typeof value === 'object' &&
    value !== null &&
    'name' in value &&
    typeof value.name === 'string' &&
    'run' in value &&
    typeof value.run === 'function';
/** The kernel hands services over untyped, so the slice shape is checked here, once, at boot. */
function isJournalHandlers(value) {
    return (typeof value === 'object' &&
        value !== null &&
        'projections' in value &&
        Array.isArray(value.projections) &&
        value.projections.every(item => isHandler(item)) &&
        'effects' in value &&
        Array.isArray(value.effects) &&
        value.effects.every(item => isHandler(item)) &&
        'taps' in value &&
        Array.isArray(value.taps) &&
        value.taps.every(item => isHandler(item)));
}
/**
 * Throws when another handler of this kind already has the name, and names the
 * feature tokens that hold the two. `j.compose` makes the same check, but it gets
 * one flat list and cannot say which feature a handler came from.
 */
function claimName(kind, owners, name, feature) {
    const owner = owners.get(name);
    if (owner !== undefined) {
        const where = owner === feature ? `feature "${feature}", twice` : `features "${owner}" and "${feature}"`;
        throw new JournalError('BAD_DEFINITION', kind, name, `journal: duplicate ${kind} name "${name}" (${where})`);
    }
    owners.set(name, feature);
}
/**
 * Read each feature's `journal` slice from the booted services, in feature order.
 * Refuses a projection name or an effect name that is listed twice.
 */
function collectHandlers(features, services) {
    const projections = [];
    const effects = [];
    const taps = [];
    const projectionOwners = new Map();
    const effectOwners = new Map();
    const tapOwners = new Map();
    for (const feature of features) {
        const slices = services[feature.key];
        const slice = typeof slices === 'object' && slices !== null && 'journal' in slices ? slices.journal : undefined;
        if (slice === undefined) {
            debugWorker.debug('[journal] feature "{featureKey}" did not contribute a journal slice', {
                featureKey: feature.key,
            });
            continue;
        }
        if (!isJournalHandlers(slice)) {
            throw new DotPluginError({
                code: JOURNAL_PLUGIN_ERROR_CODES.badSlice,
                message: `[journal] feature token "${feature.key}" holds a \`journal\` slice that is not lists of projections, effects and taps.`,
                remediation: 'Declare the slice with journalHandlers({ projections, effects, taps }) from @arki/journal/dot.',
                docsUrl: 'https://github.com/arki-labs/arki/blob/HEAD/packages/journal/docs/agent-guide.md#dot-boot-errors',
            });
        }
        for (const { name } of slice.projections)
            claimName('projection', projectionOwners, name, feature.key);
        for (const { name } of slice.effects)
            claimName('effect', effectOwners, name, feature.key);
        for (const { name } of slice.taps)
            claimName('tap', tapOwners, name, feature.key);
        projections.push(...slice.projections);
        effects.push(...slice.effects);
        taps.push(...slice.taps);
    }
    return { projections, effects, taps };
}
export function journal(options) {
    let composed;
    let worker;
    // Each feature token is a need, so the kernel boots the features first and refuses a missing one.
    const featureNeeds = 'features' in options ? options.features.map(feature => [feature.key, feature]) : [];
    const needs = {
        ...Object.fromEntries(featureNeeds),
        db: service(),
    };
    return plugin({
        name: 'journal',
        needs,
        configure(ctx) {
            ctx.registerService('journal', 'custom');
            ctx.declareProvides('journal');
        },
        boot(services) {
            composed =
                'journal' in options
                    ? options.journal
                    : options.j.compose({ tables: options.tables, ...collectHandlers(options.features, services) });
            return { journal: composed };
        },
        async start({ db }) {
            if (options.worker === false)
                return;
            worker = composed?.worker(db, {
                pollMs: options.pollMs,
                batchSize: options.batchSize,
                leaseSeconds: options.leaseSeconds,
                listen: options.listen,
                taps: options.taps,
            });
            await worker?.start();
        },
        async stop() {
            await worker?.stop();
            worker = undefined;
        },
    });
}
//# sourceMappingURL=dot.js.map