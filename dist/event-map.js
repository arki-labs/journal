/**
 * `@arki/journal/event-map`: the Node-only half of `dot explain --as event-map`. It reads the app's
 * procedure files, finds the journal commands they import, and adds them to the graph. Dot loads this
 * module from the manifest (`project` and `render`), so `dot explain --as event-map` finds the commands without a
 * declaration: a procedure imports a command and calls `context.run(command, input)` (no list names it).
 *
 * How the scan works:
 * 1. It walks the scan root (`src/features` by default, or the `entrypointRoot` of `journal({ j })`) and takes
 *    every file under an `entrypoints` folder, except tests and `.d.ts` files. The folder above `entrypoints` names the feature.
 * 2. It reads each file's static imports with a pattern match: relative specifiers only, `import type` skipped. A
 *    named import keeps those names, a namespace import keeps every export, a default import keeps `default`.
 * 3. It imports each module the file names, and keeps the exports that fit `journalCommandSchema`.
 *
 * A command that is imported and never called still gets its edge: the scan reads imports, not calls. A path alias
 * or a package specifier is not followed. A module that fails to import, or an import that does not resolve, is
 * reported in `problems` and the rest of the map is still drawn.
 *
 * Needs `node:fs`, so it is its own subpath and never part of the portable entries.
 */
import { mkdir, readdir, readFile, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { is } from '@arki/schema';
import { journalCommandSchema } from './event-map-schema.js';
import { projectGraph, withEntrypoints } from './projection.js';
export { eventMapPage as consolePage } from './event-map-page.js';
export { render } from './projection.js';
const PROCEDURE_FILE = /\.(?:ts|tsx|mts|js|mjs)$/;
const NOT_PROCEDURE = /\.(?:test|spec)\.|\.d\.ts$/;
/** `import`, then everything up to the first quote (the clause and `from`), then the quoted specifier. */
const IMPORT_STATEMENT = /^[ \t]*import\b([^'";]*)['"]([^'"]+)['"]/gm;
/** Every file under `entrypoints` folders below `root`, sorted, as paths relative to `root`. */
async function procedureFiles(root, problems) {
    const found = [];
    const walk = async (directory) => {
        let entries;
        try {
            entries = await readdir(directory, { withFileTypes: true });
        }
        catch (error) {
            problems.push({ file: path.relative(root, directory) || '.', reason: `cannot read the folder: ${messageOf(error)}` });
            return;
        }
        for (const entry of entries) {
            const full = path.join(directory, entry.name);
            if (entry.isDirectory()) {
                if (entry.name !== 'node_modules' && !entry.name.startsWith('.'))
                    await walk(full);
            }
            else if (PROCEDURE_FILE.test(entry.name) && !NOT_PROCEDURE.test(entry.name)) {
                const relative = path.relative(root, full).split(path.sep);
                if (relative.slice(0, -1).includes('entrypoints'))
                    found.push(relative.join('/'));
            }
        }
    };
    await walk(root);
    return found.toSorted();
}
const messageOf = (error) => (error instanceof Error ? error.message : String(error));
function importsOf(source) {
    const imports = [];
    for (const match of source.matchAll(IMPORT_STATEMENT)) {
        const [, head = '', specifier] = match;
        if (specifier === undefined || !specifier.startsWith('.') || /^\s*type\s+(?!from\b)/.test(head))
            continue;
        const trimmed = head.trimEnd();
        const clause = trimmed.endsWith('from') ? trimmed.slice(0, -4) : '';
        const names = [];
        const braces = /\{([^}]*)\}/.exec(clause);
        for (const part of (braces?.[1] ?? '').split(',')) {
            const name = part.trim().split(/\s+as\s+/)[0] ?? '';
            if (name !== '' && !name.startsWith('type '))
                names.push(name);
        }
        const outside = clause.replace(/\{[^}]*\}/, '');
        if (/\*\s*as\s/.test(outside))
            names.push('*');
        else if (outside.replaceAll(',', '').trim() !== '')
            names.push('default');
        imports.push({ specifier, names });
    }
    return imports;
}
/** A relative specifier as a file on disk: as written, `.js` for `.ts`, an added extension, or an `index` file. */
async function resolveFile(from, specifier) {
    const base = path.resolve(path.dirname(from), specifier);
    const stem = base.replace(/\.(?:js|mjs)$/, '');
    const candidates = [base, `${stem}.ts`, `${stem}.tsx`, `${base}.ts`, `${base}.tsx`, `${base}.js`, `${base}/index.ts`, `${base}/index.tsx`, `${base}/index.js`];
    for (const candidate of candidates) {
        const isFile = await stat(candidate).then(info => info.isFile(), () => false);
        if (isFile)
            return candidate;
    }
    return undefined;
}
/** The journal commands a module exports. A module that does not import is a problem, not a throw. */
async function commandsOf(file) {
    let loaded;
    try {
        loaded = await import(pathToFileURL(file).href);
    }
    catch (error) {
        return `cannot import: ${messageOf(error)}`;
    }
    const commands = [];
    for (const [exportName, value] of Object.entries(loaded)) {
        if (is(value, journalCommandSchema))
            commands.push({ exportName, name: value.name, writes: value.writes.map(event => event.type) });
    }
    return commands;
}
/**
 * Scan the procedure files under `root` (an absolute folder). Files are found by the `entrypoints` folder
 * convention; the result is sorted by file, so the same app gives the same scan on every machine.
 */
export async function scanEntrypoints(options) {
    const problems = [];
    const files = await procedureFiles(options.root, problems);
    const modules = new Map();
    const entries = [];
    for (const file of files) {
        const absolute = path.join(options.root, file);
        const segments = file.split('/');
        const feature = segments[segments.indexOf('entrypoints') - 1] ?? path.basename(options.root);
        const commands = new Map();
        for (const statement of importsOf(await readFile(absolute, 'utf8'))) {
            const target = await resolveFile(absolute, statement.specifier);
            if (target === undefined) {
                problems.push({ file, reason: `import "${statement.specifier}" does not resolve to a file` });
                continue;
            }
            const pending = modules.get(target) ?? commandsOf(target);
            modules.set(target, pending);
            const found = await pending;
            if (typeof found === 'string') {
                problems.push({ file, reason: `import "${statement.specifier}": ${found}` });
                continue;
            }
            for (const command of found) {
                if (statement.names.includes('*') || statement.names.includes(command.exportName))
                    commands.set(command.name, { name: command.name, writes: command.writes });
            }
        }
        entries.push({ feature, file, commands: [...commands.values()] });
    }
    return { entries, problems };
}
/**
 * The module Dot loads for `dot explain --as event-map`: the manifest's graph plus the scan of the
 * entrypoint root, which is resolved against `cwd` (the folder `dot` runs in, by default).
 */
export async function project(manifest, cwd = process.cwd()) {
    const { document, entrypointRoot } = projectGraph(manifest);
    if (entrypointRoot === undefined)
        return document;
    const scan = await scanEntrypoints({ root: path.resolve(cwd, entrypointRoot) });
    return withEntrypoints(document, scan.entries, scan.problems);
}
/** A line diff of the changed lines: `-` for lines only in the file on disk, `+` for lines only in the new text. Small files only. */
function lineDiff(before, after) {
    const width = after.length + 1;
    // `common[i * width + j]`: the length of the longest common run of `before[i..]` and `after[j..]`.
    const common = Array.from({ length: (before.length + 1) * width }, () => 0);
    const at = (i, j) => common[i * width + j] ?? 0;
    for (let i = before.length - 1; i >= 0; i -= 1)
        for (let j = after.length - 1; j >= 0; j -= 1)
            common[i * width + j] = before[i] === after[j] ? at(i + 1, j + 1) + 1 : Math.max(at(i + 1, j), at(i, j + 1));
    const out = [];
    let i = 0;
    let j = 0;
    while (i < before.length || j < after.length) {
        if (i < before.length && j < after.length && before[i] === after[j]) {
            i += 1;
            j += 1;
        }
        else if (i < before.length && (j === after.length || at(i + 1, j) >= at(i, j + 1))) {
            out.push(`- ${before[i]}`);
            i += 1;
        }
        else {
            out.push(`+ ${after[j]}`);
            j += 1;
        }
    }
    return out.join('\n');
}
/**
 * Keep a Mermaid file in an app's docs fresh. In a test, call it with the file and `eventMapMermaid(document)`
 * and expect `{ state: 'fresh' }`; a stale file fails the test and the report shows the diff. To regenerate,
 * run the test with `update: true` (apps wire it to an env var, e.g. `EVENT_MAP_UPDATE=1 bun run test`); the file is written
 * and `{ state: 'written' }` comes back, which also fails an expectation of `fresh`, so an update never passes quietly in CI.
 */
export async function checkEventMapFile(options) {
    const current = await readFile(options.file, 'utf8').then(text => text, () => null);
    if (current === options.mermaid)
        return { state: 'fresh' };
    if (options.update === true) {
        await mkdir(path.dirname(options.file), { recursive: true });
        await writeFile(options.file, options.mermaid);
        return { state: 'written' };
    }
    if (current === null)
        return { state: 'missing', diff: lineDiff([], options.mermaid.split('\n')) };
    return { state: 'stale', diff: lineDiff(current.split('\n'), options.mermaid.split('\n')) };
}
//# sourceMappingURL=event-map.js.map