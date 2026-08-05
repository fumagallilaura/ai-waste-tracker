---
name: squad-execute
description: Execute an approved squad plan with direct Codex specialists and deterministic gates.
---

# Squad execute

Read the active run state and approved plan. The root assigns direct implementation or SRE children with disjoint `write_scope`; serialize overlapping changes. It must not implement the plan itself. Use workspace-write only for implementation specialists.

## Deterministic Gates (REQUIRED before reviewer)

After implementation, run gates BEFORE invoking reviewer:

```bash
node scripts/gate-runner.mjs \
  --root . \
  --run .workflow/runs/<run-id> \
  --gates lint,test \
  --command-lint "<from-config-or-skip>" \
  --command-test "<from-config-or-skip>"
```

- If gates passed → continue to reviewer
- If gates failed → return to implementer with gate output evidence

Only invoke reviewer if gates pass. Gates are defined in `.squad/config.yaml` under `gates:` section.
