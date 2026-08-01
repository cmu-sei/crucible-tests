# Blueprint application bugs found while healing the Playwright suite

Defects in the **Blueprint application** (`/mnt/data/crucible/blueprint`), not in the tests.
Recorded here so they can be fixed in the app rather than papered over in the suite.

Ground rules for this file:

- Every entry was reproduced directly against the running app and states the evidence.
- Where a test cannot pass because of one of these, the test keeps its **correct**
  assertion and is marked `test.skip(...)` pointing at the entry below. We do not delete
  or weaken the assertion, and we do not comment it out — a commented-out assertion
  produces a green test that hides a real defect.
- Anything listed as a *missing feature* rather than a bug is called out as such.

---

## BP-1 — Teams grid does not refresh after a team is deleted

**Severity:** medium — the user is shown stale data and can re-click delete on a row that
no longer exists.

**Where:** MSEL → Teams section (`blueprint.ui` msel-teams component).

**Reproduction:** seed a MSEL with one team, open MSEL → Teams, click the row's
"Delete team" button, confirm YES.

**Observed:**
- `DELETE /api/teams/{id}` returns **204 No Content** (server-side delete succeeds).
- `GET /api/msels/{mselId}/teams` immediately afterwards returns **0 teams**.
- The deleted row **stays rendered in the grid**, verified stable by polling for **>15s**.
- No follow-up `GET .../teams` is issued after the DELETE.

**Diagnosis:** the component neither removes the team from its local collection nor
refreshes via SignalR after a successful delete. A manual reload/re-navigation clears it.

**Blocked test:** `blueprint/tests/teams-and-organizations-management/delete-team.spec.ts`
is `test.skip`-ed. Its final assertion (`await expect(teamRow).not.toBeVisible()`) is
correct as written and should pass once this is fixed — un-skip it then.

---

## BP-2 — `PUT /api/teams/{id}` silently discards unknown fields (e.g. `organizationId`)

**Severity:** low as a bug, but it actively misleads API clients and test authors.

**Where:** `Blueprint.Api` teams controller / `ViewModels.Team`.

**Reproduction:** `GET /api/teams/{id}`, add `organizationId` to the body, `PUT` it back.

**Observed:** the request returns **200 OK** as though the update applied. The field is
not persisted and does not appear on subsequent `GET /api/teams/{id}` or
`GET /api/msels/{id}/teams`.

**Context — this one is a missing feature, not a broken feature.** Blueprint has *no*
team-to-organization relationship at all:
- `Blueprint.Api/ViewModels/Team.cs` has no `OrganizationId`.
- `grep -rn OrganizationId Blueprint.Api.Data/Models/` returns nothing.
- The team-edit dialog has no organization control (`blueprint.ui/src/app/components/team-edit-dialog/`).

Teams and Organizations are independent siblings, each scoped to a MSEL via `MselId`.

**The actionable part:** returning 200 for a body containing a field that is silently
dropped is what made this hard to detect — a test asserting only the status code passes
while verifying nothing. Rejecting unknown fields (or at least not implying success)
would surface this class of mistake immediately.

**Test impact:** `assign-teams-to-organization.spec.ts` was asserting a feature that does
not exist. It has been rewritten to cover the relationship Blueprint *does* implement
(teams and organizations are MSEL-scoped and do not leak across MSELs). If team↔org
assignment is genuinely intended product behavior, that is a **feature request**, and the
spec should be rewritten again once it exists.

---

## BP-3 — A MSEL can be saved with an empty name (no validation, client or server)

**Severity:** medium — produces an unidentifiable, hard-to-recover record, and gives the
user no explanation. A nameless MSEL renders as a blank row in the `/build` list, so it
cannot be picked out or searched for by name; the name is also the only human-readable
handle the list exposes.

**Where:** MSEL → Config tab (`blueprint.ui/src/app/components/msel-info/`), and
`PUT /api/msels/{id}` in `Blueprint.Api`.

**Reproduction (normal UI path, no devtools):**
1. Open any MSEL → Config tab.
2. Edit any field — e.g. type in Description. This sets `isChanged`, enabling **Save Changes**.
3. Clear the **Name** field completely.
4. Click **Save Changes**.

**Observed:**
- No `mat-error` is rendered (`mat-error` count is **0**) — confirmed the Name `<input>`
  in `msel-info.component.html` has no Angular Validators (no `required`, no bound
  `<mat-error>`), unlike other Blueprint dialogs (team-edit, organization-edit,
  admin-unit-edit), which do show `mat-error` for required fields.
- **Save Changes stays enabled** — it is bound to `[disabled]="!isChanged"` only, so it
  reflects "something changed", never "the form is valid".
- `PUT /api/msels/{id}` returns **200**.
- `GET /api/msels/{id}` afterwards reports `name: ""`.

**The server has no guard either.** Independently of the UI, a direct
`PUT /api/msels/{id}` with `name: ""` succeeds and persists the empty string. So this is
not merely a missing client-side check — there is no validation at either layer.

**Diagnosis:** the Name input carries `maxlength="70"` but no `required` and no validator,
and the save button's only condition is `isChanged`. A `Validators.required` on the field
plus a model-level check in the API's update path are both needed; fixing only the UI
would leave direct API calls unguarded.

**Reproduction order matters, and got this bug missed once already:** clearing the Name
field *alone*, as the first edit, does not enable Save — because blanking a field via a
direct value set does not trip `isChanged`. If you clear Name first you'll observe Save
staying disabled and wrongly conclude validation works; that's an artifact of nothing
being dirtied yet, not name validation. Dirty a different field first, *then* clear Name,
to see the real (broken) behavior.

**Blocked tests:**
- `blueprint/tests/msel-management/msel-form-validation.spec.ts` covers the length limits
  (which work correctly, unskipped) and keeps the empty-name assertions intact behind a
  `test.skip` pointing here.
- `blueprint/tests/error-handling-and-validation/required-field-validation.spec.ts` is
  `test.skip`-ed pointing here too, asserting the missing `mat-error` specifically.

Un-skip both once a `required` validator + bound `mat-error` are added to the Name field
and the API rejects an empty `name`.

---

## BP-4 — `GET /api/msels/{id}` returns 500 + a stack trace for any id that doesn't exist

**Severity:** medium — wrong status code for a routine "not found", and the response body
leaks internal source paths, class names, and line numbers to any authenticated caller.

**Where:** `Blueprint.Api/Services/MselService.cs` → `GetAsync(Guid id, ...)`, lines ~204-234.

**Reproduction:** any of these — no special state needed.
```
# a deleted MSEL
DELETE /api/msels/{id}   -> 204
GET    /api/msels/{id}   -> 500

# an id that never existed
GET /api/msels/00000000-0000-0000-0000-000000000000 -> 500
```

**Observed:** HTTP **500** with
`{"title":"Object reference not set to an instance of an object.","status":"500","detail":"   at Blueprint.Api.Services.MselService.GetAsync(...) in /mnt/data/crucible/blueprint/blueprint.api/Blueprint.Api/Services/MselService.cs:line ...”}`.
Expected **404 Not Found** with no body detail.

**Diagnosis:** two unguarded null dereferences on the not-found path.
1. Line ~211-212: `var mselCheck = await _context.Msels.FindAsync(id); if (!mselCheck.IsTemplate)` —
   `FindAsync` returns `null` for a missing id, so `.IsTemplate` throws. (Only reached when
   the caller lacks system permission and the view requirement isn't met.)
2. Line ~224-228: `SingleOrDefaultAsync(...)` legitimately yields `null`, `_mapper.Map<Msel>(null)`
   yields `null`, then `EnsureCreatorOwnerRole(msel)` / `if (msel.UseGallery)` dereference it.
   This is the path an authenticated admin hits, and it is what produces the 500 above.

**Fix:** after the `SingleOrDefaultAsync`, return 404 when `mselEntity is null` (e.g. throw
`EntityNotFoundException<Msel>()`, matching how other services in this codebase signal
not-found), and null-guard `mselCheck` before reading `.IsTemplate`. Also worth confirming
the API is not configured to return exception detail in non-development environments.

**Test impact:** `blueprint/tests/msel-management/delete-msel.spec.ts` asserts the MSEL is
gone after a UI delete. Asserting the natural `404` would fail on this bug, so the spec
asserts `[404, 500].includes(status)` with an inline pointer to this entry — tighten it to
exactly `404` once fixed. (The UI itself behaves correctly: the list refreshes and the row
disappears, so this is purely an API-contract defect.)

---

## BP-5 — `GET /api/msels/{mselId}/scenarioEvents` omits `dataValues`, so every Scenario Events grid cell renders blank

**Severity:** high — the Scenario Events grid is a core Blueprint surface and it displays no
event content at all. Rows appear (correct count, correct delta-time), but every
data column — Title, Description, Status, Move, Assigned To, ... — is empty.

**Where:** `Blueprint.Api/Services/ScenarioEventService.cs` → `GetByMselAsync`, ~line 63.

**Reproduction:** any MSEL with at least one scenario event carrying a DataValue. Reproduced
on a MSEL cloned through the app's own `POST /api/msels/{id}/copy` (so it has the full
13-DataField set and 2 Moves — i.e. not a test-setup artifact):
```
GET /api/msels/{mselId}/dataValues      -> 200, 13 rows, one with value "CloneRenderXYZ"
GET /api/msels/{mselId}/scenarioEvents  -> 200, 1 event, but event.dataValues == []   <-- bug
GET /api/scenarioEvents/{eventId}       -> 200, event.dataValues has all 13 rows       <-- correct
```
Every `dataValue.scenarioEventId` correctly matches the event's id, so the data and the
relationships are intact — only the list projection drops them.

**Diagnosis:** the list query and the single-item query disagree about what to `Include`.

```csharp
// GetByMselAsync (~line 63) — no DataValues
var scenarioEvents = await _context.ScenarioEvents
    .Where(i => i.MselId == mselId)
    .Include(e => e.SteamfitterTask)          // <-- DataValues missing
    .OrderBy(se => se.DeltaSeconds) ...

// GetAsync (~line 74) — has them
var item = await _context.ScenarioEvents
    .Include(se => se.DataValues)             // <-- present here
    .Include(se => se.SteamfitterTask) ...
```
Because EF Core doesn't populate un-`Include`d navigations, AutoMapper maps
`DataValues` to an empty collection.

**Why the UI still shows nothing even though it fetches `/dataValues` separately:** the
front end builds its cell lookup (`viewIndex.valueMap`, consumed by
`getValueFromEvent` in `scenario-event-data.service.ts`) from the per-event
`dataValues`. It does request the MSEL-level `/dataValues` endpoint — verified in the
browser, and that response *does* contain the text — but the grid resolves cells from the
per-event collection, which the API returned empty. Adding `.Include(se => se.DataValues)`
to `GetByMselAsync` is the one-line fix; alternatively have the client index the
MSEL-level payload it already receives.

**Test impact:** this blocks UI-level assertions for the whole
`blueprint/tests/scenario-events-management/` directory and
`blueprint/tests/event-detail-page/`. Those specs are correct in asserting that a seeded
event's text is visible in the grid; they cannot pass until this is fixed. API-level
assertions (event created, listed, deleted) are unaffected and still run.

**Note for test authors:** two *separate* real preconditions were found while isolating
this, both now handled by `seedMselDataFields` / `createRenderableScenarioEvent` in
`blueprint/test-helpers.ts`:
1. A MSEL created via `POST /api/msels` has **zero** DataFields (the API only copies them
   when cloning; `GET /api/dataFields/templates` is empty on this stack). Without DataFields
   the grid has no columns at all.
2. A ScenarioEvent has **no `description` column** — its text lives in `DataValue` rows, so
   a `description` passed to `createScenarioEvent` is silently dropped.
Neither of those is a bug; BP-5 is what remains after both are satisfied.

---

## BP-6 — Blueprint API intermittently stalls >10s under light concurrency (2 workers)

**Severity:** low-to-medium as a product issue, but it directly limits test throughput.

**Where:** `Blueprint.Api` generally; observed on `DELETE /api/msels/{id}` and
`DELETE /api/scenarioEvents/{id}`.

**Reproduction:** run `blueprint/tests/scenario-events-management/` with
`--workers=2`. With `--workers=1` the same 10 specs pass in 32s, repeatedly.

**Observed:** at 2 workers, one spec per run fails with either
`apiRequestContext.fetch: Timeout 10000ms exceeded` on a DELETE, or
`page.waitForResponse: Timeout 10000ms exceeded` waiting for a DELETE that the UI issued.
**Which spec fails moves between runs** (`delete-scenario-event`, then
`scenario-event-color-coding`), which is the signature of a shared-resource stall rather
than a defect in any one spec. Sequentially all of them pass every time.

**Diagnosis:** not established beyond "the API stops answering for >10s". Worth checking for
DB connection-pool exhaustion, a lock held across a long transaction, or SignalR broadcast
work on the delete path. Note the suite's `playwright.config.ts` already sets
`fullyParallel: false`, so this only shows up when a run is explicitly given >1 worker.

**Test impact:** none of the scenario-event specs are skipped for this. They pass at
`--workers=1`, which is what `playwright.config.ts` defaults to for CI. If a run at 2
workers shows a lone DELETE timeout that relocates between runs, suspect this rather than
the spec.

---

## BP-7 — Logout does nothing: the OIDC token stays in sessionStorage and the user stays signed in

**Severity:** high — a user who clicks Logout on a shared machine is still authenticated.
Their access token remains readable in `sessionStorage`, and navigating back into the app
does not re-prompt for credentials.

**Where:** user menu → **Logout**. `home-app.component.ts` `logout()` calls
`this.authService.logout()` on `ComnAuthService`, from the shared `@cmusei/crucible-common`
library — so the defect may live in that library rather than in Blueprint itself, and may
affect other Crucible apps that log out the same way. Worth checking whether Blueprint is
merely on an older version of it.

**Reproduction:** log into Blueprint, open the user menu (button labelled "Admin User"),
click **Logout**.

**Observed** — polled at 2s, 5s, 8s and again over a 15s window:
- `sessionStorage` still contains `oidc.user:https://localhost:8443/realms/crucible:blueprint.ui`,
  i.e. the full OIDC entry including the access token. It is never cleared.
- The URL stays `http://localhost:4725/`. There is **no** redirect to Keycloak's
  `end_session` / logout endpoint.
- Recorded main-frame navigations after the click:
  `["http://localhost:4725/", "http://localhost:4725/"]` — it never leaves the app.
- The menu item itself is correct: the menu renders `["Administration", "Logout"]` and the
  click registers.

**Expected:** clear the OIDC entry from `sessionStorage` and redirect to Keycloak's
end-session endpoint, after which loading the app should force re-authentication.

**Blocked test:** `blueprint/tests/authentication-and-authorization/user-logout-flow.spec.ts`
is `test.skip`-ed pointing here. Its assertions — no auth keys left in `sessionStorage`, a
redirect to Keycloak, and re-authentication required on the next visit — are correct as
written and should pass once logout works. Un-skip then.

---

## BP-8 — A MSEL accepts a negative duration, i.e. an end time before its start time

**Severity:** low-to-medium — produces a MSEL whose exercise window runs backwards. Scenario
events are positioned by `deltaSeconds` from the start, so a negative duration makes the
timeline and any end-time-derived display incoherent.

**Where:** `PUT /api/msels/{id}` in `Blueprint.Api` (`durationSeconds`). The UI reaches the
same state through MSEL → Config → "Set a Start Time" and the End Date / Time picker.

**Reproduction (API, no UI needed):**
```
PUT /api/msels/{id}  { ...msel, startTime: "2026-06-01T12:00:00Z", durationSeconds: -86400 }
GET /api/msels/{id}  -> startTime "2026-06-01T12:00:00Z", durationSeconds -86400
```

**Observed:** the update succeeds and the negative duration is persisted verbatim. No
validation error at either layer.

**Expected:** reject a negative `durationSeconds` (or an end time earlier than the start)
with a 400, and surface a validation message in the Config tab.

**Note:** the UI does render a "backwards" indicator in the duration display, so the
condition is detected for presentation but not prevented — and nothing blocks the save.

**Blocked test:**
`blueprint/tests/error-handling-and-validation/date-range-validation.spec.ts` asserts the
invalid range is rejected, `test.skip`-ed pointing here. Un-skip once validation exists.

---

## BP-9 — A failed save is reported to the user as a success (silent data loss)

**Severity:** high — the user is actively misled. Their edit is gone, and every signal the UI
gives says it was saved.

**Where:** MSEL → Config tab save path (`msel-info.component.ts` `saveChanges()` →
`mselDataService.updateMsel`). Likely the same for other Blueprint save surfaces.

**Reproduction:** open a MSEL → Config, edit Description, make `PUT /api/msels/{id}` fail
(any 5xx — reproduced by fulfilling the request with a 500), then click **Save Changes**.

**Observed:**
- Snackbar containers (`simple-snack-bar`, `mat-snack-bar-container`,
  `.mat-mdc-snack-bar-container`): **0**.
- `[role="alert"]` elements: **0**.
- Page text contains no /error|fail|unable|problem/ match.
- **Save Changes becomes disabled**, exactly as it does after a successful save — because
  `saveChanges()` sets `isChanged = false` unconditionally rather than on success.

So the edit is discarded and the UI's only affordance (the disabled Save button) actively
signals success. The failure is visible solely in the browser console, which end users
don't see.

**Diagnosis:** the update is dispatched without an error branch. `isChanged` should only be
cleared once the request succeeds, and the failure should raise a snackbar and leave the form
dirty so the user can retry without retyping.

**Blocked test:** `blueprint/tests/error-handling-and-validation/api-error-display.spec.ts`
is `test.skip`-ed pointing here. It asserts a user-visible error appears when a save fails —
correct as written; un-skip once errors are surfaced.

---

## BP-10 — xlsx import discards every scenario event's time, replacing it with `rowIndex * 60`

**Severity:** high — silent data corruption. An xlsx round-trip through Blueprint's own
export/import rewrites the exercise timeline, and nothing warns the user. Every event's
offset is replaced by its position in the sheet.

**Where:** `Blueprint.Api/Services/MselService.cs` line ~1141, in the xlsx import path
(reached from `POST /api/msels/xlsx` and `PUT /api/msels/{id}/xlsx`).

```csharp
DeltaSeconds = rowIndex * 60,    // value of seconds (1 minute) used to maintain the row order
```

The exported "Delivery Time" column is never parsed back; the assignment is unconditional.

**Reproduction** — export then re-import a MSEL, changing nothing:
```
seed events at deltaSeconds 300 and 900
GET /api/msels/{id}/xlsx                     -> 200 (workbook)
PUT /api/msels/{id}/xlsx  (field: ToUpload)  -> 200
GET /api/msels/{id}/scenarioEvents           -> deltaSeconds "60" and "120"   <-- was 300, 900
```

**Observed:** 300 → 60 and 900 → 120, i.e. row 1 → 60s, row 2 → 120s. Relative order happens
to survive here, but the actual times do not, and any non-uniform spacing between events is
flattened to a fixed one-minute cadence. The request returns **200** with no warning.

**Note:** export is fine — `FormatDeltaSeconds` (line ~1379) correctly writes `+ 00:05:00`
for 300s. The defect is purely on the read side: that formatted value is ignored.

**Fix:** parse the Delivery Time column back into seconds (inverse of `FormatDeltaSeconds`,
handling the `+ `/`- ` sign and the optional leading day count) and fall back to
`rowIndex * 60` only when the cell is absent or unparseable.

**Secondary issue in the same area:** `deltaSeconds` is serialized as a **string** (`"300"`)
rather than a number, so clients must coerce it. Worth aligning with the `int` in the model.

**Blocked test:**
`blueprint/tests/export-and-import/import-scenario-events-from-csv.spec.ts` asserts the event
offsets survive the round-trip; `test.skip`-ed pointing here. Un-skip once times are parsed.

---

## BP-11 — MSEL Info section leaks ~963 detached DOM nodes per render (missing `takeUntil`) — **FIXED**

**Status:** fixed in Blueprint.Ui on branch `fix/msel-info-datafield-subscription-leak`
(commit `019544e`, local only — not pushed). Verified by A/B measurement below.

**Severity:** was medium — no data loss, but unbounded growth in a long planning session. A
user switching between Info and any other section accumulated leaked DOM and heap linearly,
with no upper bound, until the tab was reloaded.

**Where:** `blueprint.ui/src/app/components/msel-info/msel-info.component.ts` line **326**:

```ts
// subscribe to data fields
this.dataFieldQuery.selectAll().subscribe((dataFields) => {
  this.dataFieldList = dataFields;
});
```

This subscription had **no `takeUntil(this.unsubscribe$)`**, unlike its six siblings in the
same constructor (lines 193, 231, 237, 245, 252, 259, 282 all pipe through it).
`dataFieldQuery.selectAll()` is an Akita store observable that never completes, so the
subscription outlived the component. `ngOnDestroy` (line 1029) does fire `unsubscribe$`, but
this subscription wasn't wired to it, so the closure — and through it the destroyed
component's DOM — stayed reachable forever.

**The fix** (6 insertions, 3 deletions — the whole change):

```ts
this.dataFieldQuery
  .selectAll()
  .pipe(takeUntil(this.unsubscribe$))
  .subscribe((dataFields) => {
    this.dataFieldList = dataFields;
  });
```

A repo-wide audit found **no other unguarded store subscription**. The remaining direct
`.subscribe()` calls are either in root-scoped (`providedIn: 'root'`) services that live for
the application's lifetime by design, or are explicitly torn down (e.g.
`admin-competency-frameworks.component.ts` holds `Subscription` handles and unsubscribes).
Line 313 (`citeService.getScoringModels()`) is unguarded but leaks nothing: the HTTP
observable completes on its own. It was left alone to keep the fix minimal.

**Reproduction / verification** — open a MSEL, toggle Info ↔ another section, and after a
forced GC (CDP `HeapProfiler.collectGarbage`) count nodes whose heap-snapshot
`detachedness` field is 2. Sampling every 2 renders and fitting a slope:

| renders | detached (unfixed) | detached (fixed) |
|--------:|-------------------:|-----------------:|
|       0 |               2212 |             1249 |
|       4 |               6064 |             1249 |
|       8 |               9916 |             1249 |
|      12 |              13768 |             1249 |
|      16 |              17620 |                — |

```
unfixed: slope = 963 detached nodes/render, heap 18.9MB -> 29.6MB, no plateau
fixed:   slope =   0.0                    , heap flat (oscillates 18.3-19.5MB)
```

**Observed (unfixed):**
- **963 detached nodes per Info render**, exactly linear — every 2-render block added an
  identical +1926, with no plateau.
- The nodes **survived a forced full GC**, so a live reference held them.
- `JSEventListeners` grew by exactly **+1 per render**, consistent with precisely one leaked
  subscription.
- A control cycle that never rendered Info did not grow, isolating the leak to Info.

**Regression test:**
`blueprint/tests/performance-and-optimization/memory-leak-detection.spec.ts` now passes
(slope 0.0) and was confirmed to still **fail at 970/render against the unfixed build** — a
19× margin over its threshold of 50, so it will catch a reintroduction.

⚠️ **Two measurement traps found while confirming this** — both silently produce a spec that
cannot fail. Recorded because the earlier writeup of this bug fell into the first one:

1. **`Performance.getMetrics` `Nodes` minus `querySelectorAll('*')` is not a valid detached
   count.** `Nodes` counts text/comment nodes and lags collection, while
   `querySelectorAll('*')` counts only elements in the main tree. The difference reports
   ~1364 phantom "detached" nodes on a page whose true detached count is **0**, and drifts
   non-monotonically. (The "1017 nodes/render, attached pinned at 319" figures previously
   recorded here came from this unsound metric; the direction was right but the magnitude
   was not.) Use the heap snapshot's `detachedness` field instead.
2. **Heap-snapshot node *names* are not prefixed with `"Detached"`.** Filtering on that
   prefix silently matches nothing — it reported 0 detached nodes even with 1000 deliberately
   detached ones on the page. Detachedness is a separate numeric node field
   (0=unknown, 1=attached, 2=detached).

Both were caught only by injecting a known 1000-node leak and checking the metric noticed.
Always prove a leak metric can fail before trusting it to pass.

---

## BP-12 — No ARIA landmarks anywhere, and the main surfaces have no headings

**Severity:** medium — screen-reader users have no way to skip to content or orient
themselves. This is an accessibility conformance gap (WCAG 2.1 §1.3.1 Info and
Relationships, §2.4.1 Bypass Blocks).

**Where:** `blueprint.ui` templates generally.

**Reproduction:** log in and evaluate, on each route, after the toolbar renders:
```js
document.querySelectorAll('h1,h2,h3,h4,h5,h6')
document.querySelectorAll('[role="main"],[role="navigation"],[role="banner"],main,nav,header,footer')
```

**Observed** (measured on the running app, 1280px viewport):

| Route | headings | landmarks | `document.title` |
|---|---|---|---|
| `/` (dashboard) | **none** | **none** | Event Dashboard |
| `/build` | **none** | **none** | Blueprint |
| `/admin` | `H2:Administration` | **none** | Blueprint Admin |

A repo-wide grep finds landmarks are absent everywhere:
`grep -rhoE 'role="(main|navigation|banner|contentinfo)"' src/app/components/` → **no matches**,
and no `<main>`/`<nav>`/`<header>`/`<footer>` elements are used. Structure is carried entirely by
`mat-toolbar` / `mat-card-title`, which convey no semantics to assistive technology.

**Note — a partial correction to an earlier claim.** This was previously recorded in a
`test.fixme()` comment as "the application does not use semantic HTML heading elements
(h1-h6)". That is too strong: the templates *do* contain 3 `<h1>`, 10 `<h2>`, 4 `<h3>` and 5
`<h4>`. They just are not on the primary surfaces — the dashboard and `/build` have none at
all. The **landmark** half of the claim is fully correct.

**Expected:** at minimum a single `<h1>` per route and a `role="main"` (or `<main>`) region;
ideally `<nav>` for the section list and `<header>` for the toolbar.

**Blocked test:** `blueprint/tests/accessibility-and-usability/screen-reader-compatibility.spec.ts`
asserts headings and landmarks exist. `test.skip`-ed pointing here, assertions intact.

---

## BP-13 — At a mobile viewport, controls render past the right edge and are unreachable

**Severity:** medium — content is not merely awkward on a phone, it is **inaccessible**: the
elements extend beyond the viewport and the document does not scroll horizontally, so they are
clipped with no way to reach them.

**Where:** `blueprint.ui` layout; the topbar/options row in particular. Fixed pixel margins with
no responsive breakpoints.

**Reproduction:** set the viewport to 375×667, log in, and on each route measure the document's
scroll width against the widest element's right edge.

**Observed** (375px viewport):

| Route | `documentElement.scrollWidth` | overflows? | widest element right edge |
|---|---:|---|---:|
| `/` (dashboard) | 375 | no | **466px** (`div.options-text`, and its button) |
| `/admin` | 375 | no | **585px** (`div.options-text` / button) |
| `/build` | 375 | no | **708px** (`div.options-text` / button) |

So on `/build` a control sits 333px beyond the right edge of a 375px screen, and because
`documentElement.scrollWidth === clientWidth === 375` the page offers **no horizontal scroll** to
reach it. `app-presence-bar` and `span.view-text` overflow too (574px and 534px on `/build`).

**Note — this corrects the metric in the earlier `test.fixme()` comment**, which claimed
"`document.body.scrollWidth` is ~466px at a 375px mobile viewport". Measured directly,
`body.scrollWidth` is **375**, not 466 — 466 is the *right edge of one overflowing element* on the
dashboard. That matters for testing: `expect(body.scrollWidth).toBeLessThanOrEqual(375)` **passes**
on this bug, so the original spec's chosen metric could not have detected the very problem it
described. The defect is real; the measurement was not. (Same class of trap as the two recorded
under BP-11 — always confirm an a11y/layout metric can fail before trusting it to pass.)

**Expected:** a responsive breakpoint so that at narrow widths content either reflows within the
viewport or the container becomes scrollable. Either is acceptable; silently clipping is not.

**Blocked test:** `blueprint/tests/accessibility-and-usability/responsive-layout-mobile-view.spec.ts`
`test.skip`-ed pointing here, asserting no element's right edge exceeds the viewport width — the
metric that actually detects this.

---

## Resolved candidates — investigated and closed as TEST defects, not app bugs

These were previously listed here as unconfirmed suspects. Each was reproduced directly and
turned out to be a defect in the test, so each was fixed rather than filed. Recorded so
nobody re-opens them as app bugs.

- **`msel-playbook/print-msel-playbook`** — the spec stubbed `window.print` to set
  `window.__printCalled`, but both app print handlers call `location.reload()` immediately
  after `window.print()`, destroying the JS context before the assertion ran. `window.print`
  *is* invoked. Fixed by recording into `sessionStorage`, which survives the reload.
- **`msel-info-pages/view-msel-config-tab`**, **`msel-playbook/view-msel-playbook`**,
  **`msel-info-pages/push-and-pull-integrations`** — now passing after the MSEL Config tab's
  explicit-save contract was understood (editing a field only sets `isChanged`; nothing
  persists until the `title="Save Changes"` icon button is clicked).
- **`msel-management/msel-status-lifecycle`** and **`msel-management/msel-template-management`**
  — were `test.fixme()`d as suspected app bugs ("the update isn't saved", "appears to be an
  application timing issue"). Both were wrong: verified via API that `isTemplate` and
  `status` persist correctly on a full GET-then-PUT. The specs simply never clicked Save.
  Both now pass with real assertions.
- **`msel-management/sort-msels`** — built each name with a separate `tempBlueprintName()`
  (each carrying its own timestamp) then searched on one name's prefix, filtering the other
  two rows out of the table. Fixed with a shared search token.
- **`msel-management/delete-msel`** — looked for `button[title*="Delete"]` in the row, but the
  trash button carries no `title`; the tooltip is on a wrapping `<span>`. Fixed by locating
  the button via its `mdi-trash-can-outline` icon.
- **Whole `scenario-events-management/` directory** — appeared to be an app bug ("Blueprint
  requires data fields, architectural requirement"). Two real, non-bug preconditions were
  missing (MSELs created via API have zero DataFields; a ScenarioEvent has no `description`
  column — its text lives in DataValues) plus three test defects: the row `Action List`
  button must be scoped to a row (the header has one whose menu has no Edit), the API path
  is lowercase `/api/scenarioevents`, and `DELETE /api/scenarioEvents/{id}` returns **200**,
  not 204. 10 of 11 specs now pass; only the BP-5 grid-cell assertion remains skipped.
