import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';

async function present(file) { try { return (await stat(file)).isFile(); } catch { return false; } }
async function json(file) { try { return JSON.parse(await readFile(file, 'utf8')); } catch { return {}; } }
async function text(file) { try { return await readFile(file, 'utf8'); } catch { return ''; } }

async function detectNodeCommands(root, pkg) {
  const commands = [];
  for (const [name, command] of Object.entries(pkg.scripts ?? {})) {
    if (['lint', 'test', 'build', 'typecheck', 'format'].includes(name)) {
      commands.push({ name, command, confidence: 'confirmed', source: 'package.json' });
    }
  }
  return commands;
}

async function detectPythonCommands(root) {
  const commands = [];
  const pyprojectPath = path.join(root, 'pyproject.toml');
  const setupPath = path.join(root, 'setup.cfg');
  const requirementsPath = path.join(root, 'requirements-dev.txt');
  const pyproject = await present(pyprojectPath) ? await text(pyprojectPath) : '';
  const setup = await present(setupPath) ? await text(setupPath) : '';
  const requirements = await present(requirementsPath) ? await text(requirementsPath) : '';

  // Lint detection
  if (pyproject.includes('[tool.ruff]') || pyproject.includes('ruff') || setup.includes('ruff') || requirements.includes('ruff')) {
    commands.push({ name: 'lint', command: 'ruff check .', confidence: 'confirmed', source: 'pyproject.toml' });
  } else if (pyproject.includes('[tool.flake8]') || setup.includes('[flake8]') || requirements.includes('flake8')) {
    commands.push({ name: 'lint', command: 'flake8 .', confidence: 'confirmed', source: 'pyproject.toml' });
  } else if (pyproject.includes('[tool.pylint]') || requirements.includes('pylint')) {
    commands.push({ name: 'lint', command: 'pylint .', confidence: 'confirmed', source: 'pyproject.toml' });
  }

  // Test detection
  if (pyproject.includes('[tool.pytest]') || pyproject.includes('pytest') || requirements.includes('pytest')) {
    commands.push({ name: 'test', command: 'pytest', confidence: 'confirmed', source: 'pyproject.toml' });
  } else if (pyproject.includes('[tool.unittest]') || requirements.includes('unittest')) {
    commands.push({ name: 'test', command: 'python -m unittest discover', confidence: 'confirmed', source: 'pyproject.toml' });
  }

  // Typecheck detection
  if (pyproject.includes('[tool.mypy]') || pyproject.includes('mypy') || requirements.includes('mypy')) {
    commands.push({ name: 'typecheck', command: 'mypy .', confidence: 'confirmed', source: 'pyproject.toml' });
  }

  return commands;
}

async function detectRustCommands(root) {
  if (await present(path.join(root, 'Cargo.toml'))) {
    return [
      { name: 'lint', command: 'cargo clippy -- -D warnings', confidence: 'confirmed', source: 'Cargo.toml' },
      { name: 'test', command: 'cargo test', confidence: 'confirmed', source: 'Cargo.toml' },
      { name: 'build', command: 'cargo build', confidence: 'confirmed', source: 'Cargo.toml' },
    ];
  }
  return [];
}

async function detectGoCommands(root) {
  if (await present(path.join(root, 'go.mod'))) {
    const commands = [
      { name: 'test', command: 'go test ./...', confidence: 'confirmed', source: 'go.mod' },
      { name: 'build', command: 'go build ./...', confidence: 'confirmed', source: 'go.mod' },
    ];
    // golangci-lint detection
    const golangciConfig = await present(path.join(root, '.golangci.yml')) || await present(path.join(root, '.golangci.yaml'));
    if (golangciConfig) {
      commands.push({ name: 'lint', command: 'golangci-lint run', confidence: 'confirmed', source: '.golangci.yml' });
    }
    return commands;
  }
  return [];
}

async function detectJavaCommands(root) {
  const commands = [];
  if (await present(path.join(root, 'pom.xml'))) {
    const pom = await text(path.join(root, 'pom.xml'));
    commands.push({ name: 'test', command: 'mvn test', confidence: 'confirmed', source: 'pom.xml' });
    commands.push({ name: 'build', command: 'mvn compile', confidence: 'confirmed', source: 'pom.xml' });
    if (pom.includes('checkstyle')) {
      commands.push({ name: 'lint', command: 'mvn checkstyle:check', confidence: 'confirmed', source: 'pom.xml' });
    }
  }
  if (await present(path.join(root, 'build.gradle'))) {
    commands.push({ name: 'test', command: './gradlew test', confidence: 'confirmed', source: 'build.gradle' });
    commands.push({ name: 'build', command: './gradlew build', confidence: 'confirmed', source: 'build.gradle' });
  }
  return commands;
}

async function detectRubyCommands(root) {
  if (await present(path.join(root, 'Gemfile'))) {
    const commands = [
      { name: 'test', command: 'bundle exec rspec', confidence: 'confirmed', source: 'Gemfile' },
    ];
    const gemfile = await text(path.join(root, 'Gemfile'));
    if (gemfile.includes('rubocop')) {
      commands.push({ name: 'lint', command: 'bundle exec rubocop', confidence: 'confirmed', source: 'Gemfile' });
    }
    return commands;
  }
  return [];
}

async function detectMakefileCommands(root) {
  const commands = [];
  if (await present(path.join(root, 'Makefile'))) {
    const makefile = await text(path.join(root, 'Makefile'));
    const targets = ['lint', 'test', 'build', 'check', 'typecheck', 'format'];
    for (const target of targets) {
      if (makefile.match(new RegExp(`^${target}:`, 'm'))) {
        commands.push({ name: target, command: `make ${target}`, confidence: 'confirmed', source: 'Makefile' });
      }
    }
  }
  return commands;
}

export async function discoverProject(root) {
  const packageFile = path.join(root, 'package.json');
  const python = await present(path.join(root, 'pyproject.toml')) || await present(path.join(root, 'setup.cfg'));
  const node = await present(packageFile);
  const pkg = node ? await json(packageFile) : {};
  const languages = [
    node && 'node',
    python && 'python',
    await present(path.join(root, 'Cargo.toml')) && 'rust',
    await present(path.join(root, 'go.mod')) && 'go',
    (await present(path.join(root, 'pom.xml')) || await present(path.join(root, 'build.gradle'))) && 'java',
    await present(path.join(root, 'Gemfile')) && 'ruby',
  ].filter(Boolean);

  const commands = [
    ...(node ? await detectNodeCommands(root, pkg) : []),
    ...(python ? await detectPythonCommands(root) : []),
    ...await detectRustCommands(root),
    ...await detectGoCommands(root),
    ...await detectJavaCommands(root),
    ...await detectRubyCommands(root),
    ...await detectMakefileCommands(root),
  ];

  // Deduplicate by name (first wins)
  const seen = new Set();
  const uniqueCommands = commands.filter(cmd => {
    if (seen.has(cmd.name)) return false;
    seen.add(cmd.name);
    return true;
  });

  return {
    languages,
    confidence: languages.length ? 'confirmed' : 'unknown',
    commands: uniqueCommands,
    gates: uniqueCommands.reduce((acc, cmd) => {
      if (['lint', 'test', 'build', 'typecheck'].includes(cmd.name)) {
        acc[cmd.name] = { command: cmd.command, source: cmd.source };
      }
      return acc;
    }, {}),
    questions: languages.length ? [] : ['Which language, framework and validation commands does this project use?'],
  };
}
