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

## Root cause: `admin-inject-types-and-catalogs` failures at 2 workers

The prior session concluded this directory is "only sound single-threaded" and documented a
`--workers 1` requirement, attributing the failures to "~77 positional locators". That is not
the mechanism. The actual cause is a **cascade delete crossed with a globally-scoped picker**,
and it is a test defect that is fixable.

**Verified against the live API:**
```
POST /api/injectTypes {name: ZZCascadeIT}          -> 201, id=IT
POST /api/catalogs   {name: ZZCascadeCat, injectTypeId: IT} -> 201, id=CAT
DELETE /api/injectTypes/IT                          -> 204
GET  /api/catalogs/CAT                              -> 204 (empty)   <-- catalog is GONE
GET  /api/catalogs                                  -> count 0
```
**Deleting an inject type cascade-deletes every catalog that references it.**

Now cross that with how these specs choose an inject type when creating their catalog —
5 of them do this:
```ts
const firstOption = page.locator('mat-option, [role="option"]').first();   // GLOBAL list
await firstOption.click();
```
`mat-option` is unfiltered, so a spec binds its catalog to whichever inject type happens to be
**first in the global list** — frequently a *sibling spec's*. When that sibling's `afterEach`
deletes its own inject type, the cascade silently destroys this spec's catalog mid-test. The
observed symptoms follow exactly: `Add Inject`/`New Inject` not visible and the catalog
detail-row `app-inject-list` missing — the catalog row is gone.

Files with the unfiltered picker: `copy-inject.spec.ts:150`, `copy-catalog.spec.ts:116`,
`expand-catalog-to-view-injects.spec.ts:105`, `download-catalog-as-json.spec.ts:122`,
`inject-type-catalog-inject-end-to-end.spec.ts:126`.

**Fix (not a workaround):** each spec filters the option list to the inject type it created
itself, `hasText: <its own INJECT_TYPE_NAME>`, and uses `tempBlueprintName()` so the name is
unique per run. This is the correct assertion of intent — the spec means "the catalog I build
uses the inject type I made" — and it removes the cross-spec coupling entirely.

## Teardown purge was matching almost nothing (fixed)

`purgeAllBlueprintTestData` filtered on `name.startsWith('TestBP-')` plus a hand-maintained
list of literal names, but the specs generate ~50 distinct prefixes (`DeleteUnit-`, `EditUnit-`,
`SearchMatch-`, `ViewUsers-`, `ViewList1-`, `ExpandUnit-Unit-`, `OrgFilterTest-`, ...). So the
safety net swept none of them. A live stack was found holding **11 leaked units and 5 leaked
MSELs**.

Replaced the prefix allowlist with `TEMP_NAME_PATTERN = /-\d{13}-\d{1,6}$/` +
`isTempBlueprintName()`, matching the *shape* `tempBlueprintName()` emits regardless of prefix.
A new spec inventing a new prefix is now covered automatically. First run after the change swept
all 10 remaining units and 5 MSELs.

## Fresh-database validation — the minikube script does not apply

The user suggested `/workspaces/crucible-development/minikube/clean-postgres.sh`. That script is
**Kubernetes-only**: it locates a postgres *StatefulSet* via `kubectl`, deletes PVCs/PVs, and
`minikube ssh`es in to remove hostPath data. Under Aspire there is no StatefulSet, so it exits 1
at the `if [[ -z "$POSTGRES_STS" ]]` guard without touching anything.

Aspire runs Postgres as a Docker container instead:
```
container: crucible-postgres  (postgres:17.6)
volume:    crucible.apphost-80a78300df-postgres-data -> /var/lib/postgresql/data
```
So the Aspire-equivalent reset is: `aspire stop` → `docker volume rm <that volume>` →
`aspire start` (Aspire/EF re-provisions and migrates on boot). Confirmed with the user before
running, since it destroys all local Crucible data across every app, not just Blueprint.

## Test-helper defects found and fixed (each made specs pass while covering nothing)

### 1. `createScenarioEvent` never sent `scenarioEventType` → 17 specs seeded unrenderable events

`EventType` is `Inject=10, Information=20, Facilitation=30`, so **0 is not a member**. The
helper omitted the field; verified live that the API then echoes `"scenarioEventType": 0`.
The grid picks a row's columns via `rowDataFields` (scenario-event-list.component.ts):
```ts
(ev.scenarioEventType === EventType.Inject       && df.onScenarioEventList) ||
(ev.scenarioEventType === EventType.Information  && df.isInformationField)  ||
(ev.scenarioEventType === EventType.Facilitation && df.isFacilitationField)
```
With 0 no branch matches, `rowDataFields` returns `[]`, and every cell is blank regardless of
DataValues. 17 specs used this helper and could therefore only ever assert row *presence*.
Fixed: added a `ScenarioEventType` const and default `Inject`.

Also removed `description` and `moveNumber` from the options type — neither exists on
`ViewModels/ScenarioEvent.cs`, so both were silently dropped. Three specs passed `moveNumber: 1`,
which read as a precondition while doing nothing. The two playbook specs now use
`createRenderableScenarioEvent` so their event actually has content to render.

**This did NOT invalidate BP-5** — I re-verified BP-5 independently with a correct `Inject`
event and a populated DataValue:
```
PUT /api/dataValues/{id} value=BP5ProbeText     -> 200
GET /api/msels/{id}/scenarioEvents -> events: 1, dataValues: []      <-- BP-5, still real
GET /api/scenarioEvents/{eventId}  -> dataValues: 1, ['BP5ProbeText'] <-- correct
```
So the blank grid had *two independent causes*; fixing the test-side one leaves BP-5 standing
and its skip justified.

### 2. `seedMselDataFields` depended on a pre-existing `Standard MSEL` row → fresh DB breaks the suite

It located a MSEL literally named `Standard MSEL` and cloned its 13 DataFields. Nothing in the
suite creates that row — it is dev-stack data (`GET /api/msels` shows it as the only
`isTemplate` row with a name, alongside leaked `New MSEL` rows and BP-3's empty-named ones).
That is the exact CLAUDE.md prohibition, and it is a transitive dependency of every
scenario-events / playbook / event-detail spec: on the fresh database the user asked for, all of
them would fail in `beforeEach`.

Fixed by declaring the 13 fields literally (`STANDARD_DATA_FIELDS`, captured from the template
but no longer read from it) and creating them directly, so the helper works on an empty
database. The old clone-from-a-source-MSEL behaviour is retained as `copyMselDataFieldsFrom`
for the rare spec that genuinely needs to mirror another MSEL's schema. `seedMselDataFields`
now also asserts it created all 13 rather than silently under-seeding.

### 3. Contributors spec asserted on a control that does not exist

`expand-unit-to-manage-user-msel-roles` looked for `mat-checkbox`. The expanded row actually
renders a **multi-select `mat-select` labelled "MSEL Roles"** per user. The wrong locator
matched 0 elements, and an `if (count > 0) … else assert the row is still visible` fallback hid
it — the else branch re-asserted something proven four lines earlier, so both branches passed
unconditionally and the spec's named behaviour was never tested.

Its header also claimed users cannot be seeded ("Blueprint provisions them on first login").
Disproved: `POST /api/users` (201, client-supplied id) and `POST /api/unitusers` (201) both
work; `GET /api/units/{id}/users` reads the membership back (note `unit.users` is always `[]`,
which is what misled the earlier attempt). Added `createBlueprintUser`, `deleteBlueprintUser`,
`addUserToUnit`, `removeUserFromUnit`, `listUnitUsers`.

Rewrote the spec to seed a user, put it in the unit, assign the **Editor** role, and assert it
persists across a reload. **Proved it has teeth**: with the role-assignment click removed the
spec fails (`Expected substring "Editor" / Received ""`); restored, it passes.
