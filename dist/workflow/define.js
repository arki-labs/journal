/**
 * The workflow builder: `workflow(name, options).step(...).waitFor(...)...finish()`.
 * It builds a frozen definition and runs nothing. The definition carries the shape manifest
 * (names, kinds, order, undo flags), a hash of it, and the typed bodies for the runner.
 *
 * Types are written once, here. `results` grows by one key per node, and a node that can be
 * skipped (`when`) or can time out into `continue` adds `R | null`.
 */
import { z } from 'zod';
import { JournalError } from '../errors.js';
import { parseRunKeep } from '../retention.js';
import { LIMIT_BOUNDS } from './limit-types.js';
import { storedWaitResultSchema } from './run-field-schemas.js';
import { START_TIMINGS } from './states.js';
/**
 * The library's claim for typed reads. The runner keeps a run's results erased (`results` by node name, `unknown`),
 * while `def.read` hands them out typed per node (`types.results`) and the output typed by the `output` schema
 * (`types.readOutput`). The compiler cannot connect the two, so the types rest on these facts:
 * - the runner stores at `results[K]` only what node K produced, after node K's own schema took it;
 * - the builder puts in `Checked` exactly the nodes `resultSchemaOf` finds a schema for, with that schema's output;
 * - `read` checks every stored result of such a node with that same schema, and a completed run's output with the
 *   `output` schema, before it gives them out.
 * This guard is the one place the claim is made. At run time it checks the last fact: that `read` did check each of
 * them (`checked` holds `output` and `results.<node>`). The first two are the runner's and the builder's contract.
 */
export function isCheckedRead(def, detail, checked) {
    const { run } = detail;
    if (def.output !== undefined && run.state === 'completed' && !checked.has('output'))
        return false;
    return def.nodes.every(node => resultSchemaOf(node) === undefined ||
        !Object.hasOwn(run.results, node.name) ||
        checked.has(`results.${node.name}`));
}
/** What a command node keeps of a command that declares no `output`: nothing, so its result is `null`. */
const noOutput = z.null();
/**
 * How an event wait stores its result: the label, and the event as the log row, the same JSON an effect job's `args`
 * holds. The runner decodes that row for bodies and for `def.read` as a job's event is decoded, so upcasters apply.
 * Annotated so no Zod type reaches `define.d.ts` (A-43).
 */
const waitResultSchema = storedWaitResultSchema;
/**
 * The schema a stored node result is checked with, and whether `null` (skipped, or timed out into `continue`) is kept.
 * `each`: the stored result is a list and the schema checks every item (a `map` that waits for all).
 */
export function resultSchemaOf(node) {
    if (node.kind === 'step' && node.options.output !== undefined) {
        return { schema: node.options.output, nullable: node.options.when !== undefined };
    }
    if (node.kind === 'command') {
        return { schema: node.command.output ?? noOutput, nullable: node.options.when !== undefined };
    }
    if (node.kind === 'waitFor') {
        return { schema: node.schema, nullable: node.onTimeout === 'continue' || node.when !== undefined };
    }
    if (node.kind === 'eventWait') {
        return { schema: waitResultSchema, nullable: node.onTimeout === 'continue' || node.when !== undefined };
    }
    // A sleep stores `null`, always.
    if (node.kind === 'sleep')
        return { schema: noOutput, nullable: false };
    // A child's result is its run's output, which its workflow checked with its `output` schema; a child chosen at run
    // time (a function) has no schema to read it with.
    if (node.kind === 'child' && typeof node.def !== 'function' && node.def.output !== undefined) {
        return { schema: node.def.output, nullable: false };
    }
    // A parallel is read with the branches' schemas, when every branch has one.
    if (node.kind === 'parallel') {
        const schema = branchesSchema(node);
        return schema === undefined ? undefined : { schema, nullable: false };
    }
    if (node.kind === 'map' && node.def.output !== undefined) {
        return node.wait === 'all'
            ? { schema: node.def.output, nullable: false, each: true }
            : { schema: node.def.output, nullable: false };
    }
    return;
}
const issue = (message, path = []) => ({ message, path });
/**
 * The schema that checks a stored parallel result: for `all`, an object with one key per branch, each checked by its
 * branch's `output` schema; for `any`, `{ branch, result }` with `result` checked by the named branch's schema.
 * `undefined` unless every branch has an `output` schema.
 */
function branchesSchema(node) {
    const outputs = new Map();
    for (const branch of node.branches) {
        if (branch.def.output === undefined)
            return undefined;
        outputs.set(branch.name, branch.def.output);
    }
    const check = async (schema, value, path) => {
        const result = await schema['~standard'].validate(value);
        if (result.issues === undefined)
            return { value: result.value };
        return { issues: result.issues.map(found => issue(found.message, [...path, ...(found.path ?? [])])) };
    };
    const validate = async (value) => {
        if (typeof value !== 'object' || value === null || Array.isArray(value)) {
            return { issues: [issue('expected an object')] };
        }
        if (node.wait === 'any') {
            const { branch, result } = Object.fromEntries(Object.entries(value));
            const schema = typeof branch === 'string' ? outputs.get(branch) : undefined;
            if (schema === undefined)
                return { issues: [issue('expected the name of a branch', ['branch'])] };
            const checked = await check(schema, result, ['result']);
            if ('issues' in checked)
                return { issues: checked.issues };
            return { value: { branch, result: checked.value } };
        }
        const given = new Map(Object.entries(value));
        const issues = [];
        const entries = [];
        for (const [name, schema] of outputs) {
            if (!given.has(name)) {
                issues.push(issue('missing', [name]));
                continue;
            }
            const checked = await check(schema, given.get(name), [name]);
            if ('issues' in checked)
                issues.push(...checked.issues);
            else
                entries.push([name, checked.value]);
        }
        for (const name of given.keys())
            if (!outputs.has(name))
                issues.push(issue('not a branch', [name]));
        return issues.length > 0 ? { issues } : { value: Object.fromEntries(entries) };
    };
    return { '~standard': { version: 1, vendor: 'arki-journal', validate } };
}
/** The name of a task's one step: `j.task` is a workflow whose only node is this step. */
export const TASK_STEP = 'run';
const DEFAULT_LIMITS = { payload: 65_536, transitions: 1000, children: 1000 };
/** 64-bit hash of a string as 16 hex characters. Portable (no crypto); it detects drift, it is not a security hash. */
function hashText(text) {
    let h1 = 3_735_928_559;
    let h2 = 1_103_547_991;
    for (let i = 0; i < text.length; i++) {
        const code = text.codePointAt(i) ?? 0;
        h1 = Math.imul(h1 ^ code, 2_654_435_761);
        h2 = Math.imul(h2 ^ code, 1_597_334_677);
    }
    h1 = Math.imul(h1 ^ (h1 >>> 16), 2_246_822_507) ^ Math.imul(h2 ^ (h2 >>> 13), 3_266_489_909);
    h2 = Math.imul(h2 ^ (h2 >>> 16), 2_246_822_507) ^ Math.imul(h1 ^ (h1 >>> 13), 3_266_489_909);
    return (h2 >>> 0).toString(16).padStart(8, '0') + (h1 >>> 0).toString(16).padStart(8, '0');
}
function shapeOf(nodes) {
    return {
        nodes: nodes.map(node => ({
            name: node.name,
            kind: node.kind,
            undo: node.undo,
            ...(node.kind === 'child' ? { onCancel: node.onCancel } : {}),
            ...(node.kind === 'waitFor' ? { signal: node.signal } : {}),
            ...(node.kind === 'eventWait'
                ? {
                    on: node.on.map(source => ({
                        label: source.label,
                        entity: source.entity.kind,
                        events: source.events.map(event => event.type),
                    })),
                }
                : {}),
            ...(node.kind === 'parallel'
                ? { wait: node.wait, branches: node.branches.map(branch => ({ name: branch.name, shape: branch.def.shape })) }
                : {}),
            ...(node.kind === 'command' ? { command: node.command.name } : {}),
            ...(node.kind === 'command' && node.options.undo !== undefined
                ? { undoCommand: node.options.undo.command.name }
                : {}),
        })),
    };
}
/**
 * What the shape hash reads of one node. A command node adds its commands' names and an event wait its `on`, so
 * changing either is a shape change. Every other kind keeps exactly these three fields: its hash must not move, or
 * running workflows strand.
 */
const hashedFields = (entry) => {
    if (entry.kind === 'parallel') {
        const branches = (entry.branches ?? []).map(branch => [branch.name, branch.shape.nodes.map(hashedFields)]);
        return [entry.name, entry.kind, entry.undo, entry.wait ?? null, branches];
    }
    if (entry.kind === 'command')
        return [entry.name, entry.kind, entry.undo, entry.command, entry.undoCommand ?? null];
    if (entry.kind === 'eventWait')
        return [entry.name, entry.kind, entry.undo, entry.on ?? null];
    return [entry.name, entry.kind, entry.undo];
};
const isPositiveInt = (value) => Number.isInteger(value) && value > 0;
function refuse(workflowName, detail) {
    throw new JournalError('BAD_DEFINITION', 'workflow', workflowName, `${workflowName}: ${detail}`);
}
/** The rules of `concurrency` that need no types. Each mistake would make a limit count something else than it says. */
function checkConcurrency(workflowName, concurrency) {
    const { key, limit, total, shared = [] } = concurrency;
    if (limit === undefined && total === undefined && shared.length === 0) {
        refuse(workflowName, 'concurrency needs limit, total or shared: without one it limits nothing');
    }
    if (limit !== undefined && !isPositiveInt(limit)) {
        refuse(workflowName, `concurrency.limit must be a positive whole number, got ${limit}`);
    }
    if (limit !== undefined && key === undefined) {
        refuse(workflowName, 'concurrency.limit counts the runs of one key, so it needs concurrency.key; use total for all runs');
    }
    if (total !== undefined && !isPositiveInt(total)) {
        refuse(workflowName, `concurrency.total must be a positive whole number, got ${total}`);
    }
    if (shared.length > LIMIT_BOUNDS.shared) {
        refuse(workflowName, `concurrency.shared lists at most ${LIMIT_BOUNDS.shared} limits, got ${shared.length}`);
    }
    if (new Set(shared.map(held => held.name)).size !== shared.length) {
        refuse(workflowName, 'concurrency.shared lists a limit twice');
    }
    const perKey = shared.find(held => held.perKey !== undefined);
    if (perKey !== undefined && key === undefined) {
        refuse(workflowName, `limit "${perKey.name}" has perKey, so concurrency needs a key to count it by`);
    }
}
/** The longest label `workflow_waits.label` holds. */
const WAIT_LABEL_LIMIT = 128;
/** The rules of an event wait's `on` that need no types: a wrong one could never wake, or would wake on the wrong log. */
function checkWaitSources(workflowName, name, on) {
    if (on.length === 0)
        refuse(workflowName, `waitFor '${name}' needs at least one label in on`);
    for (const { label, entity, events } of on) {
        if (label === '' || label.length > WAIT_LABEL_LIMIT) {
            refuse(workflowName, `waitFor '${name}' needs labels of 1 to ${WAIT_LABEL_LIMIT} characters, got '${label}'`);
        }
        if (events.length === 0)
            refuse(workflowName, `waitFor '${name}': label '${label}' lists no events`);
        if (entity.eventStorage !== 'stored') {
            refuse(workflowName, `waitFor '${name}': entity "${entity.kind}" does not keep its events in journal_events, and a wait reads them there; declare it with events: 'stored'`);
        }
        for (const event of events) {
            if (entity.events.get(event.type) !== event) {
                refuse(workflowName, `waitFor '${name}': entity "${entity.kind}" does not record event "${event.type}"; pass an event the entity declares`);
            }
        }
    }
}
/**
 * Every signal the nodes wait for, with its schema and where the wait is. The waits inside the branches of a `parallel`
 * node count: the parent's signal door reaches them.
 */
export function signalWaits(nodes, prefix = '') {
    return nodes.flatMap(node => {
        if (node.kind === 'waitFor')
            return [{ signal: node.signal, schema: node.schema, at: `${prefix}${node.name}` }];
        if (node.kind !== 'parallel')
            return [];
        return node.branches.flatMap(branch => signalWaits(branch.def.nodes, `${prefix}${node.name}.${branch.name}.`));
    });
}
/** A branch name is part of a run id and a definition name, so it is a plain key. */
const BRANCH_NAME = /^[A-Za-z0-9_-]+$/;
/** Adds a node after checking the rules that need no types. */
function withNode(state, node) {
    if (node.name === '')
        refuse(state.name, 'a node name must not be empty');
    if (node.name === 'next')
        refuse(state.name, "a node cannot be called 'next', because `next: 'next'` means carry on");
    if (state.nodes.some(existing => existing.name === node.name)) {
        refuse(state.name, `node '${node.name}' is declared twice; node names are unique per workflow`);
    }
    if (node.kind === 'step' || node.kind === 'sleep') {
        const next = node.kind === 'step' ? node.options.next : node.next;
        if (typeof next === 'string' && next !== 'next' && !state.nodes.some(existing => existing.name === next)) {
            refuse(state.name, `${node.kind} '${node.name}' has next: '${next}', which is not an earlier node; next may only jump back`);
        }
    }
    return { ...state, nodes: [...state.nodes, node] };
}
function refuseUndo(workflowName, kind, name, options) {
    if (options !== undefined && 'undo' in options) {
        refuse(workflowName, `${kind} '${name}' cannot have an undo; only a step, a child or a command can be undone`);
    }
}
function finishDef(state, finish) {
    if (state.nodes.length === 0)
        refuse(state.name, 'a workflow needs at least one node');
    const last = state.nodes.at(-1);
    if (finish === undefined && last?.kind === 'command' && last.accept.length > 0) {
        refuse(state.name, `command '${last.name}' can end in an accepted failure, so finish needs a function: a run's output is never a failure`);
    }
    if (finish === undefined && last?.kind === 'step' && last.options.onFailure === 'continue') {
        refuse(state.name, `step '${last.name}' can end in a returned failure, so finish needs a function: a run's output is never a failure`);
    }
    const nodes = state.nodes.map(node => Object.freeze(node));
    const shape = shapeOf(nodes);
    const plain = {
        ...state.header,
        shape: Object.freeze({ nodes: Object.freeze(shape.nodes.map(entry => Object.freeze(entry))) }),
        shapeHash: hashText(JSON.stringify(shape.nodes.map(entry => hashedFields(entry)))),
        nodes: Object.freeze(nodes),
        finish,
    };
    const def = { ...plain, ...state.attach(plain) };
    Object.freeze(def);
    return def;
}
/**
 * Each method returns this factory again, called with the grown type. The return type is
 * inferred from the interface's own signature, so the compiler checks every method against it.
 */
function makeBuilder(state) {
    return {
        step: (name, run, options) => {
            if (options?.onFailure === 'continue' && (options.failures ?? []).length === 0) {
                refuse(state.name, `step '${name}' has onFailure 'continue' and lists no failures to continue on`);
            }
            if (options?.onFailure === 'continue' && options.output === undefined) {
                refuse(state.name, `step '${name}' continues on failures, so it needs an output schema: a stored result is checked when read`);
            }
            if (options?.failures !== undefined && options.failures.length > 0 && options.onFailure === undefined) {
                refuse(state.name, `step '${name}' lists failures but has no onFailure: set onFailure to 'continue'`);
            }
            return makeBuilder(withNode(state, { kind: 'step', name, undo: options?.undo !== undefined, run, options: options ?? {} }));
        },
        waitFor: (name, options) => {
            refuseUndo(state.name, 'waitFor', name, options);
            if ('on' in options) {
                const on = Object.entries(options.on).map(([label, source]) => ({ ...source, label }));
                checkWaitSources(state.name, name, on);
                if (options.timeout !== undefined && options.until !== undefined) {
                    refuse(state.name, `waitFor '${name}' takes timeout or until, not both`);
                }
                return makeBuilder(withNode(state, {
                    kind: 'eventWait',
                    name,
                    undo: false,
                    on,
                    timeout: options.timeout,
                    until: options.until,
                    onTimeout: options.onTimeout ?? 'fail',
                    when: options.when,
                }));
            }
            if (options.signal === '')
                refuse(state.name, `waitFor '${name}' needs a signal name`);
            const sharing = signalWaits(state.nodes).find(wait => wait.signal === options.signal && wait.schema !== options.schema);
            if (sharing !== undefined) {
                refuse(state.name, `waitFor '${name}' and '${sharing.at}' both wait for signal '${options.signal}' with different schemas; one signal name has one payload schema, so share the schema object`);
            }
            return makeBuilder(withNode(state, {
                kind: 'waitFor',
                name,
                undo: false,
                signal: options.signal,
                schema: options.schema,
                timeout: options.timeout,
                onTimeout: options.onTimeout ?? 'fail',
                when: options.when,
            }));
        },
        sleep: (name, until, options) => {
            refuseUndo(state.name, 'sleep', name, options);
            return makeBuilder(withNode(state, { kind: 'sleep', name, undo: false, until, next: options?.next }));
        },
        child: (name, def, options) => {
            return makeBuilder(withNode(state, {
                kind: 'child',
                name,
                undo: options.undo !== undefined,
                def,
                input: options.input,
                onCancel: options.onCancel ?? 'cancel',
                options: { undo: options.undo },
            }));
        },
        map: (name, def, options) => {
            refuseUndo(state.name, 'map', name, options);
            if (options.concurrency !== undefined && !isPositiveInt(options.concurrency)) {
                refuse(state.name, `map '${name}' needs a positive whole concurrency`);
            }
            return makeBuilder(withNode(state, {
                kind: 'map',
                name,
                undo: false,
                def,
                items: options.items,
                input: options.input,
                wait: options.wait ?? 'all',
                concurrency: options.concurrency,
            }));
        },
        parallel: (name, branches, options) => {
            if (options.wait !== 'all' && options.wait !== 'any') {
                refuse(state.name, `parallel '${name}' needs wait: 'all' or 'any'`);
            }
            const entries = Object.entries(branches);
            if (entries.length === 0)
                refuse(state.name, `parallel '${name}' needs at least one branch`);
            const earlier = new Set(state.nodes.map(node => node.name));
            // The signals the node's waits already use, with the first place each is waited for.
            const signals = new Map(signalWaits(state.nodes).map(wait => [wait.signal, wait]));
            const defs = entries.map(([branch, build]) => {
                if (!BRANCH_NAME.test(branch)) {
                    refuse(state.name, `parallel '${name}': branch '${branch}' must be letters, digits, '-' and '_'`);
                }
                const branchName = `${state.name}/${name}/${branch}`;
                const branchState = {
                    attach: () => ({}),
                    name: branchName,
                    nodes: [],
                    // A branch is a run of the parent's version with the parent's limits: its own transitions count against them.
                    header: {
                        ...state.header,
                        name: branchName,
                        output: undefined,
                        deadline: undefined,
                        concurrency: undefined,
                        startOn: undefined,
                        on: undefined,
                        inherited: state.nodes,
                    },
                };
                const built = build({
                    ...makeBuilder(branchState),
                    output: (schema) => makeBuilder({
                        ...branchState,
                        header: { ...branchState.header, output: schema },
                    }),
                });
                if (built.name !== branchName) {
                    refuse(state.name, `parallel '${name}': branch '${branch}' must return the definition its builder finished`);
                }
                for (const node of built.nodes) {
                    if (earlier.has(node.name)) {
                        refuse(state.name, `parallel '${name}': branch '${branch}' has a node '${node.name}', which an earlier node of the workflow has too; a branch reads the earlier results, so its names must differ`);
                    }
                }
                for (const wait of signalWaits(built.nodes, `${name}.${branch}.`)) {
                    const other = signals.get(wait.signal);
                    if (other !== undefined && other.schema !== wait.schema) {
                        refuse(state.name, `parallel '${name}': '${wait.at}' and '${other.at}' both wait for signal '${wait.signal}' with different schemas; one signal name has one payload schema, so share the schema object`);
                    }
                    signals.set(wait.signal, wait);
                }
                return { name: branch, def: built };
            });
            return makeBuilder(withNode(state, { kind: 'parallel', name, undo: false, branches: defs, wait: options.wait }));
        },
        command: (name, command, input, options) => makeBuilder(withNode(state, {
            kind: 'command',
            name,
            undo: options?.undo !== undefined,
            command,
            input,
            accept: options?.accept ?? [],
            options: { undo: options?.undo, when: options?.when, retry: options?.retry },
        })),
        finish: (...run) => finishDef(state, run[0]),
    };
}
/**
 * Starts a workflow definition. The version and input schema are required; nodes follow.
 * Throws `BAD_DEFINITION`, naming the workflow, for a duplicate node name, a `next` that is not
 * an earlier node, an `undo` on anything but a step, a child or a command, and a workflow with no node.
 * `startOn` is typed as in `j.workflow`: the event's meta comes from the entity.
 */
export function workflow(name, options) {
    return workflowWith(name, options, () => ({}));
}
/**
 * The desugaring of a task: `builder.step(TASK_STEP, run, { retry, timeout, undo, key }).finish()`. `j.task` passes
 * `j.workflow(name, options)` as the builder, so a task is a workflow definition in every way.
 */
export function taskOf(builder, options, run) {
    // Only the step's own options: the rest of `options` are the workflow's, and `output` there is the run's output.
    const { retry, timeout, undo, key } = options;
    return builder.step(TASK_STEP, run, { retry, timeout, undo, key }).finish(({ results }) => results[TASK_STEP]);
}
/**
 * `workflow` with a journal's additions: `attach` runs when `finish` builds the definition and
 * returns what to merge into it (`start`, from `j.workflow`). The builder types carry that as `Ext`.
 */
export function workflowWith(name, options, attach) {
    if (name === '')
        refuse(name, 'a workflow needs a name');
    if (!isPositiveInt(options.version))
        refuse(name, `version must be a positive whole number, got ${options.version}`);
    const limits = { ...DEFAULT_LIMITS, ...options.limits };
    for (const [limit, value] of Object.entries(limits)) {
        if (!isPositiveInt(value))
            refuse(name, `limits.${limit} must be a positive whole number, got ${value}`);
    }
    const { concurrency } = options;
    if (concurrency !== undefined)
        checkConcurrency(name, concurrency);
    for (const [outcome, keep] of Object.entries(options.retention ?? {})) {
        parseRunKeep(keep, `workflow "${name}": retention.${outcome}`);
    }
    const { startOn } = options;
    if (startOn !== undefined && startOn.entity.events.get(startOn.event.type) !== startOn.event) {
        refuse(name, `startOn: entity "${startOn.entity.kind}" does not record event "${startOn.event.type}"; pass an event the entity declares`);
    }
    if (startOn !== undefined && !START_TIMINGS.includes(startOn.timing)) {
        refuse(name, `startOn.timing is required: ${START_TIMINGS.join(' or ')}`);
    }
    if (startOn?.timing === 'with-event' && concurrency?.onBusy === 'refuse') {
        refuse(name, "startOn.timing 'with-event' cannot use concurrency.onBusy 'refuse': a limit must not refuse the business transaction; use 'queue' or 'join'");
    }
    return makeBuilder({
        attach,
        name,
        nodes: [],
        header: {
            name,
            version: options.version,
            input: options.input,
            output: options.output,
            deadline: options.deadline,
            concurrency: concurrency === undefined
                ? undefined
                : {
                    key: concurrency.key,
                    limit: concurrency.limit,
                    total: concurrency.total,
                    shared: concurrency.shared ?? [],
                    onBusy: concurrency.onBusy,
                },
            onDeadStep: options.onDeadStep ?? 'wait',
            retention: options.retention ?? {},
            limits,
            needs: options.needs ?? {},
            startOn,
            on: options.on,
            inherited: [],
        },
    });
}
//# sourceMappingURL=define.js.map