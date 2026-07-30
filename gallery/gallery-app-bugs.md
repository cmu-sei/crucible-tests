# Gallery app bugs found while building the E2E suite

These are defects in the **Gallery application** (`/mnt/data/crucible/gallery`), not in the
tests. They were found while writing/repairing `gallery/tests/**`, and each was confirmed
from source and/or against the running stack — none is inferred from a test failure alone.

Where a bug blocks a documented test-plan scenario, the spec carries a `test.skip()` with a
pointer to this file, and `README.md`'s "Skipped tests" table has a row. Where the app is
merely *wrong but testable*, the test asserts the actual behavior and says so in a comment,
so the assertion is deliberate rather than an accident to be "fixed" later.

**Please tell the test suite when these are fixed** — several tests are pinned to the current
(buggy) behavior and should be tightened, not merely re-run. Each entry lists exactly what
to change.

---

## Status: the original 16 bugs are all FIXED (2026-07-30)

The 16 defects originally recorded here were fixed on the `bug-fixes` branch of each
repository and verified against a running Aspire stack. They have been removed from this
document; the sections below track only what is still **open**.

| Repo | Branch | Commits |
|---|---|---|
| `gallery.api` | `bug-fixes` | `87b546d`, `e008baa`, `9e2dda8`, `f50b391`, `784ae3d`, `46cfa54`, `7797209` |
| `gallery.ui` | `bug-fixes` | `f0a8a3f`, `7f4a836`, `4d22a85`, `ee3c613`, `ca9acf5`, `5f08f25`, `0a37a10`, `9f7603a`, `8fb05c7`, `4fc3f98`, `023e011`, `8b85554` |

Fixed, with the section number they were filed under: §1 admin-Exhibits sort/pagination,
§2 Collections Copy no-op, §3 Wall advance error message, §4 collection JSON upload 500,
§5 admin-teams null `shortName` crash, §6 invalid JSON upload (both halves), §7 `loadMine()`
clobbering the admin list, §8 download 500 on null Description, §9 constraint violations
returned as 500, §10 admin Collections `trackBy`, §11 card delete with articles,
§12 "Add a Card" dialog title, §13 `ArticleEntity.Exhibit` typed `CardEntity`, §14 Wall/Archive
stores not scoped to the exhibit, §15 article share had no confirmation, §16 `getQueryParams`
writing state during change detection.

Two design decisions worth recording, because the fix is not the only defensible one:

- **§11** now **rejects** the delete with `409 Conflict` and a message naming the blocking
  article count, rather than cascade-deleting the articles or nulling their `CardId`. Chosen
  so no content is destroyed by a single click.
- **§16** now always lands on the **Wall**, rather than restoring each exhibit's remembered
  section. The link carries `section=wall` explicitly and `getQueryParams` is pure.

The suite was updated in the same pass: three `test.skip()`s were removed, five specs that
deliberately asserted buggy behavior were flipped to assert the correct behavior, and the
`.first()` / `toPass()` workarounds that existed only because of §10 and §14 were deleted.

---

## Open bugs

Found 2026-07-30 while fixing the 16 above. All three are the *same class* of defect as
something that was just fixed, in a neighbouring code path that the original entry did not
cover. None is fixed, and none currently blocks a test.

### A. `admin-teams` sort crashes on a team with no name

**Severity:** same as the fixed §5 — an admin page renders no rows. Reachable by a click.

**File:** `gallery.ui/src/app/components/admin/admin-teams/admin-teams.component.ts`
(`sortTeams()`, `case 'name'`)

```ts
(a.name.toLowerCase() < b.name.toLowerCase() ? -1 : 1) *
```

`Team.name` is `name?: string | null` (`gallery.ui/src/app/generated/api/model/team.ts:32`),
so this is the identical unguarded `.toLowerCase()` that §5 fixed one case below, in the
`default`/`shortName` branch. It was left out of the §5 fix deliberately, to keep that commit
to one defect.

**Reachable:** yes, independently confirmed — `admin-teams.component.html:22` renders
`<div class="header-cell one-cell" mat-sort-header="name">`, a real clickable sortable
column header. Because the team store is global and the list re-sorts on every store
emission, one null-name team makes the whole list throw mid-render and show nothing.

**Suggested fix.** Guard it exactly as the `email` and (now) `shortName` cases are:
`const aName = a.name ? a.name.toLowerCase() : '';`

**Test impact.** Not covered. Worth a case once fixed.

### B. `admin-teams` filter crashes on a null name or short name

**Severity:** same class as A; needs a non-empty search string as well as a null-valued team.

**File:** `gallery.ui/src/app/components/admin/admin-teams/admin-teams.component.ts`
(`getFilteredTeams()`, the filter predicate — around lines 180-181)

```ts
a.shortName.toLowerCase().includes(...)
a.name.toLowerCase().includes(...)
```

Both fields are nullable per the generated model; neither is guarded.

**Reachable:** yes — `getFilteredTeams` is called from the team-store subscription, from
`sortChanged`, and from `applyFilter`, which is wired to the template's search input. The
predicate only runs once `this.filterString` is non-empty, so it needs one extra
precondition compared to A, but it is still user-triggerable.

**Suggested fix.** Same guard as A, applied to both fields in the predicate.

**Test impact.** Not covered.

### C. Admin → Exhibits table has no `trackBy`

**Severity:** same as the fixed §10 — a rebuilt row destroys any expanded detail panel.

**Files:**
- `gallery.ui/src/app/components/admin/admin-exhibits/admin-exhibits.component.html`
  (the `*matRowDef` row definition)
- `gallery.ui/src/app/components/admin/admin-collections/admin-collections.component.html`
  is the reference — it now has `[trackBy]="trackByFn"` and a matching component method.

§10 fixed the **Collections** table only. The **Exhibits** table has the identical gap,
confirmed while fixing §10 and again during review. It was left out to keep that commit to
one defect.

**Suggested fix.** Mirror the §10 fix: add `[trackBy]` keyed on `exhibit.id` to the row
definition plus the component method. Note `trackBy` is a single table-level input shared by
all row definitions, so one binding covers a `multiTemplateDataRows` table's detail row too.

**Test impact.** Some panel-interaction scaffolding in `gallery/tests/cards/` and
`gallery/tests/articles/` was checked against this during the §10 cleanup and confirmed
*not* to be protecting against the Exhibits table, so nothing is currently pinned to it.
If a spec ever expands an Exhibits row and loses the panel, this is why.

### D. Shared `TeamStore` can hold a third exhibit's teams

**Severity:** Low, and pre-existing. Noted during the §14 fix review rather than introduced
by it.

**Files:** `gallery.ui/src/app/services/signalr.service.ts` (`isTeamCardInActiveExhibit`),
`gallery.ui/src/app/components/admin/admin-exhibits/admin-exhibits.component.ts` (~`:218`,
`loadByExhibitId`), `gallery.ui/src/app/data/team/team-data.service.ts`

The §14 fix distinguishes "team absent because the store is stale" from "team absent because
it belongs to another exhibit" by asking whether the store holds *any* team of the active
exhibit. That is correct for the two-exhibit case it was built for. But the team store is
shared and is never cleared on exhibit exit (`unload()` has no callers), and admin's
`loadByExhibitId` writes the same store. So if the store holds only some *unrelated third*
exhibit's teams while the active exhibit is B, the discriminator is false and an event for a
*fourth* exhibit is accepted rather than dropped.

This is the accept-on-uncertainty design used elsewhere in that file — it fails open, so the
worst case is the pre-fix behavior for an unusual store state, never a dropped legitimate
event.

**Suggested fix.** Clear the team store when the active exhibit changes, so the store's
contents always describe exactly one exhibit. That would also let the predicate be a
straightforward `exhibitId` comparison.

**Test impact.** None; not covered.

---

## Related non-bug findings (context, no action needed)

- **`POST /api/exhibits/json` copies the whole collection.** `UploadJsonAsync` calls
  `privateExhibitCopyAsync(..., copyTheCollection: true)`, so importing an exhibit creates a
  *new* collection. That is intended behaviour, but it silently doubled test data until the
  specs started capturing the returned `collectionId` for cleanup. Worth knowing if you ever
  wonder where the extra collections came from.
- **The multipart field name for JSON upload is `ToUpload`, not `file`.**
  `gallery.api/Gallery.Api/ViewModels/FileForm.cs` declares `public IFormFile ToUpload`, and
  model binding matches on that name. Posting the part as `file` leaves `form.ToUpload` null
  and produces a `NullReferenceException` → **500** at `CollectionService.UploadJsonAsync`,
  which looks exactly like an app bug. Recorded because it cost time during verification: an
  apparent upload regression turned out to be a wrong field name in the probe, not a defect.
  (Arguably the API *should* return 400 for a missing file part rather than 500 — a
  hardening suggestion, not a defect we hit.)
- **~~`DELETE /api/collections/{id}` never sends a response~~ — RETRACTED, this was a test
  defect, not an app one.** An earlier version of `gallery/fixtures.ts` asserted this and
  worked around it with a 2s timeout plus a 10x1s polling loop. Measured against the live
  stack the endpoint is prompt and correct:
  ```
  DEL#0 status=204 ms=22 postGET=404
  DEL#1 status=204 ms=20 postGET=404
  DEL#2 status=204 ms=30 postGET=404
  ```
  The helper now awaits the 204 directly. Nothing to fix in the app.
- **`POST /api/users` accepts any GUID** with only `SystemPermission.ManageUsers` and does no
  Keycloak/IdP validation (`UserService.CreateAsync`). This is the documented contract — the
  admin UI's own "Add User" form takes a raw GUID — and the suite relies on it to seed
  disposable users. Flagged only so it is a known, deliberate property rather than a
  surprise.
- **~~Archive search box crashes the view~~ — NOT an app bug; this was our own seed data.**
  Typing in "Search the Archive" really did throw
  `TypeError: a.article.sourceType.toLowerCase is not a function`, with an error sheet and no
  filtering. But the cause was `gallery/fixtures.ts` seeding `sourceType: 0,1,2,3,4,6`.
  `Gallery.Api.Data/Enumerations.cs:15-24` declares `SourceType { News = 10, Social = 20,
  Email = 30, Phone = 40, Intel = 50, Reporting = 60, Orders = 70 }` — spaced by 10, **not
  0-based**, so `0..6` are unnamed values. The API accepts and stores them, but
  `JsonStringEnumConverter` cannot map an unnamed value to a name and emits the raw number;
  the Angular client types `sourceType` as a string union and calls `.toLowerCase()` on it.
  The same response showed `"status":"Unused"` (a valid value, serialised as a string) next to
  `"sourceType":0` — that asymmetry is what gave it away. The fixture now uses a named
  `SOURCE_TYPE` map with the real values and Archive search filters correctly with zero error
  sheets. Recorded here because it looked exactly like an app bug for a while.

  (Arguably the API *should* reject an out-of-range enum value rather than persisting data its
  own client cannot parse — but that is a hardening suggestion, not the defect we hit.)
- **~~`POST /api/teamarticles` fails on a fresh insert~~ — NOT an app bug; the fixture was
  double-inserting.** `gallery/fixtures.ts` used to POST a TeamArticle after creating each
  article, get `500 "A record with this identifier already exists."`, and swallow it with a
  `console.warn(... already exists, skipping)` — which left `seededExhibit.teamArticleIds`
  empty on every run. The API creates that link itself:
  `gallery.api/Gallery.Api/Services/ArticleService.cs:126-156` fans out one `TeamArticleEntity`
  per `TeamCard` matching the article's `cardId` + `exhibitId` whenever an article is posted
  with an `exhibitId`, then calls `LoadUserArticlesAsync` for each. The seeder creates the
  TeamCard first and passes `exhibitId`, so the link already exists by the time it POSTs.
  Two isolated probes returned 201 and made this look unreproducible — they had no TeamCard
  for the card, so the fan-out never ran. Adding the TeamCard reproduced it exactly:
  ```
  teamcard -> 201
  teamarticles BEFORE: 200 [{"id":"5e948c0c-...","articleId":"035f0592-...", ...}]   <- already there
  POST teamarticles -> 500 {"title":"A record with this identifier already exists.", ...}
  ```
  The seeder now reads the auto-created links back from
  `GET /api/exhibits/{id}/teamarticles` and fails loudly if the count doesn't match the number
  of seeded articles, instead of warning and continuing with an empty list. The status-code half
  of that was the old §9, now fixed — a duplicate insert returns **409**.
