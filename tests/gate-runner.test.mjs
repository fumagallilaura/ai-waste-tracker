import { test } from 'node:test';
import assert from 'node:assert';
import { mkdtemp, rm } from 'node:fs/promises';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { runGate, runGates } from '../scripts/gate-runner.mjs';

let testDir;

test.beforeEach(async () => {
  testDir = await mkdtemp(path.join(tmpdir(), 'gate-runner-test-'));
});

test.afterEach(async () => {
  await rm(testDir, { recursive: true, force: true });
});

test('runGate passes on successful command', async () => {
  const runDir = path.join(testDir, 'run1');
  const result = await runGate({
    root: '.',
    runDir,
    gate: 'test',
    command: 'echo "ok"',
  });
  assert.equal(result.outcome, 'passed');
  assert.equal(result.gate, 'test');
  assert.equal(result.blocking, true);
  assert.equal(result.next_action, 'continue');
});

test('runGate fails on failed command', async () => {
  const runDir = path.join(testDir, 'run2');
  const result = await runGate({
    root: '.',
    runDir,
    gate: 'test',
    command: 'exit 1',
  });
  assert.equal(result.outcome, 'failed');
  assert.equal(result.gate, 'test');
  assert.equal(result.blocking, true);
  assert.equal(result.next_action, 'return to implementation');
});

test('runGate skips when no command provided', async () => {
  const runDir = path.join(testDir, 'run3');
  const result = await runGate({
    root: '.',
    runDir,
    gate: 'lint',
    command: '',
  });
  assert.equal(result.outcome, 'skipped');
  assert.equal(result.gate, 'lint');
});

test('runGate persists result to checks.json', async () => {
  const runDir = path.join(testDir, 'run4');
  await runGate({
    root: '.',
    runDir,
    gate: 'test',
    command: 'echo "ok"',
  });
  
  const { readFile } = await import('node:fs/promises');
  const checks = JSON.parse(await readFile(path.join(runDir, 'checks.json'), 'utf8'));
  assert.equal(checks.length, 1);
  assert.equal(checks[0].gate, 'test');
  assert.equal(checks[0].outcome, 'passed');
});

test('runGates passes when all gates pass', async () => {
  const runDir = path.join(testDir, 'run5');
  const result = await runGates({
    root: '.',
    runDir,
    gates: ['lint', 'test'],
    commands: { lint: 'echo ok', test: 'echo ok' },
  });
  assert.equal(result.outcome, 'passed');
  assert.equal(result.results.length, 2);
  assert.equal(result.next_action, 'continue workflow');
});

test('runGates blocks on blocking gate failure', async () => {
  const runDir = path.join(testDir, 'run6');
  const result = await runGates({
    root: '.',
    runDir,
    gates: ['lint', 'test'],
    commands: { lint: 'exit 1', test: 'echo ok' },
  });
  assert.equal(result.outcome, 'blocked');
  assert.equal(result.blocked_by, 'lint');
  assert.equal(result.results.length, 1);
  assert.equal(result.next_action, 'return to implementation');
});

test('runGates continues on non-blocking gate failure', async () => {
  const runDir = path.join(testDir, 'run7');
  const result = await runGates({
    root: '.',
    runDir,
    gates: ['git-status', 'test'],
    commands: { 'git-status': 'exit 1', test: 'echo ok' },
  });
  assert.equal(result.outcome, 'passed');
  assert.equal(result.results.length, 2);
});

test('runGates handles missing commands gracefully', async () => {
  const runDir = path.join(testDir, 'run8');
  const result = await runGates({
    root: '.',
    runDir,
    gates: ['lint', 'test'],
    commands: {},
  });
  assert.equal(result.outcome, 'passed');
  assert.equal(result.results[0].outcome, 'skipped');
  assert.equal(result.results[1].outcome, 'skipped');
});
