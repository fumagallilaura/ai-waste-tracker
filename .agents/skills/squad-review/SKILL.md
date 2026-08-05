---
name: squad-review
description: Run deterministic gates and an independent read-only review.
---

# Squad review

Run deterministic gates FIRST using gate-runner, then invoke the reviewer directly with read-only access; the root must not review the implementation itself.

## Gate Execution

```bash
node scripts/gate-runner.mjs \
  --root . \
  --run .workflow/runs/<run-id> \
  --gates lint,test,git-status \
  --command-lint "<from-config>" \
  --command-test "<from-config>"
```

- If gates passed → invoke reviewer agent
- If gates failed → return to implementer with gate evidence

Record findings and evidence in the run state; never use the reviewer to edit fixes.
