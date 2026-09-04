# Moodle TopoMojo Tests

## Prerequisites

These tests require **both Moodle and TopoMojo** to be properly configured and running:

### 1. Aspire Services Running
Start Crucible services with Moodle and TopoMojo enabled:
```bash
cd /workspaces/crucible-development
aspire run
```

Or use VS Code launch profile (F5) with Moodle + TopoMojo enabled.

### 2. TopoMojo Configuration
The TopoMojo API must be configured in Moodle:

1. Log into Moodle as admin (http://localhost:8081)
2. Navigate to: **Site administration → Plugins → Activity modules → TopoMojo**
3. Configure settings:
   - **TopoMojo API URL**: `http://topomojo-api:5000` (or appropriate URL)
   - **API Key**: Valid TopoMojo API key
   - **OAuth Settings**: Keycloak client ID/secret if using OAuth

### 3. Test Workspace
Tests use workspace ID: `11d9f0cb5ad64e27982a181e116f48b8` (Moodle Test Workspace - Variants)

This workspace must exist in TopoMojo with:
- A challenge with **static** answers (no `##transform##` tokens). The reference
  workspace's Variant 2 has: Q1=`cp`, Q2=`mv`, Q3=`test`.
- penalty `0.1` and weight `1` on the graded questions.
- Multiple variants (for variant testing).

### 4. One activity per behaviour mode
The behaviour tests need an activity pre-configured for each
`preferredbehaviour`, all pointing at the workspace above:
- **interactive** with `submissions` >= 3 (so a 3rd, correct try is allowed)
- **immediatefeedback**
- **deferredfeedback**

Put their course-module IDs into `ACTIVITY_IDS` in the spec.

> **Why per-mode activities:** the grading behaviour is fixed into an attempt's
> question-usage when it starts, so the same activity can't be re-used across
> modes without deleting attempts and changing the setting. Separate activities
> keep each test independent.

### Gamespace requirement (important)
mojomatch resolves the correct answer from the **deployed gamespace's** cloned
challenge, so every attempt deploys real VMs (~1 min each, and can fail for
hypervisor reasons unrelated to grading). There is no preview/offline path.
This is why the specs are `.skip()` by default — they are not suitable for
unattended CI without a reliable hypervisor and seeded activities.

## Running Tests

### All Moodle TopoMojo Tests
```bash
npx playwright test tests/moodle/topomojo-penalty-weight.spec.ts
```

### Specific Test
```bash
npx playwright test tests/moodle/topomojo-penalty-weight.spec.ts -g "cumulative penalty"
```

### With Headed Browser (see what happens)
```bash
npx playwright test tests/moodle/topomojo-penalty-weight.spec.ts --headed
```

### With Debugging
```bash
npx playwright test tests/moodle/topomojo-penalty-weight.spec.ts --debug
```

## Test Status

All tests are `.skip()` by default. The scenarios they encode were **verified
manually via Playwright on 2026-06-09** against a live stack — the assertions
(`Mark 0.80 out of 1.00`, `Tries remaining`, no Check button in deferred, etc.)
are the actual observed UI, not guesses. They stay skipped because they need a
live gamespace per attempt (see "Gamespace requirement" above) plus seeded
per-mode activities, which this repo does not provision.

To enable: satisfy prerequisites 1-4 above, fill in `ACTIVITY_IDS` in the spec,
and remove `.skip` from the relevant tests.

### Verified behaviour (what these tests assert)

| Mode | Behaviour |
|------|-----------|
| interactive | wrong → 0.00 with `Tries remaining` decrementing; correct after 2 wrong = **0.80** (`1 - 0.1*2`), marked Correct; correct first try = 1.00 |
| immediatefeedback | single graded try; wrong = 0.00 "Incorrect", no retry, no penalty |
| deferredfeedback | no Check buttons; answers saved on Submit Quiz; graded at finish, no penalty |

## Optional future work

- **Shared Moodle auth fixture** — `loginToMoodle()` in the spec could move to a
  reusable fixture once a second Moodle spec exists.
- **DB assertions for import** — verify `mdl_question.defaultmark` / `penalty`
  after import. Note weight is imported **as-is** (TopoMojo weight is a
  normalized share of the challenge; the plugin scales the activity grade by
  ratio, so weight `1` → defaultmark `1`). Requires DB access from Playwright.
- **Seed helper** — a setup script that creates the per-mode activities so the
  tests can run without manual configuration.

## Test Plan

See `/mnt/data/crucible/crucible-tests/moodle/moodle-test-plan.md` for comprehensive test scenarios covering:
- Authentication
- Course management
- TopoMojo activity workflows
- Penalty calculation
- Question sync
- Scheduled deployments
- Bulk deployment management
- Variants
- Exploration mode

## Related Documentation

- [Moodle Test Plan](../../moodle/moodle-test-plan.md)
- [Penalty/Weight Verification TODO](/workspaces/crucible-development/TODO/topomojo-penalty-weight-verification.md)
- [TopoMojo Plugin Source](/mnt/data/crucible/moodle/mod/topomojo/)
