# Análise de Eficiência — orchestrated-squad

**Data:** 05/08/2026
**Escopo:** Eficiência dos agentes, orquestração, harnessing e custos
**Versão analisada:** 0.7.2

---

## 1. Arquitetura Atual

### 1.1 Agentes Definidos

| # | Agente | Class (registry) | Model (Claude) | MaxTurns | Write Scope |
|---|--------|------------------|----------------|----------|-------------|
| 1 | planner | standard | sonnet | 20 | none |
| 2 | product-manager | standard | sonnet | 20 | none |
| 3 | requirements-reviewer | standard | sonnet | 10 | none |
| 4 | tech-analyst | **premium** | **sonnet** ⚠️ | 15 | none |
| 5 | doc-writer | economy | haiku | 15 | scoped |
| 6 | issue-creator | deterministic | haiku | 10 | none |
| 7 | implementer | standard | sonnet | 30 | scoped |
| 8 | sre | **premium** | **sonnet** ⚠️ | 25 | scoped |
| 9 | reviewer | **premium** | **sonnet** ⚠️ | 10 | none |
| 10 | linter | deterministic | haiku | 8 | none |
| 11 | tester | standard | **haiku** ⚠️ | 20 | scoped |
| 12 | bug-triager | standard | sonnet | 15 | none |
| 13 | finisher | standard | sonnet | 15 | scoped |

### 1.2 Workflow por Issue

```
PM → RR → doc-writer → tech-analyst → doc-writer → issue-creator
    → implementer (+ sre) → reviewer → linter → tester → doc-writer → finisher
```

**Total: 12-13 transições de agentes por issue**, cada uma com handoff obrigatório.

---

## 2. Problemas Críticos Identificados

### 2.0 Gates Determinísticos: Declarados mas Não Executados ⚠️⚠️⚠️

**Este é o problema mais sério da arquitetura atual.**

**O que existe:**
- `squad/gates/registry.json` — declara gates
- `scripts/workflow-gates.mjs` — implementa `runGate()` (script standalone)
- `squad/commands/*.json` — lista gates como metadata

**O que está quebrado:**

| Gate | command_key | Comando real | Status |
|------|-------------|--------------|--------|
| lint | `"lint"` | ❌ não definido | Inútil |
| test | `"test"` | ❌ não definido | Inútil |
| git-status | — | `"git status --short"` | Funciona |
| work-item-publisher | — | `scripts/workflow-gates.mjs` | Nunca invocado |
| git-pr | — | `scripts/git-pr.mjs` | Nunca invocado |

**Consequência:** O workflow assume que gates estão sendo executados, mas não há:
1. Invocação automática nas transições de fase
2. Descoberta de comandos do projeto (package.json, pyproject.toml)
3. Bloqueio do workflow em caso de falha
4. Integração entre o gate e o agente linter/tester

**O que deveria existir:**

```yaml
# .squad/config.yaml — comandos descobertos automaticamente
gates:
  lint:
    command: "npm run lint"  # ou "ruff check ." ou "biome check ."
    auto_detect: true
  test:
    command: "npm test"  # ou "pytest" ou "cargo test"
    auto_detect: true
  git-status:
    command: "git status --short"
```

**E o workflow deveria:**

```
implementer → [GATE: lint] → se passou → [GATE: test] → se passou → reviewer
                  ↓ falhou                         ↓ falhou
                  implementer                    implementer
```

**Impacto na eficiência:**
- Sem gates automáticos, bugs passam para o reviewer (que usa premium)
- Reviewer gasta tokens corrigindo problemas que um script detectaria
- Estimativa: **30-40% do custo do reviewer é detectável por gates determinísticos**

---

### 2.1 Inconsistências Registry vs Implementação

| Agente | Registry diz | Implementação real | Impacto |
|--------|--------------|-------------------|---------|
| tech-analyst | **premium** | sonnet (standard) | Arquitetura fraca = retrabalho caro |
| reviewer | **premium** | sonnet (standard) | Segurança/correção comprometida |
| sre | **premium** | sonnet (standard) | Infraestrutura de produção em risco |
| tester | standard | haiku (economy) | Testes mal gerados = falsos positivos |

**Recomendação:** Alinhar implementações com o registry OU atualizar registry para refletir a realidade. O registry está correto — tech-analyst, reviewer e sre **devem** ser premium.

### 2.2 Excesso de Agentes (13 é Demais)

**Problema:** Cada agente = nova sessão = contexto do zero = custo multiplicado.

**Agentes que poderiam ser eliminados/consolidados:**

| Agente atual | Solução | Economia |
|--------------|---------|----------|
| issue-creator | Script determinístico (`gh issue create --template`) | ~100% do custo LLM |
| finisher | Script determinístico (conventional commit + gh pr create) | ~100% do custo LLM |
| linter | Já é determinístico, mas tratado como agente | Overhead de sessão |
| PM + requirements-reviewer | Um agente com modo "revisão interna" | 50% das transições |
| doc-writer (changelog) | Script a partir de conventional commits | ~80% do custo |

### 2.3 Handoff Obrigatório em TODAS as Transições

**Problema:** Cada handoff exige:
1. Ler skill handoff
2. Compactar contexto (tokens de saída)
3. Escrever handoff.md
4. Invocar próximo agente (nova sessão, contexto do zero)
5. Próximo agente ler handoff.md + plan.md (tokens de entrada)

**Custo estimado por handoff:** 2.000-5.000 tokens (leitura + escrita + re-leitura)

**Com 12 handoffs por issue:** 24.000-60.000 tokens desperdiçados só em transições.

### 2.4 MaxTurns Excessivo

| Agente | Atual | Recomendado | Justificativa |
|--------|-------|-------------|---------------|
| implementer | 30 | **12** | Tarefa bounded não precisa de 30 turnos |
| sre | 25 | **10** | Infraestrutura é específica |
| tester | 20 | **8** | Testes são determinísticos na execução |
| planner | 20 | **8** | Orquestração não precisa de muitos turnos |
| product-manager | 20 | **10** | Entrevista + requisitos = escopo definido |

**Risco:** MaxTurns alto = agente pode "passear" no problema, consumindo tokens sem necessidade.

### 2.5 Falta de Temperatura Definida

Nenhum agente define `temperature`. Isso é **crítico** para eficiência:

| Tipo de tarefa | Temperatura ideal | Atual |
|----------------|-------------------|-------|
| Orquestração/planning | 0.0-0.1 | indefinido |
| Implementação de código | 0.1-0.2 | indefinido |
| Revisão de código | 0.0-0.1 | indefinido |
| Documentação | 0.3-0.5 | indefinido |
| Requisitos/entrevista | 0.3-0.5 | indefinido |

**Impacto:** Temperatura alta em tarefas determinísticas = mais tokens por saída = mais custo.

### 2.6 Contexto Duplicado

Cada agente lê:
- `.workflow/epic-XX/handoff.md`
- `.workflow/epic-XX/plan.md`
- Skills relevantes
- Arquivos de código

**Estimativa:** Cada agente consome 3.000-8.000 tokens só de "setup" antes de começar a trabalhar.

### 2.7 Paralelismo Subutilizado

**Atual:** Apenas implementer + sre em paralelo.

**Potencial não utilizado:**
- PM + tech-analyst (quando requirements já estão claros)
- Reviewer + linter (análise estática + revisão humana)
- Doc-writer pode escrever ADRs enquanto implementer trabalha

---

## 3. Sugestões de Melhoria

### 3.1 Consolidação de Agentes (13 → 7)

| Novo Agente | Substitui | Justificativa |
|-------------|-----------|---------------|
| **planner** | planner | Mantido (orquestração) |
| **product-manager** | PM + requirements-reviewer | Um agente com revisão interna |
| **architect** | tech-analyst | Mantido (função crítica) |
| **implementer** | implementer + sre | Implementação unificada (código + infra) |
| **reviewer** | reviewer + linter | Revisão unificada (código + lint) |
| **tester** | tester | Mantido (testes são especializados) |
| **documenter** | doc-writer + finisher + issue-creator | Documentação + scripts determinísticos |

**Redução:** 13 → 7 agentes = **~46% menos transições**

### 3.2 Modelos por Agente (Corrigidos)

| Agente | Modelo Atual | Modelo Recomendado | Temperatura |
|--------|--------------|-------------------|-------------|
| planner | sonnet | **sonnet** | 0.1 |
| product-manager | sonnet | **sonnet** | 0.3 |
| architect | sonnet ⚠️ | **opus** (premium) | 0.1 |
| implementer | sonnet | **sonnet** | 0.2 |
| reviewer | sonnet ⚠️ | **opus** (premium) | 0.1 |
| tester | haiku | **sonnet** | 0.2 |
| documenter | haiku | **haiku** | 0.4 |

**Regra:** Premium (opus) APENAS para architect e reviewer — onde erro custa caro.

### 3.3 Eliminar Handoff Obrigatório

**Nova abordagem:**

```
┌─────────────────────────────────────────────────────────────┐
│ SEQUÊNCIA LINEAR (sem handoff entre cada par)               │
├─────────────────────────────────────────────────────────────┤
│ PM+RR → architect → implementer → reviewer+linter → tester  │
│     ↓                                                       │
│  documenter (ao final, determinístico)                      │
└─────────────────────────────────────────────────────────────┘
```

**Regra:** Handoff APENAS quando:
- Mudança de domínio (requisitos → código)
- Retorno para implementação após falha
- Finalização do workflow

**Economia estimada:** 8-10 handoffs eliminados por issue = ~40.000 tokens economizados.

### 3.4 MaxTurns Otimizados

| Agente | Atual | Recomendado |
|--------|-------|-------------|
| planner | 20 | **8** |
| product-manager | 20 | **12** |
| architect | 15 | **10** |
| implementer | 30 | **15** |
| reviewer | 10 | **8** |
| tester | 20 | **10** |
| documenter | 15 | **5** |

### 3.5 Prompts Enxutos

**Problema:** Os prompts atuais são muito verbosos e repetitivos.

**Exemplo — Reviewer atual:** ~3.125 chars (90 linhas)
**Recomendado:** ~1.200 chars (35 linhas)

**Técnicas:**
- Remover regras óbvias ("Do NOT fix issues" já está no nome)
- Usar listas em vez de parágrafos
- Centralizar regras compartilhadas em um base prompt
- Remover exemplos de código que o modelo já conhece

### 3.6 Contexto Compartilhado (Cache)

**Implementar:** Um `context-bundle.md` que contém:
- Visão geral do projeto (uma vez)
- Arquivos relevantes (paths + resumo)
- Decisões já tomadas

**Regra:** Agentes leem o bundle uma vez, não re-leem arquivos.

### 3.7 Batching de Tarefas

**Em vez de:** Uma issue por vez (12 handoffs × N issues)
**Fazer:** Batch de issues similares

```
planner → PM → architect → [implementer × N issues] → [reviewer × N] → tester
```

**Economia:** Overhead de handoff pago uma vez para N issues.

### 3.8 Telemetria Ativa (Alertas de Custo)

**Implementar no `.squad/config.yaml`:**

```yaml
limits:
  max_tokens_per_issue: 150000
  max_tokens_per_epic: 500000
  alert_at_percent: 75
  stop_at_percent: 90
  fallback_model_on_limit: haiku
```

**Comportamento:**
- A 75%: Alerta + troca para modelo mais barato
- A 90%: Pausa + espera decisão humana

### 3.9 Determinizar o que é Determinístico

| Atual | Recomendado |
|-------|-------------|
| issue-creator (LLM) | Script `gh issue create --template` |
| finisher (LLM) | Script conventional-commit + gh pr create |
| linter (LLM) | Script (já é, mas tratado como agente) |
| changelog (LLM) | Script a partir de conventional commits |

**Economia:** 4 agentes LLM → scripts = ~30% do custo total eliminado.

### 3.10 Implementar Gates Determinísticos Reais

**Ação imediata necessária:**

1. **Descoberta automática de comandos** em `project-discovery.mjs`:
   ```javascript
   // Detectar baseado em arquivos de configuração
   if (exists('package.json')) {
     const pkg = JSON.parse(readFile('package.json'));
     if (pkg.scripts?.test) gates.test = pkg.scripts.test;
     if (pkg.scripts?.lint) gates.lint = pkg.scripts?.lint;
   }
   if (exists('pyproject.toml')) {
     gates.lint = 'ruff check .';
     gates.test = 'pytest';
   }
   ```

2. **Invocar gates nas transições de fase** — o planner/root deve executar:
   ```bash
   node scripts/workflow-gates.mjs --run .workflow/runs/<id> --gate lint --command "<comando>"
   node scripts/workflow-gates.mjs --run .workflow/runs/<id> --gate test --command "<comando>"
   ```

3. **Bloquear avanço em caso de falha** — se gate falhou, next_action = implementer (não reviewer)

4. **Registrar evidência** — checks.json já existe, mas não é usado para decisão

**Economia estimada:** 30-40% do custo do reviewer (que é premium)

---

## 4. Estimativa de Economia

### 4.1 Cenário Atual (por issue)

| Item | Tokens estimados |
|------|------------------|
| 13 agentes × setup (3.5K cada) | 45.500 |
| 12 handoffs × 3.5K | 42.000 |
| Trabalho real dos agentes | 80.000 |
| **Total** | **~167.500 tokens** |

### 4.2 Cenário Otimizado (por issue)

| Item | Tokens estimados |
|------|------------------|
| 7 agentes × setup (2K cada) | 14.000 |
| 4 handoffs × 2K | 8.000 |
| Trabalho real dos agentes | 60.000 |
| **Total** | **~82.000 tokens** |

### 4.3 Comparação

| Métrica | Atual | Otimizado | Economia |
|---------|-------|-----------|----------|
| Tokens/issue | 167.500 | 82.000 | **51%** |
| Agentes | 13 | 7 | **46%** |
| Handoffs | 12 | 4 | **67%** |
| Custo estimado (Claude Pro) | ~$5/issue | ~$2.5/issue | **50%** |
| Epics/mês (Pro $20) | 3-5 | 6-10 | **+100%** |

### 4.4 Impacto dos Gates Determinísticos

| Cenário | Custo do Reviewer | Economia |
|---------|-------------------|----------|
| Sem gates (atual) | ~$1.5/issue (premium detectando bugs simples) | — |
| Com gates | ~$0.5/issue (premium só para análise complexa) | **~67%** |

**Por que importa:** O reviewer é um dos agentes mais caros (premium). Se gates determinísticos pegam 60-70% dos problemas simples, o reviewer só precisa focar em arquitetura, segurança e lógica complexa.

---

## 5. Recomendações Prioritárias

### 🔴 Alta Prioridade (implementar já)

1. **Implementar gates determinísticos reais** — declarados mas nunca executados
2. **Corrigir inconsistências de modelo** — tech-analyst, reviewer, sre DEVEM ser premium
3. **Definidade temperatura** — 0.1 para código/revisão, 0.3-0.5 para documentação
4. **Reduzir maxTurns** — implementer 30→15, sre 25→10
5. **Eliminar handoff obrigatório** — apenas em transições críticas

### 🟡 Média Prioridade (próximo sprint)

5. **Consolidar agentes** — 13 → 7
6. **Determinizar issue-creator e finisher** — scripts
7. **Prompts enxutos** — reduzir 50% do tamanho
8. **Implementar alertas de custo** — telemetria ativa

### 🟢 Baixa Prioridade (melhoria contínua)

9. **Batching de issues** — processamento em lote
10. **Contexto compartilhado** — cache entre agentes
11. **Paralelismo inteligente** — mais agentes em paralelo quando seguro

---

## 6. Riscos e Mitigações

| Risco | Mitigação |
|-------|-----------|
| Consolidar agentes reduz qualidade | Manter checklists separadas dentro do agente |
| Menos handoffs = menos rastreabilidade | Log estruturado em `.workflow/events.jsonl` |
| Temperatura baixa = saída repetitiva | Ajustar por agente, testar empiricamente |
| MaxTurns baixo = tarefa incompleta | Fallback: pedir mais turnos ao planner |

---

## 7. Conclusão

O orchestrated-squad tem uma arquitetura bem projetada em termos de **separação de responsabilidades**, mas é **ineficiente em custos e harnessing**. As principais oportunidades são:

1. **Alinhar modelos** — o registry está certo, implementações estão erradas
2. **Reduzir agentes** — 13 é excessivo, 7 é suficiente
3. **Eliminar handoffs** — 12 por issue é desperdício
4. **Determinizar scripts** — issue-creator e finisher não precisam de LLM
5. **Controlar temperatura** — falta definição = custo imprevisível

**Economia potencial:** 50% dos tokens = **dobro da capacidade** na mesma assinatura.

## 8. Detalhamento da Implementação dos Gates Determinísticos

### 8.1 Visão da Arquitetura Proposta

```
┌─────────────────────────────────────────────────────────────────┐
│                        PLANNER (Root)                           │
│  Coordena workflow, invoca agentes, decide próximos passos      │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                     GATE RUNNER (NOVO)                          │
│  Descobre comandos, executa gates, retorna resultado            │
│  Bloqueia avanço se gate falhar                                 │
└─────────────────────────────────────────────────────────────────┘
                              │
              ┌───────────────┼───────────────┐
              ▼               ▼               ▼
        ┌──────────┐   ┌──────────┐   ┌──────────┐
        │   LINT   │   │   TEST   │   │ GIT STATUS│
        │  gate    │   │  gate    │   │   gate    │
        └──────────┘   └──────────┘   └──────────┘
```

### 8.2 Componentes a Implementar

#### 8.2.1 Expandir `scripts/project-discovery.mjs`

**Objetivo:** Detectar comandos de validação para múltiplas linguagens.

```javascript
// scripts/project-discovery.mjs (expandido)

async function detectPythonCommands(root) {
  const commands = [];
  // pyproject.toml
  if (await present(path.join(root, 'pyproject.toml'))) {
    const content = await readFile(path.join(root, 'pyproject.toml'), 'utf8');
    if (content.includes('[tool.ruff]') || content.includes('ruff')) {
      commands.push({ name: 'lint', command: 'ruff check .', confidence: 'confirmed' });
    }
    if (content.includes('[tool.pytest]') || content.includes('pytest')) {
      commands.push({ name: 'test', command: 'pytest', confidence: 'confirmed' });
    }
    if (content.includes('[tool.mypy]') || content.includes('mypy')) {
      commands.push({ name: 'typecheck', command: 'mypy .', confidence: 'confirmed' });
    }
  }
  // Makefile
  if (await present(path.join(root, 'Makefile'))) {
    const makefile = await readFile(path.join(root, 'Makefile'), 'utf8');
    const targets = ['lint', 'test', 'build', 'check'];
    for (const target of targets) {
      if (makefile.match(new RegExp(`^${target}:`, 'm'))) {
        commands.push({ name: target, command: `make ${target}`, confidence: 'confirmed' });
      }
    }
  }
  return commands;
}

async function detectRustCommands(root) {
  if (await present(path.join(root, 'Cargo.toml'))) {
    return [
      { name: 'lint', command: 'cargo clippy -- -D warnings', confidence: 'confirmed' },
      { name: 'test', command: 'cargo test', confidence: 'confirmed' },
      { name: 'build', command: 'cargo build', confidence: 'confirmed' },
    ];
  }
  return [];
}

async function detectGoCommands(root) {
  if (await present(path.join(root, 'go.mod'))) {
    return [
      { name: 'lint', command: 'golangci-lint run', confidence: 'confirmed' },
      { name: 'test', command: 'go test ./...', confidence: 'confirmed' },
      { name: 'build', command: 'go build ./...', confidence: 'confirmed' },
    ];
  }
  return [];
}

export async function discoverProject(root) {
  // ... existente ...
  const commands = [
    ...(await detectNodeCommands(root, pkg)),
    ...(await detectPythonCommands(root)),
    ...(await detectRustCommands(root)),
    ...(await detectGoCommands(root)),
  ];
  // ... retorna commands ...
}
```

#### 8.2.2 Criar `scripts/gate-runner.mjs`

**Objetivo:** Executar gates em sequência com bloqueio de workflow.

```javascript
// scripts/gate-runner.mjs (NOVO)

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
  if (!command) {
    return {
      schema_version: '1.0',
      gate,
      outcome: 'skipped',
      summary: `No command configured for gate "${gate}"`,
      blocking: GATE_REGISTRY[gate]?.blocking ?? false,
    };
  }

  const startedAt = new Date().toISOString();
  const execution = await executeCommand(command, root);
  const passed = execution.exitCode === 0;

  const result = {
    schema_version: '1.0',
    gate,
    outcome: passed ? 'passed' : 'failed',
    blocking: GATE_REGISTRY[gate]?.blocking ?? false,
    summary: passed ? `${gate} passed` : `${gate} failed`,
    evidence: [{ command, exit_code: execution.exitCode }],
    output: execution.output,
    started_at: startedAt,
    completed_at: new Date().toISOString(),
    next_action: passed ? 'continue' : 'return to implementation',
  };

  // Persistir resultado
  await mkdir(runDir, { recursive: true });
  const checksPath = path.join(runDir, 'checks.json');
  let checks = [];
  try { checks = JSON.parse(await readFile(checksPath, 'utf8')); } catch { /* first gate */ }
  checks.push(result);
  await writeFile(checksPath, `${JSON.stringify(checks, null, 2)}\n`);
  await appendEvent(runDir, { type: 'gate_completed', gate, exit_code: execution.exitCode });

  return result;
}

export async function runGates({ root, runDir, gates, commands }) {
  const results = [];
  
  for (const gate of gates) {
    const command = commands[gate];
    const result = await runGate({ root, runDir, gate, command });
    results.push(result);
    
    // Se gate bloqueou e falhou, parar execução
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
  const root = process.argv[process.argv.indexOf('--root') + 1] ?? process.cwd();
  const runDir = process.argv[process.argv.indexOf('--run') + 1];
  const gates = (process.argv[process.argv.indexOf('--gates') + 1] ?? '').split(',');
  const commands = {};
  
  // Parsear comandos: --command-lint "ruff check ." --command-test "pytest"
  for (let i = 0; i < process.argv.length; i++) {
    if (process.argv[i].startsWith('--command-')) {
      const gate = process.argv[i].replace('--command-', '');
      commands[gate] = process.argv[i + 1];
    }
  }

  if (!runDir || !gates.length) {
    console.error('Usage: node scripts/gate-runner.mjs --root <root> --run <run-dir> --gates lint,test --command-lint "ruff check ." --command-test "pytest"');
    process.exit(1);
  }

  const result = await runGates({ root, runDir, gates, commands });
  console.log(JSON.stringify(result, null, 2));
  
  // Exit code: 0 se passou, 1 se bloqueou
  process.exit(result.outcome === 'passed' ? 0 : 1);
}
```

#### 8.2.3 Atualizar `.squad/config.yaml` Template

```yaml
# .squad/config.yaml (atualizado)
schema_version: 1.0
discovery:
  confidence: confirmed
  languages: [node, python]
gates:
  lint:
    command: "npm run lint"
    blocking: true
    auto_detect: true
  test:
    command: "npm test"
    blocking: true
    auto_detect: true
  git-status:
    command: "git status --short"
    blocking: false
work_items:
  provider: none
  publish: manual
  project: null
  require_confirmation: true
```

#### 8.2.4 Atualizar Planner para Invocar Gates

```markdown
# .claude/agents/planner.md (atualizado)

## Workflow

### Phase 2: Per-Story Execution
For each issue:
1. Call implementer (code) and sre (infra)
2. **RUN DETERMINISTIC GATES:**
   ```bash
   node scripts/gate-runner.mjs \
     --root . \
     --run .workflow/runs/<run-id> \
     --gates lint,test,git-status \
     --command-lint "<lint-command>" \
     --command-test "<test-command>"
   ```
3. If gates passed → call reviewer
4. If gates failed → return to implementer with gate output
5. Call reviewer (only after gates pass)
6. Call tester (only if test gaps remain)
```

#### 8.2.5 Atualizar Skills

```markdown
# .agents/skills/squad-execute/SKILL.md (atualizado)

After implementation, run deterministic gates BEFORE invoking reviewer:

```bash
node scripts/gate-runner.mjs \
  --root . \
  --run .workflow/runs/<run-id> \
  --gates lint,test \
  --command-lint "<from-config>" \
  --command-test "<from-config>"
```

Only invoke reviewer if gates pass. If gates fail, return to implementer with evidence.
```

### 8.3 Fluxo de Execução Completo

```
┌─────────────────────────────────────────────────────────────────────┐
│                        WORKFLOW COM GATES                           │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  implementer ──────────────────────────────────────────┐           │
│       │                                                │           │
│       ▼                                                │           │
│  [GATE: lint] ──── falhou ──→ implementer (retry)      │           │
│       │ passou                                         │           │
│       ▼                                                │           │
│  [GATE: test] ──── falhou ──→ implementer (retry)      │           │
│       │ passou                                         │           │
│       ▼                                                │           │
│  reviewer ─────────────────────────────────────────────┤           │
│       │                                                │           │
│       ▼                                                │           │
│  tester (se necessário) ───────────────────────────────┘           │
│       │                                                             │
│       ▼                                                             │
│  finisher                                                           │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### 8.4 Comandos de Descoberta por Linguagem

| Linguagem | Arquivo de Config | Lint Command | Test Command |
|-----------|-------------------|--------------|--------------|
| Node.js | package.json | `npm run lint` | `npm test` |
| Python | pyproject.toml | `ruff check .` | `pytest` |
| Python (alt) | pyproject.toml | `flake8` | `pytest` |
| Rust | Cargo.toml | `cargo clippy -- -D warnings` | `cargo test` |
| Go | go.mod | `golangci-lint run` | `go test ./...` |
| Java | pom.xml | `mvn checkstyle:check` | `mvn test` |
| Ruby | Gemfile | `rubocop` | `rspec` |
| Makefile | Makefile | `make lint` | `make test` |

### 8.5 Validação e Testes

**Testes unitários para `gate-runner.mjs`:**

```javascript
// tests/gate-runner.test.mjs
import { test } from 'node:test';
import assert from 'node:assert';
import { runGate, runGates } from '../scripts/gate-runner.mjs';

test('runGate passes on successful command', async () => {
  const result = await runGate({
    root: '.',
    runDir: '/tmp/test-run',
    gate: 'test',
    command: 'echo "ok"',
  });
  assert.equal(result.outcome, 'passed');
});

test('runGate fails on failed command', async () => {
  const result = await runGate({
    root: '.',
    runDir: '/tmp/test-run',
    gate: 'test',
    command: 'exit 1',
  });
  assert.equal(result.outcome, 'failed');
});

test('runGates blocks on blocking gate failure', async () => {
  const result = await runGates({
    root: '.',
    runDir: '/tmp/test-run',
    gates: ['lint', 'test'],
    commands: { lint: 'exit 1', test: 'echo ok' },
  });
  assert.equal(result.outcome, 'blocked');
  assert.equal(result.blocked_by, 'lint');
});
```

### 8.6 Prioridade de Implementação

| # | Componente | Esforço | Impacto |
|---|------------|---------|---------|
| 1 | `gate-runner.mjs` (novo) | Médio | **Crítico** |
| 2 | `project-discovery.mjs` (expandido) | Baixo | Alto |
| 3 | `config.yaml` template (atualizado) | Baixo | Alto |
| 4 | `planner.md` (atualizado) | Baixo | **Crítico** |
| 5 | Skills (atualizados) | Baixo | Médio |
| 6 | Testes unitários | Médio | Alto |

**Estimativa total:** ~4-6 horas de implementação para o core.
