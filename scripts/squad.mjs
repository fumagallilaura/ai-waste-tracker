#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { mkdir, readFile, readdir, rm, stat, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { createInterface } from 'node:readline/promises';
import path from 'node:path';
import process from 'node:process';
import { contributeTelemetry, contributionPreview, disableTelemetry, exportTelemetry, purgeTelemetry } from './telemetry.mjs';
import { discoverProject } from './project-discovery.mjs';

const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const packageInfo = JSON.parse(await readFile(path.join(packageRoot, 'package.json'), 'utf8'));
const targets = ['codex', 'claude', 'opencode', 'devin', 'vscode'];
const manifestPath = (root) => path.join(root, '.squad', 'install-manifest.json');
const configPath = (root) => path.join(root, '.squad', 'config.yaml');
const digest = (value) => createHash('sha256').update(value).digest('hex');
const relative = (root, file) => path.relative(root, file).replaceAll(path.sep, '/');

function usage() {
  return `Usage: squad [install|update|uninstall|doctor|list|telemetry] [options]

Commands:
  install       Install artifacts into a project (default when arguments are supplied)
  update        Update only files previously installed by squad
  uninstall     Remove only files recorded in the install manifest
  doctor        Check Node, target assets and local squad configuration
  list          List supported targets
  telemetry     Local telemetry: export, purge, disable or contribute through a PR

Options:
  --dir <path>       Project directory (default: current directory)
  --target <name>    ${targets.join('|')}|all
  --repo <owner/name> Metrics repository for telemetry contribution
  --yes              Do not ask for installation confirmation
  --no-init          Do not run the local squad initialization scaffold
  --dry-run          Report changes without writing
  --force            Replace changed, squad-owned artifact files
  --version          Print version
  --help             Print this help`;
}

function parseArgs(values) {
  const args = { command: null, dir: process.cwd(), target: null, yes: false, init: true, dryRun: false, force: false };
  const first = values[0];
  if (['install', 'update', 'uninstall', 'doctor', 'list', 'telemetry'].includes(first)) args.command = values.shift();
  for (let index = 0; index < values.length; index += 1) {
    const value = values[index];
    if (args.command === 'telemetry' && ['export', 'purge', 'disable', 'contribute'].includes(value)) { args.telemetryAction = value; continue; }
    if (value === '--dir') args.dir = path.resolve(values[++index] ?? '');
    else if (value.startsWith('--dir=')) args.dir = path.resolve(value.slice(6));
    else if (value === '--target') args.target = values[++index];
    else if (value.startsWith('--target=')) args.target = value.slice(9);
    else if (value === '--yes') args.yes = true;
    else if (value === '--output') args.output = path.resolve(values[++index] ?? '');
    else if (value.startsWith('--output=')) args.output = path.resolve(value.slice(9));
    else if (value === '--repo') args.repository = values[++index];
    else if (value.startsWith('--repo=')) args.repository = value.slice(7);
    else if (value === '--no-init') args.init = false;
    else if (value === '--dry-run') args.dryRun = true;
    else if (value === '--force') args.force = true;
    else if (value === '--help' || value === '-h') args.help = true;
    else if (value === '--version' || value === '-v') args.version = true;
    else throw new Error(`Unknown option: ${value}`);
  }
  return args;
}

async function exists(file) { try { await stat(file); return true; } catch { return false; } }
async function text(file) { return readFile(file, 'utf8'); }
async function loadManifest(root) { try { return JSON.parse(await text(manifestPath(root))); } catch { return { schema_version: 1, files: {} }; } }
async function saveManifest(root, manifest, dryRun) {
  if (dryRun) return;
  await mkdir(path.dirname(manifestPath(root)), { recursive: true });
  await writeFile(manifestPath(root), `${JSON.stringify(manifest, null, 2)}\n`);
}

async function filesIn(root) {
  const results = [];
  async function walk(current) {
    for (const entry of await readdir(current, { withFileTypes: true })) {
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) await walk(full); else if (entry.isFile()) results.push(full);
    }
  }
  if (await exists(root)) {
    if ((await stat(root)).isFile()) results.push(root); else await walk(root);
  }
  return results;
}

const assetMap = {
  codex: ['.codex/config.toml', '.codex/agents', '.agents/skills/squad-init', '.agents/skills/squad-plan', '.agents/skills/squad-feature', '.agents/skills/squad-execute', '.agents/skills/squad-review', '.agents/skills/squad-test', '.agents/skills/squad-debug', '.agents/skills/squad-finish', '.agents/skills/squad-status', '.agents/skills/squad-resume', '.agents/skills/squad-next', '.agents/skills/squad-yolo', '.workflow/template'],
  claude: ['.claude/agents', '.claude/settings.json', '.claude/skills', '.workflow/template'],
  opencode: ['.opencode/agents', '.opencode/commands', '.opencode/epic-guide.md', 'opencode.json', '.agents/skills', '.workflow/template'],
  devin: ['.devin/agents', '.devin/config.json', '.devin/README.md', '.agents/skills/squad-init', '.agents/skills/squad-plan', '.agents/skills/squad-feature', '.agents/skills/squad-execute', '.agents/skills/squad-review', '.agents/skills/squad-test', '.agents/skills/squad-debug', '.agents/skills/squad-finish', '.agents/skills/squad-status', '.agents/skills/squad-resume', '.agents/skills/squad-next', '.agents/skills/squad-yolo', '.workflow/template'],
  vscode: ['.github/agents', '.github/skills'],
};
const jsonAssets = new Set(['.claude/settings.json', '.devin/config.json', 'opencode.json']);
const tomlAssets = new Set(['.codex/config.toml']);

function mergeJson(existing, incoming) {
  if (Array.isArray(existing) && Array.isArray(incoming)) return [...new Set([...existing, ...incoming])];
  if (existing && incoming && typeof existing === 'object' && typeof incoming === 'object') {
    const merged = { ...existing };
    for (const [key, value] of Object.entries(incoming)) merged[key] = key in merged ? mergeJson(merged[key], value) : value;
    return merged;
  }
  return existing;
}

function mergeToml(existing, incoming) {
  const output = existing.trimEnd();
  const additions = incoming.split(/\r?\n/).filter((line) => line && !line.startsWith('#') && !output.includes(line));
  return `${output}${additions.length ? `\n${additions.join('\n')}` : ''}\n`;
}

async function writeManagedBlock(root, target, dryRun) {
  const file = path.join(root, target === 'claude' ? 'CLAUDE.md' : 'AGENTS.md');
  const start = `<!-- orchestrated-squad:${target}:start -->`;
  const end = `<!-- orchestrated-squad:${target}:end -->`;
  const block = `${start}\n## Orchestrated Squad\n\nUse the installed \`squad-*\` workflow commands. The root session owns orchestration and \`.workflow/\` is canonical state. For every LLM workflow phase, the root must invoke the platform-native specialist subagent; it may only inspect state, coordinate transitions, and run deterministic gates itself. Specialists must not delegate again. Preserve instructions outside this managed block.\n${end}`;
  let existing = ''; try { existing = await text(file); } catch { /* first install */ }
  const pattern = new RegExp(`${start.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}[\\s\\S]*?${end.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'g');
  const merged = pattern.test(existing) ? existing.replace(pattern, block) : `${existing.trimEnd()}${existing.trim() ? '\n\n' : ''}${block}\n`;
  if (!dryRun) await writeFile(file, merged);
  return { file: relative(root, file), start, end, hash: digest(block) };
}

async function installFile(source, root, manifest, options) {
  const rel = relative(packageRoot, source);
  const destination = path.join(root, rel);
  const incoming = await readFile(source);
  const incomingHash = digest(incoming);
  let existing = null;
  if (await exists(destination)) existing = await readFile(destination);
  const installed = manifest.files[rel];
  if (existing && jsonAssets.has(rel)) {
    try {
      const merged = `${JSON.stringify(mergeJson(JSON.parse(existing), JSON.parse(incoming)), null, 2)}\n`;
      if (!options.dryRun) { await mkdir(path.dirname(destination), { recursive: true }); await writeFile(destination, merged); }
      manifest.files[rel] = { hash: digest(merged), target: options.target };
      return 'merged';
    } catch { return 'skipped-invalid-json'; }
  }
  if (existing && tomlAssets.has(rel)) {
    const merged = mergeToml(existing.toString(), incoming.toString());
    if (!options.dryRun) { await mkdir(path.dirname(destination), { recursive: true }); await writeFile(destination, merged); }
    manifest.files[rel] = { hash: digest(merged), target: options.target };
    return 'merged';
  }
  if (existing && !options.force && (!installed || installed.hash !== digest(existing))) return 'preserved-user-change';
  if (!options.dryRun) { await mkdir(path.dirname(destination), { recursive: true }); await writeFile(destination, incoming); }
  manifest.files[rel] = { hash: incomingHash, target: options.target };
  return existing ? 'updated' : 'created';
}

async function initialize(root, dryRun) {
  const file = configPath(root);
  if (await exists(file)) return false;
  if (!dryRun) {
    await mkdir(path.dirname(file), { recursive: true });
    const discovery = await discoverProject(root);
    const gatesConfig = Object.entries(discovery.gates ?? {}).map(([name, cfg]) => `  ${name}:\n    command: "${cfg.command}"\n    blocking: ${name === 'git-status' ? 'false' : 'true'}\n    auto_detect: true`).join('\n');
    await writeFile(file, `schema_version: 1.0\ndiscovery:\n  confidence: ${discovery.confidence}\n  languages: [${discovery.languages.join(', ')}]\ngates:\n${gatesConfig || '  # No gates auto-detected. Add manually, e.g.:\n  # lint:\n  #   command: "npm run lint"\n  #   blocking: true'}\nwork_items:\n  provider: none\n  publish: manual\n  project: null\n  require_confirmation: true\n`);
    await mkdir(path.join(root, '.workflow'), { recursive: true });
  }
  return true;
}

async function install(options, { update = false } = {}) {
  const chosen = options.target === 'all' ? targets : [options.target ?? 'codex'];
  if (chosen.some((target) => !targets.includes(target))) throw new Error(`Invalid target: ${options.target}`);
  const root = path.resolve(options.dir);
  if (!(await exists(root))) throw new Error(`Project directory not found: ${root}`);
  const manifest = await loadManifest(root);
  const changes = [];
  for (const target of chosen) {
    for (const asset of assetMap[target]) {
      const sourcePath = path.join(packageRoot, asset);
      for (const source of await filesIn(sourcePath)) {
        const result = await installFile(source, root, manifest, { ...options, target, force: update ? false : options.force });
        changes.push({ file: relative(packageRoot, source), result });
      }
    }
    const block = await writeManagedBlock(root, target, options.dryRun);
    manifest.blocks ??= {};
    manifest.blocks[`${target}:${block.file}`] = block;
    changes.push({ file: block.file, result: 'managed-block' });
  }
  manifest.schema_version = 1; manifest.package = packageInfo.name; manifest.version = packageInfo.version; manifest.targets = [...new Set([...(manifest.targets ?? []), ...chosen])];
  if (!update && options.init && await initialize(root, options.dryRun)) {
    manifest.files['.squad/config.yaml'] = { hash: digest(await readFile(configPath(root))), target: 'core' };
    changes.push({ file: '.squad/config.yaml', result: 'initialized' });
  }
  await saveManifest(root, manifest, options.dryRun);
  return changes;
}

async function uninstall(options) {
  const root = path.resolve(options.dir); const manifest = await loadManifest(root); const removed = [];
  for (const [file, record] of Object.entries(manifest.files)) {
    const destination = path.join(root, file);
    if (!(await exists(destination))) continue;
    const current = await readFile(destination);
    if (digest(current) !== record.hash) { removed.push({ file, result: 'preserved-user-change' }); continue; }
    if (!options.dryRun) await rm(destination);
    removed.push({ file, result: 'removed' }); delete manifest.files[file];
  }
  for (const block of Object.values(manifest.blocks ?? {})) {
    const destination = path.join(root, block.file);
    if (!(await exists(destination))) continue;
    const content = await text(destination);
    const pattern = new RegExp(`${block.start.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}[\\s\\S]*?${block.end.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\n?`, 'g');
    const match = content.match(pattern)?.[0];
    if (!match || digest(match.trimEnd()) !== block.hash) { removed.push({ file: block.file, result: 'preserved-user-change' }); continue; }
    if (!options.dryRun) {
      const next = content.replace(pattern, '').replace(/\n{3,}/g, '\n\n');
      if (next.trim()) await writeFile(destination, next); else await rm(destination);
    }
    removed.push({ file: block.file, result: 'managed-block-removed' });
  }
  if (!options.dryRun) await rm(manifestPath(root), { force: true });
  return removed;
}

async function doctor(options) {
  const major = Number(process.versions.node.split('.')[0]);
  const checks = [{ name: 'node', ok: major === 22 || major === 24, detail: process.version }];
  for (const target of targets) checks.push({ name: `assets:${target}`, ok: await exists(path.join(packageRoot, assetMap[target][0])), detail: assetMap[target][0] });
  if (await exists(options.dir)) checks.push({ name: 'project', ok: true, detail: path.resolve(options.dir) });
  return checks;
}

async function interactiveInstall(args, { selectTarget = true } = {}) {
  const prompt = createInterface({ input: process.stdin, output: process.stdout });
  try {
    const answer = selectTarget ? (await prompt.question(`Target (${targets.join('/')}/all) [codex]: `)).trim() : (args.target ?? 'codex');
    args.target = answer || 'codex';
    if (![...targets, 'all'].includes(args.target)) throw new Error(`Invalid target: ${args.target}`);
    const confirmed = (await prompt.question(`Install orchestrated-squad for ${args.target} in ${args.dir}? [y/N] `)).trim().toLowerCase();
    if (!['y', 'yes'].includes(confirmed)) throw new Error('Installation cancelled.');
    args.yes = true;
  } finally { prompt.close(); }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.version) return console.log(packageInfo.version);
  if (args.help) return console.log(usage());
  if (!args.command) {
    if (!process.stdin.isTTY) throw new Error('Specify a command when stdin is not interactive.');
    args.command = 'install'; await interactiveInstall(args);
  } else if (args.command === 'install' && !args.yes && !args.dryRun) {
    if (!process.stdin.isTTY) throw new Error('Pass --yes for a non-interactive installation.');
    await interactiveInstall(args, { selectTarget: !args.target });
  }
  if (args.command === 'list') return console.log(targets.join('\n'));
  if (args.command === 'telemetry') {
    const action = args.telemetryAction ?? 'export';
    const result = action === 'purge' ? await purgeTelemetry(args.dir) : action === 'disable' ? await disableTelemetry(args.dir) : action === 'contribute' ? (args.dryRun ? { ...(await contributionPreview(args.dir)), dry_run: true } : await contributeTelemetry(args.dir, { repository: args.repository })) : await exportTelemetry(args.dir, args.output);
    if (action === 'contribute' && args.output) await writeFile(args.output, `${JSON.stringify(result, null, 2)}\n`);
    return console.log(JSON.stringify(result ?? { action }, null, 2));
  }
  const result = args.command === 'doctor' ? await doctor(args) : args.command === 'uninstall' ? await uninstall(args) : await install(args, { update: args.command === 'update' });
  console.log(JSON.stringify(result, null, 2));
  if (args.command === 'doctor' && result.some((check) => !check.ok)) process.exitCode = 1;
}

main().catch((error) => { console.error(`squad: ${error.message}`); process.exitCode = 1; });
