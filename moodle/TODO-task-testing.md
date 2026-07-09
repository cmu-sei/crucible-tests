# Moodle Plugin Task Testing TODO

Add focused coverage for Moodle background tasks and lab task/grading behavior before expanding the manage deployments PRs further.

## Priority Test Cases

- Crucible bulk deploy creates Alloy events for the target student, not the teacher or system account.
- Crucible bulk deploy transitions users through `pending`, `launched`, `ready`, and `inprogress` without leaving stale rows.
- Crucible bulk deploy handles failures cleanly when the target user has no Alloy GUID, Alloy event creation fails, or the event never becomes active.
- TopoMojo bulk deploy continues to create attempts only after the gamespace is active and VMs are available.
- Scheduled deployments use Moodle profile timezone consistently with Moodle's task page timestamps.
- Cancel selected stops pending or launched deployments and does not affect already in-progress attempts.
- Extend selected updates active attempt end times and respects the site maximum extension interval.
- Close/cleanup tasks close expired attempts and sync the visible manage-page status afterward.
- Crucible Steamfitter task grading still processes scenario tasks, updates attempt scores, and writes Moodle grades.
- Crucible task grading handles partial completion, failed task API responses, and repeated grading runs idempotently.

## Test Approach

- Prefer PHP unit tests for repository/status formatting, payload building, task state transitions, and grading utilities.
- Use mocked API clients for Alloy, TopoMojo, Player, and Steamfitter so failure states can be tested deterministically.
- Add Playwright coverage only for user-visible flows: manage page status updates, review pages, challenge button routing, and learner access after background tasks complete.
- Keep at least one manual/live smoke test for full external orchestration because it verifies the service wiring that mocks cannot cover.

## Data Setup Needs

- Seed or fixture users with valid Alloy GUIDs in Moodle `idnumber`.
- Seed one user without an Alloy GUID for failure-path coverage.
- Provide activity fixtures for Crucible and TopoMojo with grading enabled and disabled.
- Provide a fake Steamfitter task result set with complete, incomplete, and failed tasks.
- Provide fixed clock/timezone helpers so scheduled task assertions are stable.

## Open Decisions

- Decide whether group-mode grading should be owner-only, shared group grade, or copied individual grades.
- Decide whether task tests should live in plugin PHPUnit suites, `crucible-tests` Playwright specs, or both.
- Decide how much live external orchestration is acceptable in CI versus local-only smoke tests.
