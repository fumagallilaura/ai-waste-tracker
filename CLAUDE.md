# CLAUDE.md

## Repository purpose

`orchestrated-squad` is a portable workflow package, not a target application.
It renders or installs runtime-native agents and workflow skills into other
projects. The npm CLI is the primary interface:

```bash
npx @gregori/orchestrated-squad@<version> install --target codex|claude|opencode|devin|vscode|all
```

`install.sh` and `install.ps1` delegate to the same Node core. Never add a
target project's dependencies, cloud setup, framework, or test fixture to this
repository's installer output.

## Canonical architecture

- `squad/`: canonical agent registry, model classes, workflow and gate metadata.
- `scripts/`: renderer, installer, validators, deterministic gates, discovery,
  state and local telemetry.
- `.codex/`, `.claude/`, `.opencode/`, `.devin/`, `.github/`: runtime artifacts.
  Treat generated artifacts as outputs of the canonical source.
- `schemas/`: portable contracts.
- `tests/fixtures/`: squad-only fixtures; excluded from the npm tarball.
- `.workflow/`: resumable workflow state. It is the canonical record of a run.

## Model policy

Use `deterministic`, `economy`, `standard`, and `premium` classes from
`squad/models.yaml`. The renderer resolves model IDs for the selected runtime
and `squad doctor` validates availability. Do not restore historical model
names, prices, or version snapshots to documentation or agent prompts.

Claude Code custom subagents are `.claude/agents/*.md` with the documented
`haiku`, `sonnet`, or `opus` aliases and `Agent` tool restrictions. Devin uses
`.devin/agents/*/AGENT.md`; portable procedures belong in `.agents/skills/`.

## Safe changes

- Preserve user-owned files during installation; use manifests, structural
  config merges and delimited managed blocks.
- Root orchestrates; specialists are direct children. Writers require disjoint
  `write_scope` reservations.
- Gates run lint, build, tests and Git without an LLM. External work-item or PR
  actions require an explicit command/checkpoint.
- Telemetry is local and content-redacted. Never add automatic upload.

## Verification

```bash
npm run lint
npm test
npm run validate:contracts
npm run check:drift
npm pack --dry-run
```

Before any npm release, verify the packed tarball. Release workflow provenance
requires `package.json.repository.url` to match the GitHub repository.

<!-- orchestrated-squad:claude:start -->
## Orchestrated Squad

Use the installed `squad-*` workflow commands. The root session owns orchestration and `.workflow/` is canonical state. For every LLM workflow phase, the root must invoke the platform-native specialist subagent; it may only inspect state, coordinate transitions, and run deterministic gates itself. Specialists must not delegate again. Preserve instructions outside this managed block.
<!-- orchestrated-squad:claude:end -->
