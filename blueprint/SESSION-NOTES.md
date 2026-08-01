# Blueprint test-suite session notes (2026-08-01)

Running log for the final report. Append-only; each entry dated/ordered.

## Starting state

- Worktree `worktree-blueprint-tests`, branch off `main` @ `d4dc4a3`.
- Uncommitted work from a prior session: 97 files staged, 13 more modified unstaged.
- `blueprint.ui` checked out on branch `fix/msel-info-datafield-subscription-leak`
  (**not** `main`) — the BP-11 leak fix, local and unpushed. **The suite's green state
  depends on an unpushed application change.** Flag in final report.
- Aspire stack was **down** at session start (all three health probes returned 000).
- Launch profile (`appsettings.Development.json`): `Prod: [Player, Steamfitter, Cite, Gallery, Blueprint]`.

## Prior-session claims to verify (do not take on trust)

From `blueprint/blueprint-healing-report.html`:
- Claim: 117 passed / 0 failed / 19 skipped at `--workers 2`.
- Claim: `admin-inject-types-and-catalogs` needs `--workers 1` (2 specs fail at 2 workers).
  → User requires `--workers 2`, so this must actually be **fixed**, not documented.

## Audit findings (pre-run, static)

| Antipattern | Count | Notes |
|---|---:|---|
| `waitForTimeout` / `networkidle` | 206 | 78 in admin-inject-types-and-catalogs, 36 real-time, 28 integration |
| `test.skip` / `test.fixme` total | 29 | of which ~14 are **bare `test.skip()`** conditional self-skips |
| `Promise.race` over `waitFor` | 0 | already clean |
| Swallowed `.catch(() => {})` on assertions | 6 files | assertion result discarded — cannot fail |

Bare-`test.skip()` self-skip locations (invisible non-coverage — a test that
skips itself when its precondition is missing reports green while covering nothing):
`launch-and-join-workflows/` (launch-new-event ×2, manage-deployed-event, join-active-event ×2,
launch-loading-state ×2), `integration-with-crucible-services/` (gallery-integration-validation,
cite-integration-team-collaboration), `event-dashboard-and-navigation/`
(navigate-to-launch-events, navigate-to-join-events), `accessibility-and-usability/`
(focus-management-in-dialogs, + responsive-layout-mobile-view and screen-reader-compatibility
are `test.fixme`), `real-time-collaboration-and-signalr/collaborative-editing-conflict-resolution`.

## Baseline run #0 (2026-08-01, `run-tests.sh blueprint --browser chromium --workers 2`)

Stack: Aspire, blueprint-api/blueprint-ui/keycloak all `Healthy` via `aspire wait`.
`.auth/` deleted first so global-setup re-provisioned auth from scratch.

**136 tests: 112 expected, 19 skipped, 1 unexpected, 4 flaky** (wall clock ~7 min)

The prior session's report claimed **117 passed / 0 failed** at 2 workers. Not reproducible.
The failures land precisely where that session's own README said they would.

| Spec | Status | Failure |
|---|---|---|
| `admin-inject-types-and-catalogs/copy-inject` | **unexpected** (failed both attempts) | `New Inject` menu item not visible; on retry, catalog detail-row `app-inject-list` not visible |
| `admin-inject-types-and-catalogs/create-catalog` | flaky | detail-row cell `Create Catalog Test Inject` not visible |
| `admin-inject-types-and-catalogs/inject-type-catalog-inject-end-to-end` | flaky | `New Inject` menu item not visible |
| `export-and-import/import-msel-from-excel` | flaky | menuitem `Download xlsx file` not visible |
| `user-and-role-management/remove-role-from-user` | flaky | `mat-option` "None Locally" click timeout 10s (option resolved but click never landed) |

**Decision:** the user requires `--workers 2`, so the prior session's "run this directory at
`--workers 1`" is not an acceptable resolution. The shared-global-state problem in
`admin-inject-types-and-catalogs` has to be actually fixed: per-spec unique fixture names,
row-scoped locators, `afterEach` cleanup.
