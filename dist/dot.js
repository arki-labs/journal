import { getTableName } from 'drizzle-orm';
import { entrypoint, instanceOf, ownUnits, sliceOf } from '@arki/dot/feature';
import { DotUnitError, infra, service } from '@arki/dot/unit';
import { EVENT_MAP_DEFAULT_ENTRYPOINT_ROOT } from './event-map-kinds.js';
import { edgeKey } from './projection.js';
import { JOURNAL_ACTION_META_SCHEMA } from './action-meta.js';
import { debugWorker } from './debug.js';
import { JournalError } from './errors.js';
import { givenServices, need } from './handlers.js';
import { defaultEffectRetry } from './worker.js';
export { JOURNAL_ACTION_META_SCHEMA } from './action-meta.js';
export const JOURNAL_PLUGIN_ERROR_CODES = {
    /**
     * A feature supplied an invalid Journal contribution.
     * @fix Declare a feature's reactions with journalHandlers(core, { effects, taps, workflows }) in .usecases(...), and its projections with journalProjections(...) in .infra(...), both from @arki/journal/dot.
     * @verify bun run test -- src/dot-feature.test.ts
     */
    badSlice: 'ARKI_JOURNAL_PLUGIN_E001',
};
/**
 * A name made unique per instance of a feature (`send-on-request` -> `send-on-request#eu`).
 * A plain feature has no instance, so its names stay exactly as written: stored job rows keep resolving.
 */
const qualifyBy = (featureName) => (name) => {
    const instance = instanceOf(featureName);
    return instance === undefined ? name : `${name}#${instance}`;
};
function effectAction(effect, qualify = name => name) {
    const name = qualify(effect.name);
    return {
        id: `${name}.run`,
        binding: 'journal',
        direction: 'in',
        address: name,
        metaSchema: JOURNAL_ACTION_META_SCHEMA,
        meta: { entities: effect.entities.map(entity => entity.kind), events: [...effect.types] },
    };
}
/** A workflow's manifest action: `<name>@<version>.run`, with the signals its `waitFor` nodes wait for. */
function workflowAction(def) {
    return {
        id: `${def.name}@${def.version}.run`,
        binding: 'journal',
        direction: 'in',
        address: def.name,
        metaSchema: JOURNAL_ACTION_META_SCHEMA,
        meta: { entities: [], events: [], signals: signalsOf(def) },
    };
}
/** The signal names a workflow's `waitFor` nodes wait for, each once. */
function signalsOf(def) {
    const signals = new Set();
    for (const node of def.nodes)
        if (node.kind === 'waitFor')
            signals.add(node.signal);
    return [...signals];
}
/**
 * The needs record of an effect, tap or workflow in a Dot feature. `select` picks the keys of the
 * feature's usecase-level deps (its needs, never an `entrypointOnly` one; its private infra; its
 * domain services), and each one is typed from the feature. It replaces `need<T>()` in a Dot feature:
 * the type is written once, at the feature, and read here from the selector's parameter annotation.
 *
 * ```ts
 * // reactions/send-receipt.ts: `import type { Deps }` only, so there is no import cycle.
 * import type { Deps } from '../feature';
 * export const sendReceipt = j.effect('send-receipt', order, needsOf((_: Deps) => ['mailer']), {
 *   OrderPlaced: (event, { mailer }) => mailer.sendReceipt(event.entityId),
 * });
 * ```
 *
 * `needsOf` calls `select` once and never reads its argument; the feature's value is not needed, so a
 * reaction module and its feature module can import each other in either order. `D` comes from the
 * annotation, so callers write no type arguments. A key the feature lacks, or an `entrypointOnly`
 * one, is a compile error. The selection holds at runtime too: `journalHandlers` checks each key when
 * the feature boots and fails the boot naming it.
 */
export function needsOf(select) {
    // Erasure seam: the selector only carries the type `D`, and its parameter is never read, so there
    // is no value to pass. `undefined as never` satisfies the parameter type for any `D`.
    const keys = select(undefined);
    // Erasure seam: `Object.fromEntries` types its keys as `string`; they are exactly `keys`, and each
    // value is the empty phantom `need()` makes, which fits `Need<T>` for every `T`.
    return Object.fromEntries(keys.map(key => [key, need()]));
}
/**
 * A feature's reactions, for its `.usecases(...)`:
 *
 * ```ts
 * export const core = defineFeature('orders').needs({ … }).infra(mailer, journalProjections(placedCount));
 * const logic = core.usecases({}, journalHandlers(core, { effects: [sendReceipt] }));
 * ```
 *
 * Each effect, tap and workflow gets its needs from this feature, by name: a need (never an
 * `entrypointOnly` one), a private infra service or a domain service. Pick them with `needsOf((_: Deps) => […])`.
 * A missing one is a compile error here, naming it, and fails the feature's boot for callers that
 * skip the types. `journalWorker()` runs each handler with these services.
 *
 * Actions: one per effect (named after the feature's instance) and one per workflow
 * (`<name>@<version>.run`, its signals in the meta). A handler name may be listed by one feature
 * only: a second one fails the boot and names both features.
 */
export function journalHandlers(_core, handlers) {
    // `_core` is a type witness; the feature hands its own deps to `bind` when it boots.
    const effects = handlers.effects ?? [];
    const taps = handlers.taps ?? [];
    const workflows = handlers.workflows ?? [];
    return {
        kind: 'journal',
        key: 'journal',
        handlers: { projections: [], effects, taps, workflows },
        actionsOf: feature => [
            ...effects.map(effect => effectAction(effect, qualifyBy(feature))),
            ...workflows.map(def => workflowAction(def)),
        ],
        bind: bindServices(effects, taps, workflows),
    };
}
const isServices = (value) => typeof value === 'object' && value !== null;
/** The contribution's boot step: hand the feature's deps over, after checking each handler finds its own. */
function bindServices(effects, taps, workflows) {
    // The kernel hands the feature's deps over untyped, so they are read by name here.
    return deps => {
        const given = isServices(deps) ? deps : {};
        // Checked at the feature's boot, so a missing service never waits for the first job.
        for (const effect of effects)
            givenServices('effect', effect, given);
        for (const tap of taps)
            givenServices('tap', tap, given);
        for (const def of workflows)
            givenServices('effect', { name: `workflow.step of ${def.name}@${def.version}`, needs: def.needs }, given);
        return { services: given };
    };
}
/* ------------------------------------------------------------------ */
/* defineFeature descriptors                                           */
/* ------------------------------------------------------------------ */
/** Marks the infra unit `journalProjections(...)` makes, so the journal can find it among a feature's units. */
export const JOURNAL_PROJECTIONS_KIND = 'journal-projections';
/**
 * A `defineFeature` feature's projections, for its `.infra(...)`:
 * `defineFeature('orders').infra(store, journalProjections(customerStats))`.
 *
 * Projections run inside the write's transaction (or later, in the worker,
 * when async) and get only the transaction, so they need no services. The
 * unit shows in `dot explain` as `<feature>/journal-projections`.
 */
export function journalProjections(...projections) {
    return Object.assign(infra({ name: 'journal-projections', provides: {} }), {
        kind: JOURNAL_PROJECTIONS_KIND,
        handlers: { projections, effects: [], taps: [], workflows: [] },
    });
}
const isHandler = (value) => typeof value === 'object' &&
    value !== null &&
    'name' in value &&
    typeof value.name === 'string' &&
    'run' in value &&
    typeof value.run === 'function';
const isHandlerList = (value) => Array.isArray(value) && value.every(item => isHandler(item));
const isWorkflow = (value) => typeof value === 'object' &&
    value !== null &&
    'name' in value &&
    typeof value.name === 'string' &&
    'version' in value &&
    typeof value.version === 'number' &&
    'nodes' in value &&
    Array.isArray(value.nodes);
const isWorkflowList = (value) => Array.isArray(value) && value.every(item => isWorkflow(item));
/** A slice's static `handlers` are read untyped from the feature, so their shape is checked here. */
function isJournalDeclarations(value) {
    return (typeof value === 'object' &&
        value !== null &&
        'projections' in value &&
        isHandlerList(value.projections) &&
        'effects' in value &&
        isHandlerList(value.effects) &&
        'taps' in value &&
        isHandlerList(value.taps) &&
        'workflows' in value &&
        isWorkflowList(value.workflows));
}
function badSlice(feature, what) {
    return new DotUnitError({
        code: JOURNAL_PLUGIN_ERROR_CODES.badSlice,
        message: `[journal] feature "${feature.name}" has a \`journal\` slice whose ${what}.`,
        remediation: 'Declare reactions with journalHandlers(core, { effects, taps, workflows }) in .usecases(...), and projections with journalProjections(...) in .infra(...), from @arki/journal/dot.',
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
/** A `journalProjections(...)` unit among a feature's kernel units (its `kind` survives the feature's renaming). */
function isProjectionsUnit(unit) {
    return 'kind' in unit && unit.kind === JOURNAL_PROJECTIONS_KIND && 'handlers' in unit;
}
/**
 * Everything one feature hands the journal, wherever it was declared: its
 * `journal` contribution (`journalHandlers` in `.usecases`) and any
 * `journalProjections` unit in its `.infra`. Read from the feature value, so it
 * works before anything boots.
 * Only the feature's OWN units: the app mounts every nested child as its own
 * node, so reading a parent's `plugins()` (which lists the children's units
 * too) would register each child projection twice.
 */
function declaredBy(feature) {
    const declared = [];
    const contribution = feature.contributions.find(item => item.key === 'journal');
    if (contribution !== undefined)
        declared.push(handlersOf(contribution));
    for (const unit of ownUnits(feature))
        if (isProjectionsUnit(unit))
            declared.push(unit.handlers);
    return declared;
}
/** A contribution's static `handlers`, read untyped: `isJournalDeclarations` checks them. */
const handlersOf = (contribution) => 'handlers' in contribution ? contribution.handlers : undefined;
/** An effect's retry policy, as the graph shows it: JSON has no `Infinity`, so no limit is `null`. */
function retryOf(effect) {
    const retry = effect.schedule.retry ?? defaultEffectRetry;
    return {
        policy: effect.schedule.retry === undefined ? 'default' : 'custom',
        maxRetries: Number.isFinite(retry.maxRetries) ? retry.maxRetries : null,
    };
}
/** The `.step` nodes of a workflow, by name; a branch's steps are named `parallel.branch.step`. */
function opaqueStepsOf(nodes, prefix = '') {
    return nodes.flatMap(item => item.kind === 'step'
        ? [`${prefix}${item.name}`]
        : item.kind === 'parallel'
            ? item.branches.flatMap(branch => opaqueStepsOf(branch.def.nodes, `${prefix}${item.name}.${branch.name}.`))
            : []);
}
/** What a workflow's nodes declare, for the event map: the commands its command nodes run, and the events its waits wait for. */
function workflowEdges(nodes, prefix, found) {
    for (const item of nodes) {
        const path = `${prefix}${item.name}`;
        if (item.kind === 'command') {
            found.runs(path, item.command, false);
            if (item.options.undo !== undefined)
                found.runs(path, item.options.undo.command, true);
        }
        if (item.kind === 'eventWait')
            for (const source of item.on)
                for (const event of source.events)
                    found.waits(path, source.label, source.entity, event.type);
        if (item.kind === 'parallel')
            for (const branch of item.branches)
                workflowEdges(branch.def.nodes, `${path}.${branch.name}.`, found);
    }
}
/**
 * The app's event graph for `dot explain --as event-map`, from the features' declarations alone:
 * each entity and the events it folds, each projection and the events it reads, each effect, tap and
 * workflow and the events it reacts to, and the feature that owns each handler. Nothing runs and
 * nothing is collected at runtime. A declaration the boot would refuse is left out: the boot names it.
 */
function eventMap(features) {
    const nodes = new Map();
    const edges = new Map();
    const node = (added) => {
        if (!nodes.has(added.id))
            nodes.set(added.id, added);
        return added.id;
    };
    const edge = (added) => void edges.set(edgeKey(added), added);
    const eventNode = (type) => node({ id: `event:${type}`, kind: 'event', name: type });
    const entityNode = (entity) => {
        const id = node({ id: `entity:${entity.kind}`, kind: 'entity', name: entity.kind, table: getTableName(entity.table) });
        for (const type of entity.events.keys())
            eventNode(type);
        // The fold runs in the write itself: the entity row and the event commit together.
        for (const type of entity.reducers.keys())
            edge({ kind: 'folds', from: id, to: eventNode(type), timing: 'same-transaction' });
    };
    /** A command a workflow runs, with the events it writes: found through the workflow even when no procedure imports it. */
    const commandNode = (command) => {
        const id = node({ id: `command:${command.name}`, kind: 'command', name: command.name });
        for (const written of command.writes)
            edge({ kind: 'writes', from: id, to: eventNode(written.type) });
        return id;
    };
    const reacts = (from, types, delivery) => {
        for (const type of types)
            edge({ kind: 'reacts', from, to: eventNode(type), timing: 'after-commit', delivery });
    };
    /** A `with-event` workflow: the run is written in the event's transaction, so it needs no delivery word. */
    const startsWith = (from, type) => edge({ kind: 'reacts', from, to: eventNode(type), timing: 'same-transaction' });
    for (const feature of features) {
        const qualify = qualifyBy(feature.name);
        for (const declared of declaredBy(feature)) {
            if (!isJournalDeclarations(declared))
                continue;
            const owner = node({ id: `feature:${feature.name}`, kind: 'feature', name: feature.name });
            const owned = (id) => edge({ kind: 'owned-by', from: id, to: owner });
            for (const projection of declared.projections) {
                for (const entity of projection.entities)
                    entityNode(entity);
                const id = node({ id: `projection:${projection.name}`, kind: 'projection', name: projection.name, lane: projection.lane });
                for (const type of projection.types)
                    edge(projection.lane === 'inline'
                        ? { kind: 'projects', from: id, to: eventNode(type), timing: 'same-transaction' }
                        : { kind: 'projects', from: id, to: eventNode(type), timing: 'after-commit', delivery: 'exactly-once' });
                owned(id);
            }
            for (const effect of declared.effects) {
                for (const entity of effect.entities)
                    entityNode(entity);
                const name = qualify(effect.name);
                const id = node({ id: `effect:${name}`, kind: 'effect', name, deps: Object.keys(effect.needs), retry: retryOf(effect) });
                reacts(id, effect.types, 'at-least-once');
                owned(id);
            }
            for (const tap of declared.taps) {
                for (const entity of tap.entities)
                    entityNode(entity);
                const name = qualify(tap.name);
                const id = node({ id: `tap:${name}`, kind: 'tap', name, deps: Object.keys(tap.needs) });
                // A tap is lossy: a listener that is not running misses the event.
                reacts(id, tap.types, 'at-most-once');
                owned(id);
            }
            for (const def of declared.workflows) {
                const id = node({
                    id: `workflow:${def.name}@${def.version}`,
                    kind: 'workflow',
                    name: def.name,
                    version: def.version,
                    deps: Object.keys(def.needs),
                    signals: signalsOf(def),
                    opaqueSteps: opaqueStepsOf(def.nodes),
                });
                workflowEdges(def.nodes, '', {
                    runs: (node, command, undo) => {
                        const commandId = commandNode(command);
                        edge(undo ? { kind: 'runs', from: id, to: commandId, node, undo: true } : { kind: 'runs', from: id, to: commandId, node });
                    },
                    waits: (node, label, entity, type) => {
                        entityNode(entity);
                        edge({ kind: 'waits-for', from: id, to: eventNode(type), node, label });
                    },
                });
                if (def.startOn !== undefined) {
                    entityNode(def.startOn.entity);
                    if (def.startOn.timing === 'with-event')
                        startsWith(id, def.startOn.event.type);
                    else
                        reacts(id, [def.startOn.event.type], 'at-least-once');
                }
                owned(id);
            }
        }
    }
    return { nodes: [...nodes.values()], edges: [...edges.values()] };
}
/**
 * Read each feature's journal declarations, in feature order, and fold them into
 * one list per kind. Refuses a name that is listed twice. `owners` maps
 * `effect:<name>` and `tap:<name>` (and `projection:<name>`) to the feature that lists it.
 */
function readDeclarations(features) {
    const projections = [];
    const effects = [];
    const taps = [];
    const workflows = [];
    const owners = new Map();
    for (const feature of features) {
        const qualify = qualifyBy(feature.name);
        const all = declaredBy(feature);
        if (all.length === 0) {
            debugWorker.debug('[journal] feature "{featureName}" did not contribute journal handlers', {
                featureName: feature.name,
            });
            continue;
        }
        for (const declared of all) {
            if (!isJournalDeclarations(declared))
                throw badSlice(feature, 'handlers are not lists of projections, effects and taps');
            for (const { name } of declared.projections)
                claimName('projection', owners, name, feature);
            // An instance's effects and taps are renamed here, so the duplicate check, the services lookup,
            // the stored job rows and the worker's dispatch all see the qualified name.
            const ownEffects = declared.effects.map(effect => ({ ...effect, name: qualify(effect.name) }));
            const ownTaps = declared.taps.map(tap => ({ ...tap, name: qualify(tap.name) }));
            for (const { name } of ownEffects)
                claimName('effect', owners, name, feature);
            for (const { name } of ownTaps)
                claimName('tap', owners, name, feature);
            // A workflow is keyed by name and version, not renamed per instance: its commands and stored runs use the plain name.
            for (const def of declared.workflows)
                claimName('workflow', owners, `${def.name}@${def.version}`, feature);
            projections.push(...declared.projections);
            workflows.push(...declared.workflows);
            effects.push(...ownEffects);
            taps.push(...ownTaps);
        }
    }
    return { declarations: { projections, effects, taps, workflows }, owners };
}
/**
 * What the journal unit needs, in both modes. `RootDb` again on purpose: a Drizzle transaction
 * fits `AppDb` by shape, and must not fit here. `TransactionSource<Tx>`: the worker's database
 * runs the commands of effects, so it opens `Tx`.
 */
function journalNeeds() {
    return { db: service() };
}
/**
 * The journal unit's manifest entries, in both modes. `flow` is the graph `dot explain --as event-map`
 * prints: in feature mode it is derived from the features' declarations; a journal the app composed
 * itself has no feature to read it from.
 */
function registerJournal(ctx, flow) {
    ctx.registerService('journal', 'custom');
    ctx.declareProvides('journal');
    ctx.registerProjection({
        format: 'event-map',
        binding: 'journal',
        module: '@arki/journal/event-map',
        console: { title: 'Event map' },
        ...(flow === undefined ? {} : { meta: flow }),
    });
}
function journalPlugin(composed) {
    return infra({
        name: 'journal',
        needs: journalNeeds(),
        configure(ctx) {
            registerJournal(ctx);
        },
        provides: { journal: () => composed },
    });
}
function journalFromFeatures({ j, workflowMeta, entrypointRoot = EVENT_MAP_DEFAULT_ENTRYPOINT_ROOT }) {
    return infra.fromFeatures({
        name: 'journal',
        needs: journalNeeds(),
        configure(ctx) {
            registerJournal(ctx, { ...eventMap(ctx.$features), entrypointRoot });
        },
        provides: {
            journal: ({ $features }) => 
            // `'worker'`: the effects' services exist only once the features boot, after this journal.
            j.compose({
                ...readDeclarations($features).declarations,
                ...(workflowMeta === undefined ? {} : { workflowMeta }),
                services: 'worker',
            }),
        },
    });
}
export function journal(options) {
    return 'journal' in options ? journalPlugin(options.journal) : journalFromFeatures(options);
}
/** The services a feature's `journal` slice published at its boot. */
function sliceServices(ctx, feature) {
    const payload = sliceOf(ctx, feature).journal;
    if (typeof payload !== 'object' || payload === null || !('services' in payload) || !isServices(payload.services))
        throw badSlice(feature, 'boot payload holds no services; it was not made by journalHandlers');
    return payload.services;
}
export function journalWorker(options = {}) {
    const { jobs: source, ...workerOptions } = options;
    // The source's needs join the worker's, so the kernel resolves and checks them with the
    // worker's own; the overloads above type them for the app.
    const needs = { ...source?.needs, db: service(), journal: service() };
    return entrypoint.fromFeatures({
        name: 'journal-worker',
        needs,
        state: () => ({ worker: undefined }),
        ...(source?.actions === undefined ? {} : { actions: source.actions }),
        async boot(ctx) {
            const { owners } = readDeclarations(ctx.$features);
            const byFeature = new Map();
            // An effect or tap came from a `journal` slice, so its owner has a slice record. A
            // projection may come from an infra unit instead, and needs no services anyway.
            for (const [handler, feature] of owners) {
                if (handler.startsWith('projection:') || byFeature.has(feature))
                    continue;
                byFeature.set(feature, sliceServices(ctx, feature));
            }
            const services = ({ kind, name, workflow }) => {
                // `workflow.step` asks once per workflow: that workflow's feature answers, not a shared set.
                const owner = owners.get(workflow === undefined ? `${kind}:${name}` : `workflow:${workflow}`);
                return (owner === undefined ? undefined : byFeature.get(owner)) ?? {};
            };
            const jobs = await source?.build(ctx.$features, ctx);
            // Built at boot, not at start: a missing service fails the boot.
            ctx.$state.worker = ctx.journal.worker(ctx.db, { ...workerOptions, services, jobs });
        },
        async start({ $state }) {
            await $state.worker?.start();
        },
        async stop({ $state }) {
            await $state.worker?.stop();
        },
    });
}
//# sourceMappingURL=dot.js.map