import { test } from 'node:test';
import assert from 'node:assert';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { discoverProject } from '../scripts/project-discovery.mjs';

let testDir;

test.beforeEach(async () => {
  testDir = await mkdtemp(path.join(tmpdir(), 'project-discovery-test-'));
});

test.afterEach(async () => {
  await rm(testDir, { recursive: true, force: true });
});

test('detects Node.js project commands from package.json', async () => {
  await writeFile(path.join(testDir, 'package.json'), JSON.stringify({
    scripts: {
      lint: 'eslint .',
      test: 'jest',
      build: 'tsc',
    },
  }));
  
  const result = await discoverProject(testDir);
  assert.ok(result.languages.includes('node'));
  assert.ok(result.commands.some(c => c.name === 'lint' && c.command === 'eslint .'));
  assert.ok(result.commands.some(c => c.name === 'test' && c.command === 'jest'));
  assert.ok(result.gates.lint);
  assert.ok(result.gates.test);
});

test('detects Python project commands from pyproject.toml', async () => {
  await writeFile(path.join(testDir, 'pyproject.toml'), `
[tool.ruff]
line-length = 120

[tool.pytest.ini_options]
testpaths = ["tests"]
`);
  
  const result = await discoverProject(testDir);
  assert.ok(result.languages.includes('python'));
  assert.ok(result.commands.some(c => c.name === 'lint' && c.command === 'ruff check .'));
  assert.ok(result.commands.some(c => c.name === 'test' && c.command === 'pytest'));
});

test('detects Rust project commands from Cargo.toml', async () => {
  await writeFile(path.join(testDir, 'Cargo.toml'), '[package]\nname = "test"\n');
  
  const result = await discoverProject(testDir);
  assert.ok(result.languages.includes('rust'));
  assert.ok(result.commands.some(c => c.name === 'lint' && c.command.includes('clippy')));
  assert.ok(result.commands.some(c => c.name === 'test' && c.command === 'cargo test'));
});

test('detects Go project commands from go.mod', async () => {
  await writeFile(path.join(testDir, 'go.mod'), 'module test\n');
  
  const result = await discoverProject(testDir);
  assert.ok(result.languages.includes('go'));
  assert.ok(result.commands.some(c => c.name === 'test' && c.command === 'go test ./...'));
});

test('detects Makefile commands', async () => {
  await writeFile(path.join(testDir, 'Makefile'), `
lint:
\truff check .

test:
\tpytest

build:
\tcargo build
`);
  
  const result = await discoverProject(testDir);
  assert.ok(result.commands.some(c => c.name === 'lint' && c.command === 'make lint'));
  assert.ok(result.commands.some(c => c.name === 'test' && c.command === 'make test'));
});

test('deduplicates commands across sources', async () => {
  await writeFile(path.join(testDir, 'package.json'), JSON.stringify({
    scripts: { lint: 'eslint .', test: 'jest' },
  }));
  await writeFile(path.join(testDir, 'Makefile'), `
lint:
\teslint .
test:
\tjest
`);
  
  const result = await discoverProject(testDir);
  const lintCommands = result.commands.filter(c => c.name === 'lint');
  const testCommands = result.commands.filter(c => c.name === 'test');
  assert.equal(lintCommands.length, 1);
  assert.equal(testCommands.length, 1);
});

test('returns empty gates for unknown project', async () => {
  const result = await discoverProject(testDir);
  assert.equal(result.languages.length, 0);
  assert.equal(result.confidence, 'unknown');
  assert.ok(result.questions.length > 0);
});

test('detects mypy for Python type checking', async () => {
  await writeFile(path.join(testDir, 'pyproject.toml'), `
[tool.mypy]
strict = true
`);
  
  const result = await discoverProject(testDir);
  assert.ok(result.commands.some(c => c.name === 'typecheck' && c.command === 'mypy .'));
  assert.ok(result.gates.typecheck);
});
