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

## `launch-and-join-workflows`: why the bare `test.skip()`s were there

Four specs in this directory self-skipped with bare `test.skip()` when their MSEL cards were
absent. Traced to source rather than guessed:

`MselService.cs:2203` —
```csharp
public async Task<IEnumerable<ViewModels.Msel>> GetMyLaunchInvitationMselsAsync(CancellationToken ct)
{
    // DISABLED: Auto-discovery based on email domain matching
    // Users must now use invitation links directly to launch MSELs
    return new List<ViewModels.Msel>();
}
```
It returns an empty list **unconditionally**. Verified live: `GET /api/my-launch-msels` -> `[]`
(200). So the `/launch` page's card list is empty by design, and no amount of seeding makes a
card appear — the launch flow is reachable only through an invitation link.

This is a deliberate product decision, **not a bug**, so it does not get a BP-n entry. But it
does mean a spec that drives the launch *cards* can never assert anything, which is exactly why
those specs degenerated into `if (!visible) test.skip()`.

`/join` is different and IS testable — `GetMyJoinInvitationMselsAsync` (`MselService.cs:2178`)
returns MSELs where the user is on a team AND `msel.Status == Deployed` AND
`msel.PlayerViewId != null`. Those are seedable preconditions.

Note the launch button is `title="Start {{ msel.name }}"`, so it is precisely locatable once a
card exists; the old specs used `button:has-text("Start")` plus invalid comma-combined
`text=A, text=B` selectors (which match zero elements — `text=` engines cannot be comma-joined).

## Accessibility: two `test.fixme()`s were hiding real defects behind wrong measurements

Both were bare `test.fixme()`s with explanatory comments. Verified each claim against the
running app; both comments were partly wrong, and one was wrong in a way that mattered.

**BP-13 (mobile layout).** The comment claimed `document.body.scrollWidth` is "~466px at a
375px mobile viewport". Measured: `body.scrollWidth` is **375**. So the spec's central
assertion `expect(bodyWidth).toBeLessThanOrEqual(375)` **would have passed** — the metric could
not detect the defect its own comment described. 466 is the right edge of *one overflowing
element*, not the document width.

The real defect, at 375x667:

| route | `documentElement.scrollWidth` | overflows? | widest element right edge |
|---|---:|---|---:|
| `/` | 375 | no | 466px |
| `/admin` | 375 | no | 585px |
| `/build` | 375 | no | **708px** |

Elements sit up to 333px beyond the right edge *and* the document does not scroll
horizontally, so they are clipped and unreachable. Rewritten to assert every visible
interactive element's right edge is within the viewport — confirmed it reports 7 offenders on
`/` today.

**BP-12 (screen reader).** Landmarks are genuinely absent everywhere (no
`role="main"|navigation|banner|contentinfo`, no `<main>/<nav>/<header>/<footer>` in any
template). But "the application does not use semantic HTML heading elements (h1-h6)" is too
strong — templates hold 3 `<h1>`, 10 `<h2>`, 4 `<h3>`, 5 `<h4>`; they are just absent from the
primary surfaces. Measured: `/` and `/build` have **no headings at all**, `/admin` has one
`<h2>`, none has a landmark. Confirmed the assertion fails today (0 headings on `/`).

Both are now `test.skip(true, 'BP-n: ...')` with correct assertions intact, and both were
**verified to fail when unskipped** — a skip whose assertion is wrong is no better than a
deleted one. Also removed the old sampling pattern (`.slice(0, 5)` over inputs/buttons/links,
which left the rest unchecked and hid which element failed) and the `if (count > 0)` guards
that made whole sections assert nothing.

## Housekeeping

`.playwright-mcp/` (scratch downloads from the playwright-test MCP server) was not gitignored,
and a stray xlsx from a generator agent's exploration got committed. Removed and ignored.

## Measurement caveat: a 5.4m "regression" that was really CPU contention

A `scenario-events-management/` run at 2 workers took **5.4 minutes** with one timeout
(`delete-scenario-event`), against 30s previously — which looked like a fresh BP-6 instance.
It was not. At that moment three subagents were each running their own Playwright suites:
`pgrep -f "playwright|chromium"` reported **11 live processes** on a 16-core box, and the same
directory finished in **36.4s at 1 worker** immediately afterwards.

Independent checks that ruled out the app:
- `aspire describe` — blueprint-api and blueprint-ui both `Healthy`.
- `aspire logs blueprint-api` — request handling at **1-3ms** (`GET /api/msels` 2.9ms,
  health/ready 1.3ms). No timeout, pool-exhaustion, lock or deadlock messages.
- Idle API latency: 4-10ms over three probes.
- Disk: 840G free; `test-results/` 12K. (The run also logged
  `ENOENT: ...playwright-artifacts-2/*.zip`, a symptom of a killed/contended worker rather
  than a cause.)

**Lesson for the final verification:** timing and flakiness measurements are only valid when
nothing else is running. The 5x-consecutive-green runs at the end must be done with **no
subagents active**, or the result is unreadable. This also means BP-6's original diagnosis
("the API stops answering for >10s" at 2 workers) may itself have been contaminated by
concurrent agent activity — worth re-measuring on an idle machine before treating it as an app
defect.

## BP-6 diagnosed: `POST /api/users` wedges the API, and it is NOT test flakiness

The full-suite run after all fixes gave **139 tests: 119 expected, 14 skipped, 4 flaky,
2 unexpected** — and all six non-green results were API calls timing out at 10s, mostly
`POST /api/users`. Investigated properly instead of blaming concurrency:

**Reproduced entirely outside Playwright, sequentially, with no browsers running:**
```
GET  /api/users  -> 200 in 0.008s      <-- reads are instant
POST /api/users  -> 000 after 20s      <-- hangs
POST /api/users  -> 000 after 25s      <-- still hangs, 0 chromium procs
```

**Not the database.** `pg_stat_activity` on the `blueprint` DB: 7 connections, **0 blocked
locks**, no query older than 0s. (Note the DB is named `blueprint`, not `blueprint_api` as
`appsettings.json`'s connection string suggests — Aspire overrides it.)

**Not the service method.** `UserService.CreateAsync` is `Add` + `SaveChangesAsync` + a re-GET;
nothing blocking.

**It is the synchronous SignalR fan-out on the write path.**
`Infrastructure/EventHandlers/UserHandler.cs:41-56` — `HandleCreateOrUpdate` builds a task per
group and **awaits `Task.WhenAll`** on `_mainHub.Clients.Group(groupId).SendAsync(...)` before
the HTTP request can complete. A leaked or half-dead hub connection therefore blocks the
POST indefinitely. Reads have no such handler, which is exactly why `GET` stayed at 8ms while
`POST` hung.

Supporting evidence: `aspire resource blueprint-api restart` **failed** — "Failed to stop
resource" — i.e. the process was wedged, not merely slow.

This supersedes BP-6's original "not established beyond 'the API stops answering'" diagnosis,
and it means BP-6 is a **real application defect**, not a test-harness artifact: any write whose
entity has a SignalR handler can be held hostage by one bad client connection. It also explains
why the symptom "moves between specs" — it depends on which write happens to run after a
connection goes stale.

The fix belongs in the app (fire-and-forget the broadcast, or bound it with a timeout /
`Task.WhenAny`), so it is recorded rather than worked around.

## Fresh-database validation: PASSED

Full reset (user-approved): `aspire stop` -> `docker rm -f crucible-postgres` ->
`docker volume rm crucible.apphost-80a78300df-postgres-data` -> `aspire start`, then deleted
`.auth/` so global-setup re-provisioned from scratch.

Fresh DB contents after migrations: **3 MSELs** (`MITRE`, `HSEEP`, `Standard MSEL`), **0 units**,
**1 user**. So `Standard MSEL` *is* migration-seeded rather than hand-made — but removing the
`seedMselDataFields` dependency on it was still correct: relying on a specific pre-existing row's
name and schema is exactly what CLAUDE.md forbids, and the suite no longer breaks if it changes.

**Result: `139 tests: 125 passed, 0 failed, 14 skipped`** — on a database with none of the
accumulated rows the suite had been running against. This is the real proof that every spec seeds
what it needs.

Compare the progression:

| Run | Passed | Failed | Flaky | Skipped |
|---|---:|---:|---:|---:|
| Baseline (start of session) | 112 | 1 | 4 | 19 |
| After fixes (wedged API) | 119 | 2 | 4 | 14 |
| **Fresh DB** | **125** | **0** | **0** | **14** |

### The restart also proved BP-6 is a process-state defect

`POST /api/users` had been hanging indefinitely (>25s, no browsers running). On the freshly
started API the same call is **8-22ms**. Nothing about the tests changed between those
measurements — only the API process was replaced. That confirms the diagnosis in the section
above: a leaked/half-dead SignalR connection blocks the synchronous `Task.WhenAll` fan-out in
`UserHandler.HandleCreateOrUpdate`, wedging every subsequent write on that entity. It is an
application defect that accumulates over a long session, not test flakiness.

## The 5-run streak is gated by BP-6, not by the tests

Verification runs on a freshly restarted stack, `run-tests.sh blueprint --browser chromium
--workers 2`, reading `results.json` strictly (the summary line counts a flaky retry as
"passed", so it is not sufficient evidence):

| Run | Summary | Strict (`results.json`) |
|---|---|---|
| 1 | 125 passed, 0 failed, 14 skipped | expected=124 flaky=1 unexpected=0 |
| 2 | 125 passed, 0 failed, 14 skipped | **expected=125 flaky=0 unexpected=0** |
| 3 | 125 passed, 0 failed, 14 skipped | expected=124 flaky=1 unexpected=0 |
| 4 | 122 passed, **3 failed**, 14 skipped | expected=120 flaky=2 unexpected=3 |

Run 4's three failures were all `apiRequestContext.fetch: Timeout 10000ms exceeded`
(`Assign Role to User`, `Remove Role from User`, `Delete Scenario Event`). Probed immediately
afterwards:

```
GET  /api/users -> 200 in 0.004s
POST /api/users -> 000 after 12s      <-- wedged again
```

**That is BP-6, for the fourth time this session.** The pattern is now well established: the
API serves reads normally and hangs every write on an entity with a SignalR handler, because
`UserHandler.HandleCreateOrUpdate` awaits `Task.WhenAll` over the hub fan-out before the HTTP
response. It recurs after roughly **3-4 full suite runs** as hub connections accumulate, and
restarting `blueprint-api` restores writes to 8-60ms every time — measured three separate
times, with no test change in between.

So the ceiling on "5 identical green runs" is an application defect, not test quality: the suite
is **125/125 with zero retries** when the API is healthy (run 2 above, plus the fresh-database
run). Fixing it needs an app change (fire-and-forget the broadcast, or bound it), which is out
of scope here per the instruction not to modify the API/UI.

### Flakiness work that did land

- `export-msel-to-csv` and `import-msel-from-excel`: a `mat-menu` still animating closed leaves
  the outgoing overlay in the DOM, so a second menu's item resolves but the click lands on the
  stale panel and times out. Both now settle on zero `.mat-mdc-menu-panel` before and after each
  open. csv verified 6/6 clean in isolation.
- `admin-inject-types-and-catalogs`: widening the `toPass` budget 20s -> 45s did **not** close
  the last retry, which is the signal that the problem is a shared resource rather than slowness.
  Added a real cross-worker mutex (`acquireAdminCatalogLock`, an `O_EXCL` lockfile with staleness
  reclaim, since Playwright workers are separate processes) so only one worker is on those pages
  at a time. Only these 11 specs serialize; the rest of the suite still runs at 2 workers.

## Final verification attempt: BP-6 makes 5 consecutive runs unachievable

After a full stack restart (fresh API process, `.auth/` deleted, `aspire wait` green on all
three resources):

| Run | Summary | Strict (`results.json`) |
|---|---|---|
| 1 | 125 passed, **0 failed**, 14 skipped | expected=122 flaky=3 unexpected=0 |
| 2 | 122 passed, **3 failed**, 14 skipped | expected=119 flaky=3 unexpected=3 |

Probed immediately after run 2, with zero browsers running:
```
GET  /api/users -> 200 in 0.007s
POST /api/users -> 000 after 12s
```

**Fifth confirmed occurrence, always the same signature: reads instant, writes hang.** The
interval has shortened over the session — early on it took 3-4 full runs to wedge, by the end
1-2. That is consistent with the mechanism (accumulating hub connections), and it means the
defect gets *worse* the more the suite is exercised, which is exactly the wrong direction for a
CI gate.

Also tried restarting `blueprint-api` before every run (`/tmp/final-verify.sh`). It does not
help, because the API wedges **during** a run, not between runs — a run that starts against a
healthy API can still lose its later specs.

### Bottom line on the finishing condition

The requested condition — 5 consecutive runs with identical results — is **not reachable while
BP-6 is unfixed**, and it is not a test-quality problem:

- On a healthy API the suite is **125 passed / 0 failed / 14 skipped**, reproduced many times,
  including **125/125 with zero retries** (run 2 of the earlier batch) and on a **completely
  fresh database**.
- Every failure in every degraded run is `apiRequestContext.fetch` / `waitForResponse` timing
  out on a **write**, never an assertion about app behaviour being wrong.

Fixing it requires an application change (`UserHandler.HandleCreateOrUpdate` should not await
the SignalR fan-out on the request path), which the instructions put out of scope. It is written
up as BP-6 with the reproduction, the source line, and the restart workaround.

## Final state (end of session)

Last run, on a freshly restarted stack with `.auth/` re-provisioned:

> **139 tests: 125 passed, 0 failed, 14 skipped** (`expected=124 flaky=1 unexpected=0`)

Worst BP-6 state observed came just before it: **even `GET /api/users` hung** (8s cap) while the
UI served in 1ms — previously only writes hung. `aspire resource blueprint-api restart` failed;
a full `aspire stop`/`start` cleared it. So the defect escalates from "writes hang" to "the API
stops answering" the longer the process lives.

**Session totals:** 15 commits. 112 -> 125 passing, 1 -> 0 failing, 19 -> 14 skipped,
11 -> 16 documented app bugs, 206 -> 81 sleep/networkidle, ~14 -> 3 bare `test.skip()`.
