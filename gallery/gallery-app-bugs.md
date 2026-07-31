# Gallery app bugs found while building the E2E suite

These are defects in the **Gallery application** (`/mnt/data/crucible/gallery`), not in the
tests. They were found while writing/repairing `gallery/tests/**`, and each was confirmed
from source and/or against the running stack — none is inferred from a test failure alone.

**As of 2026-07-31 there are no open bugs in this file.** Everything recorded here has been
fixed and is covered by a regression spec. What remains below is the record of what was
fixed and why, plus a "Related non-bug findings" section that is worth reading before
concluding you have found a new defect — several entries there are things that looked
exactly like app bugs and were not.

When a new bug *is* found, the convention is: if it blocks a documented test-plan scenario,
the spec carries a `test.skip()` pointing here and `README.md`'s "Skipped tests" table gets a
row; if the app is merely *wrong but testable*, the spec asserts the actual behavior with a
comment saying so, so the assertion reads as deliberate rather than as an accident to be
"fixed" later. Either way, record what a fix should change, so the suite can be tightened
rather than merely re-run.

---

## Status: all 20 recorded bugs are FIXED (§1–§16 on 2026-07-30, A–D on 2026-07-31)

Every defect recorded in this document has been fixed on the `bug-fixes` branch of the
relevant repository and verified against a running Aspire stack. **There are no open bugs.**
Fixed entries are removed from this file rather than kept as history — git history and the
commit bodies are the record.

| Repo | Branch | Commits |
|---|---|---|
| `gallery.api` | `bug-fixes` | `87b546d`, `e008baa`, `9e2dda8`, `f50b391`, `784ae3d`, `46cfa54`, `7797209` |
| `gallery.ui` | `bug-fixes` | `f0a8a3f`, `7f4a836`, `4d22a85`, `ee3c613`, `ca9acf5`, `5f08f25`, `0a37a10`, `9f7603a`, `8fb05c7`, `4fc3f98`, `023e011`, `8b85554`, `b3bce54`, `5eaa8b2`, `f585bdf`, `4fc3104` |

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

### The four follow-on bugs (A–D), fixed 2026-07-31

These were found *while* fixing the 16 above — each was the same class of defect as something
just fixed, in a neighbouring code path the original entry didn't cover. All four were in
`gallery.ui` only.

| Was | Defect | Commit |
|---|---|---|
| A | `admin-teams` sort comparator threw on a team with a null `name` (the `case 'name'` arm §5 deliberately left alone), blanking the whole team list | `b3bce54` |
| B | `admin-teams` filter predicate threw on a null `name`/`shortName`; a null-name team must still match on `shortName` | `5eaa8b2` |
| C | admin **Exhibits** table had no `trackBy` (§10 fixed Collections only), so a store emission rebuilt every row and collapsed the expanded detail panel | `f585bdf` |
| D | `isTeamCardInActiveExhibit` inferred "is the store loaded for this exhibit?" from the store's *contents*, so a store holding only a third exhibit's teams let a fourth exhibit's TeamCard through | `4fc3104` |

Two design decisions worth recording for D, because the obvious fix was not the one taken:

- The fix **records** which exhibit the store was loaded for (`TeamDataService.loadedExhibitId`)
  rather than clearing the store on exhibit change, as this document originally suggested.
  Clearing shared state that admin's `loadByExhibitId` also writes would have made the admin
  Teams panel dependent on call ordering in `toggleExpand`.
- The marker is **set on success, cleared on error, cleared in `unload()`, and untouched while
  a load is in flight**. An earlier revision also cleared it on load *entry*; that was removed
  because `home-app` re-fires `loadMine()` on every `queryParamMap` emission — i.e. on every
  Wall/Archive toggle and every card click — which opened a one-RTT accept window for foreign
  TeamCards on essentially every navigation. The explicit error-path clear is load-bearing:
  without it, a failed load following a successful one leaves the marker confident over an
  emptied store, and the predicate then rejects every TeamCard for that exhibit.

  The predicate deliberately still **accepts** when the store describes some *other* exhibit
  (the literal shape this document filed as D). The store genuinely cannot answer whether a
  team of the active exhibit exists, and `8b85554` exists because an earlier attempt at this
  predicate failed *closed* and dropped legitimate events. Uncertainty must accept. What the
  fix actually closes is the case where the store was authoritatively loaded for the active
  exhibit and holds no matching team — previously that accepted every foreign TeamCard for as
  long as the user stayed there.

All four are now covered by tests (they were not when filed): `gallery/tests/teams/null-name-team-sort.spec.ts`,
`null-name-team-filter.spec.ts`, `gallery/tests/exhibits/exhibit-detail-panel-survives-update.spec.ts`,
and `gallery/tests/wall/foreign-exhibit-teamcard-ignored.spec.ts`. Each was verified to **fail
against the pre-fix code and pass after**, by rebuilding the served bundle from pre-fix source
(and, in review, by patching the served bundle in-flight via route interception).

---

## Related non-bug findings (context, no action needed)

- **`POST /api/teams` accepts a null `name` and a null `shortName`.** Verified live: both
  omitted and explicitly `null` return **201** and read back as `null` from
  `GET /api/exhibits/{id}/teams`. `TeamEntity.Name`/`ShortName` carry no `[Required]` and the
  columns are nullable. This is what makes bugs A and B reachable at all, and it is how their
  regression specs seed. Arguably the API should require a display name — a hardening
  suggestion, not a defect. If it ever starts rejecting them, those two specs become
  unreachable and should be re-examined rather than deleted.
- **TeamCard SignalR events fan out wider than "the team's own users".**
  `TeamCardHandler.GetGroups` sends to the TeamCard's id, `MainHub.EXHIBIT_GROUP`
  (`"AdminExhibitGroup"`), *and* every user in the TeamCard's team. Confirmed by websocket
  frame capture that a user viewing exhibit B does receive a `TeamCardUpdated` for a team of
  exhibit A via the per-user group, using `Join` (not `JoinAdmin`). This is why the client-side
  exhibit-scoping predicate has to exist. Related, and worth knowing: `startConnection` never
  stops the previous connection when `applicationArea` changes, so an admin→home navigation can
  leave a connection still joined to `EXHIBIT_GROUP` while the handlers evaluate as `home`.
- **A TeamCard event only reaches users on that TeamCard's team.** Corollary of the above, and
  a trap when writing tests: remove a user from a team and their client legitimately stops
  receiving that team's TeamCard events. A control assertion that depends on receiving them
  must run *before* any membership change.
- **`npm run lint` in `gallery.ui` is broken for every file**, not just the ones you are
  editing: ESLint 9 rejects the `env` key in the legacy `.eslintrc.js`
  (`A config object is using the "env" key, which is not supported in flat config system`).
  `npm run build` is therefore the only working automated gate in that repo. Migrating to flat
  config is out of scope for a bug-fix commit but is worth doing.
- **`ng build` deletes `dist/browser/serve.json`**, which `npx serve` needs for SPA rewrites.
  If you rebuild the UI bundle by hand to test a change against `:4723`, recreate that file or
  deep links 404.
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
