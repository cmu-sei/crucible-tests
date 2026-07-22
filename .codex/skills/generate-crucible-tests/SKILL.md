---
name: generate-crucible-tests
description: Generate Crucible end-to-end Playwright specs by dispatching the local playwright-test-generator agent. Use when asked to implement one or more scenarios from a Crucible app's test plan and verify them against the running stack.
---

# Generate Crucible Tests

Dispatch the repository's `playwright-test-generator` agent. Keep browser
execution and spec generation in that agent so it can use its generator tools.

## Dispatch

1. Determine the target app, requested test-plan scenario or scenarios, and
   any user-supplied constraints. Ask one concise question only if the app or
   scenario cannot be inferred.
2. Call `multi_agent_v1.spawn_agent` with
   `agent_type: "playwright-test-generator"` and that exact scope. Tell it to
   work in the current repository, update the relevant spec files, and run the
   narrowest useful verification.
3. Do not independently generate or edit the requested specs while the agent
   is working.
4. Call `multi_agent_v1.wait_agent` for completion, then report changed files,
   verification results, and any blockers.
