---
name: heal-crucible-tests
description: Diagnose and repair failing Crucible end-to-end Playwright tests by dispatching the local playwright-test-healer agent. Use when a Crucible test fails, flakes, has stale selectors, or needs browser-based root-cause investigation and a focused fix.
---

# Heal Crucible Tests

Dispatch the repository's `playwright-test-healer` agent. Keep failure
reproduction, browser diagnosis, and repair in that agent.

## Dispatch

1. Determine the failing app, spec or test title, and available failure output.
   Ask one concise question only if the failure target cannot be inferred.
2. Call `multi_agent_v1.spawn_agent` with
   `agent_type: "playwright-test-healer"`, the exact failure scope, and all
   supplied logs, traces, or reproduction commands. Tell it to work in the
   current repository and run the narrowest useful verification.
3. Do not independently edit the failing test while the agent is working.
4. Call `multi_agent_v1.wait_agent` for completion, then report the root
   cause, changed files, test results, and unresolved product defects if any.
