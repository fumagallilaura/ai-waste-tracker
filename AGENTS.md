# Agent Guidelines for orchestrated-squad

Supported targets: **Codex** · **Claude Code** · **OpenCode** · **Devin CLI** · **VS Code Copilot Chat**

## Workflow Overview

```
planner (orchestrates)
  ├── product-manager ↔ requirements-reviewer (cycle)
  ├── doc-writer (PRD, stories, ADRs, changelog)
  ├── tech-analyst (architecture + autocrítica)
  ├── issue-creator (GitHub Issues)
  ├── implementer + sre (parallel implementation)
  ├── reviewer (correctness + security checklist)
  ├── linter (report only)
  ├── tester (test + e2e)
  └── finisher (commit + PR + release notes)

bugs: bug-triager → routes to appropriate agent(s)
```

## Claude Code Target

Agents for Claude Code live in `.claude/agents/`. Key differences from opencode:
- Models use short aliases: `sonnet`, `haiku`, `opus` (not vendor-prefixed IDs)
- Permissions use `tools` / `disallowedTools` lists (not path-based `permission:` blocks)
- Subagent invocation uses the `Agent` tool in the system prompt
- Bundled skills are loaded by reading `.agents/skills/<name>/SKILL.md` directly

## Handoff System

Every agent **must** use the handoff skill before transitioning to the next agent:

1. Load the `handoff` skill
2. Compact context into a handoff document (saved to OS temp dir)
3. Update `.workflow/handoff.md` with: Current Status, Next Agent, Decisions, Open Questions
4. Invoke the next agent via task invitation

**.workflow/ is the canonical record** — not chat history.

## Agent List

| Role | Model class | Runtime behavior |
|------|-------------|------------------|
| planner | standard | Root-session workflow orchestration |
| product-manager, requirements-reviewer, bug-triager | standard → premium | Scoped requirements and diagnosis; promote on ambiguity |
| tech-analyst, sre, reviewer | premium | Architecture, infrastructure and critical review |
| implementer, test-author | standard → premium | Bounded code and test changes |
| doc-writer, release notes | economy | Derived, structured documentation |
| linter, test-runner, mechanical finisher | deterministic | Scripts and gates; no LLM session |
| issue publisher | deterministic | Adapter behind explicit external-action checkpoint |

Model IDs are resolved from `squad/models.yaml` at install/runtime and checked
by `squad doctor`. Do not add provider prices, legacy IDs, or account-specific
availability to this file. Claude Code supports `haiku`, `sonnet`, and `opus`
aliases; OpenCode models are selected from the configured provider catalog.

## Writing Rules
- Keep entries short and structured
- Prefer bullets over long paragraphs
- Record file paths when discussing code changes
- Record exact test commands and results
- Record unresolved questions under Open Questions in handoff.md

## Skill Discovery
Each agent **must** use `find-skills` at the start of its work to discover relevant skills for the task at hand. For example:

| Agent | May discover |
|-------|-------------|
| tech-analyst | architecture-patterns, python-design-patterns |
| implementer | python-code-style, python-type-safety, vercel-react-best-practices |
| reviewer | python-code-style, sqlalchemy-alembic-expert, vercel-react-best-practices |
| sre | terraform-engineer, oracle-cloud, azure-kubernetes |
| linter | eslint-prettier-config, ruff-recursive-fix, python-code-style |
| tester | python-testing-patterns, behave-skill |
| product-manager | grill-me (mandatory for user interviews) |

Skills are project-specific. The agents discover them automatically via `npx skills find <domain>`. Users can also pre-install skills relevant to their project.

## Skill Usage
- Always use `find-skills` before starting a new task
- Use `grill-me` when product-manager interviews the user for requirements
- Use `handoff` skill before every agent transition
- Use `context7` to verify library/framework/API behavior
- Use `caveman-commit` for commit messages (finisher)
- Use `github-issues` for issue creation (issue-creator)

<!-- orchestrated-squad:codex:start -->
## Orchestrated Squad

Use the installed `squad-*` workflow commands. The root session owns orchestration and `.workflow/` is canonical state. For every LLM workflow phase, the root must invoke the platform-native specialist subagent; it may only inspect state, coordinate transitions, and run deterministic gates itself. Specialists must not delegate again. Preserve instructions outside this managed block.
<!-- orchestrated-squad:codex:end -->

<!-- orchestrated-squad:opencode:start -->
## Orchestrated Squad

Use the installed `squad-*` workflow commands. The root session owns orchestration and `.workflow/` is canonical state. For every LLM workflow phase, the root must invoke the platform-native specialist subagent; it may only inspect state, coordinate transitions, and run deterministic gates itself. Specialists must not delegate again. Preserve instructions outside this managed block.
<!-- orchestrated-squad:opencode:end -->

<!-- orchestrated-squad:devin:start -->
## Orchestrated Squad

Use the installed `squad-*` workflow commands. The root session owns orchestration and `.workflow/` is canonical state. For every LLM workflow phase, the root must invoke the platform-native specialist subagent; it may only inspect state, coordinate transitions, and run deterministic gates itself. Specialists must not delegate again. Preserve instructions outside this managed block.
<!-- orchestrated-squad:devin:end -->

<!-- orchestrated-squad:vscode:start -->
## Orchestrated Squad

Use the installed `squad-*` workflow commands. The root session owns orchestration and `.workflow/` is canonical state. For every LLM workflow phase, the root must invoke the platform-native specialist subagent; it may only inspect state, coordinate transitions, and run deterministic gates itself. Specialists must not delegate again. Preserve instructions outside this managed block.
<!-- orchestrated-squad:vscode:end -->
