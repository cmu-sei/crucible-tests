---
name: plan-crucible-tests
description: Create or expand a Crucible end-to-end Playwright test plan by dispatching the local playwright-test-planner agent. Use when asked to explore a running Crucible app, document browser test scenarios, or update an app's test-plan markdown.
---

# Plan Crucible Tests

Dispatch the repository's `playwright-test-planner` agent. Keep planning work in
that agent so it can use its browser-specific setup and plan-saving tools.

## Dispatch

1. Determine the target app and requested feature scope from the request. Ask
   one concise question only if the app cannot be inferred.
2. Call `multi_agent_v1.spawn_agent` with
   `agent_type: "playwright-test-planner"`, passing the target app, scope, and
   stated acceptance criteria. Tell it to perform the work in the current
   repository and save the plan.
3. Do not independently inspect the app or write the plan while the agent is
   working.
4. Call `multi_agent_v1.wait_agent` for completion, then report the saved plan
   path and its material coverage or blockers.
