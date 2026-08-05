---
name: squad-test
description: Run deterministic tests and optionally author missing tests.
---

# Squad test

Run the test-runner gate first using gate-runner. Only invoke the platform's tester or test-author directly when a bounded test gap remains; the root must not author tests itself.

## Gate Execution

```bash
node scripts/gate-runner.mjs \
  --root . \
  --run .workflow/runs/<run-id> \
  --gates test \
  --command-test "<from-config>"
```

- If gate passed → check if test gaps remain, invoke tester only if needed
- If gate failed → return to implementer with gate evidence

The test specialist may write tests in its scope but does not modify production code without an explicit root instruction.
