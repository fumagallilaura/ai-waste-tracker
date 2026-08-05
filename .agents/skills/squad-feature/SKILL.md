---
name: squad-feature
description: Execute a bounded feature through direct Codex specialists and deterministic gates.
---

# Squad feature

The root session owns the run and creates specialists directly; `agents.max_depth = 1` prohibits delegation chains. It is an orchestrator, not a substitute for a specialist: requirements go to product-manager then requirements-reviewer, design to tech-analyst, implementation to implementer or SRE, documentation to doc-writer, review to reviewer, and test work to the platform's tester or test-author. Assign non-overlapping write scopes to writers. Keep reviewers and analysts read-only.

After reading state, invoke the native subagent for every LLM phase immediately. The root may only inspect state, coordinate results, update transitions, and run deterministic gates; it must not perform requirements, design, implementation, review, documentation, or test-authoring itself.

After implementation, run deterministic gates BEFORE invoking reviewer:

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

Persist each gate result in `.workflow/runs/<run-id>/checks.json`, request an independent reviewer only after deterministic gates pass, and update the handoff before finishing.
