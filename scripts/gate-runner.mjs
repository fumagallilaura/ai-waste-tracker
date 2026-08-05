import { spawn } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { appendEvent } from './workflow-state.mjs';

const GATE_REGISTRY = {
  lint: { description: 'Static analysis and linting', blocking: true },
  test: { description: 'Test execution', blocking: true },
  'git-status': { description: 'Git working tree status', blocking: false },
  build: { description: 'Build verification', blocking: true },
  typecheck: { description: 'Type checking', blocking: true },
  format: { description: 'Code formatting check', blocking: false },
};

async function executeCommand(command, cwd) {
  return new Promise((resolve) => {
    const child = spawn(command, { cwd, shell: true, windowsHide: true });
    let output = '';
    child.stdout.on('data', (chunk) => { output += chunk; });
    child.stderr.on('data', (chunk) => { output += chunk; });
    child.on('close', (exitCode) => resolve({ exitCode: exitCode ?? 1, output: output.trim() }));
  });
}

export async function runGate({ root, runDir, gate, command }) {
  const gateConfig = GATE_REGISTRY[gate] ?? { description: gate, blocking: false };

  if (!command) {
    const result = {
      schema_version: '1.0',
      gate,
      outcome: 'skipped',
      blocking: gateConfig.blocking,
      summary: `No command configured for gate "${gate}"`,
      next_action: 'continue',
      started_at: new Date().toISOString(),
      completed_at: new Date().toISOString(),
    };
    return result;
  }

  const startedAt = new Date().toISOString();
  const execution = await executeCommand(command, root);
  const passed = execution.exitCode === 0;

  const result = {
    schema_version: '1.0',
    gate,
    outcome: passed ? 'passed' : 'failed',
    blocking: gateConfig.blocking,
    summary: passed ? `${gate} passed` : `${gate} failed`,
    evidence: [{ command, exit_code: execution.exitCode }],
    output: execution.output.slice(0, 5000), // Limit output size
    started_at: startedAt,
    completed_at: new Date().toISOString(),
    next_action: passed ? 'continue' : (gateConfig.blocking ? 'return to implementation' : 'continue'),
  };

  // Persist result
  await mkdir(runDir, { recursive: true });
  const checksPath = path.join(runDir, 'checks.json');
  let checks = [];
  try { checks = JSON.parse(await readFile(checksPath, 'utf8')); } catch { /* first gate */ }
  checks.push(result);
  await writeFile(checksPath, `${JSON.stringify(checks, null, 2)}\n`);
  await appendEvent(runDir, { type: 'gate_completed', gate, exit_code: execution.exitCode, outcome: result.outcome });

  return result;
}

export async function runGates({ root, runDir, gates, commands }) {
  const results = [];

  for (const gate of gates) {
    const command = commands[gate];
    const result = await runGate({ root, runDir, gate, command });
    results.push(result);

    // If blocking gate failed, stop execution
    if (result.blocking && result.outcome === 'failed') {
      return {
        schema_version: '1.0',
        outcome: 'blocked',
        blocked_by: gate,
        results,
        next_action: 'return to implementation',
      };
    }
  }

  return {
    schema_version: '1.0',
    outcome: 'passed',
    results,
    next_action: 'continue workflow',
  };
}

// CLI interface
if (process.argv[1]?.endsWith('gate-runner.mjs')) {
  const getArg = (name) => {
    const idx = process.argv.indexOf(name);
    return idx === -1 ? undefined : process.argv[idx + 1];
  };

  const root = getArg('--root') ?? process.cwd();
  const runDir = getArg('--run');
  const gatesArg = getArg('--gates') ?? 'lint,test';
  const gates = gatesArg.split(',').map(g => g.trim()).filter(Boolean);

  const commands = {};
  for (let i = 0; i < process.argv.length; i++) {
    if (process.argv[i].startsWith('--command-')) {
      const gate = process.argv[i].replace('--command-', '');
      commands[gate] = process.argv[i + 1];
    }
  }

  if (!runDir) {
    console.error('Usage: node scripts/gate-runner.mjs --root <root> --run <run-dir> --gates lint,test --command-lint "ruff check ." --command-test "pytest"');
    process.exit(1);
  }

  const result = await runGates({ root, runDir, gates, commands });
  console.log(JSON.stringify(result, null, 2));

  process.exit(result.outcome === 'passed' ? 0 : 1);
}
