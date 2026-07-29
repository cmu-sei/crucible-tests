# Gallery app bugs found while building the E2E suite

These are defects in the **Gallery application** (`/mnt/data/crucible/gallery`), not in the
tests. They were found while writing/repairing `gallery/tests/**`, and each was confirmed
from source and/or against the running stack — none is inferred from a test failure alone.

Where a bug blocks a documented test-plan scenario, the spec carries a `test.skip()` with a
pointer to this file, and `README.md`'s "Skipped tests" table has a row. Where the app is
merely *wrong but testable*, the test asserts the actual behavior and says so in a comment,
so the assertion is deliberate rather than an accident to be "fixed" later.

Found: 2026-07-29. Verified against the locally-running Aspire stack (Gallery API reports
version `0.0.0+c2ec85b3...`); the UI is Angular 21 / Angular Material 21.

**Please tell the test suite when these are fixed** — several tests are pinned to the current
(buggy) behavior and should be tightened, not merely re-run. Each entry lists exactly what
to change.

Three items I originally reported here turned out to be **our** defects, not the app's; they are
retracted in "Related non-bug findings" at the bottom, with the evidence, so nobody chases
them.

**How far each entry was verified** — not uniform, so treat these differently:

| Verification | Entries |
|---|---|
| Reproduced against the running stack, with the request/response or UI error quoted in an **Observed** block | §1, §4, §8, §9, §10, §11, §14, §15, §16 |
| Confirmed by reading the app source (the defect is plain on the page: a missing call, a missing null guard, a wrong type, a hardcoded string) | §2, §3, §5, §6, §7, §12, §13 |

Every `file:line` in this document was re-checked against the working tree on 2026-07-29. Line
numbers can still drift as the app changes — the surrounding code quote is the reliable anchor.
Nothing here is inferred from a test failure alone.

---

## 1. Admin → Exhibits table: sorting and pagination are both dead

**Severity:** user-visible, affects every admin with more than a page of exhibits.

**Files:**
- `gallery.ui/src/app/components/admin/admin-exhibits/admin-exhibits.component.html:30-31`
- `gallery.ui/src/app/components/admin/admin-exhibits/admin-exhibits.component.ts:75-76,154-157`

**Cause.** The table is inside a structural conditional:

```html
30:  @if (!isLoading && selectedCollectionId) {
31:  <table mat-table [dataSource]="dataSource" matSort multiTemplateDataRows>
```

while the view queries are resolved once, in `ngAfterViewInit`:

```ts
 75:  @ViewChild(MatSort) matSort: MatSort;
 76:  @ViewChild(MatPaginator) paginator: MatPaginator;
...
154:  ngAfterViewInit() {
155:    this.dataSource.sort = this.matSort;        // undefined
156:    this.dataSource.paginator = this.paginator; // undefined
157:  }
```

`selectedCollectionId` initialises to `''` (`admin-exhibits.component.ts:62`), so at
`ngAfterViewInit` the `@if` is false, the table does not exist, both `@ViewChild`s are
`undefined`, and `dataSource.sort` / `dataSource.paginator` are permanently set to
`undefined`. Nothing re-assigns them when the collection is later selected.

**Observed behaviour** (instrumented run against a 12-exhibit collection, `pageSize=10`):

```
ROWS RENDERED (pageSize=10, seeded 12): 12      <- paginator not applied
PAGINATOR RANGE LABEL:  0 of 0                  <- paginator dead
CLICK1 ["A ex","M ex","Z ex"] aria-sort= ascending
CLICK2 ["A ex","M ex","Z ex"] aria-sort= descending
CLICK3 ["A ex","M ex","Z ex"] aria-sort= none    <- order never changes
```

Note the misleading part: `aria-sort` cycles correctly because `matSort` on the header still
tracks state — only the *datasource* was never connected. So the header looks functional.
The rows happen to appear alphabetical for an unrelated reason: Akita's `ExhibitQuery` has
`@QueryConfig({ sortBy: 'name' })` while the API returns `OrderByDescending(DateCreated)`;
that fixed store-level sort is what is rendered, and it is unaffected by header clicks.

**Contrast — why `admin-collections` is fine.** Same `@ViewChild`/`ngAfterViewInit` shape,
but its guard is only `@if (!isLoading)` (`admin-collections.component.html:24`) and
`isLoading` initialises to `false` (`:44`), so the table *does* exist at
`ngAfterViewInit` and the wiring succeeds. That component is the reference for a fix.

**Suggested fix.** Either use a setter-based query that re-assigns whenever the table
appears:

```ts
@ViewChild(MatSort) set matSortRef(ms: MatSort) { if (ms) this.dataSource.sort = ms; }
@ViewChild(MatPaginator) set paginatorRef(p: MatPaginator) { if (p) this.dataSource.paginator = p; }
```

or keep the table in the DOM and hide it with `[hidden]`/CSS instead of `@if`. (Adding
`{ static: false }` alone is not sufficient — the assignment in `ngAfterViewInit` still runs
only once.)

**Test impact.** `gallery/tests/exhibits/exhibit-sorting.spec.ts` — the header-interaction
test passes; the row-reordering test is `test.skip()`. **On fix:** un-skip it, and consider
adding paginator coverage, which is currently impossible here.

---

## 2. Admin → Collections "Copy" button is a no-op

**Severity:** advertised feature silently does nothing.

**File:** `gallery.ui/src/app/components/admin/admin-collections/admin-collections.component.ts:190-192`

```ts
190:  copyCollection(id: string): void {
191:    this.permissionDataService.loadCollectionPermissions().subscribe();
192:  }
```

The handler reloads permissions and never copies. The button is wired to it
(`admin-collections.component.html:46-48`, `title="Copy {{ element.name }}"`), so a user
clicks Copy, gets no error, and no collection appears.

This looks like an editing accident rather than an intentional stub: the data service
already has the correct call, unused from here —
`gallery.ui/src/app/data/collection/collection-data.service.ts:195` `copy(id)` →
`copyCollection(id)`. The **API endpoint works**; I exercised
`POST /api/collections/{id}/copy` directly and it returns a new collection.

**Suggested fix.** Call `this.collectionDataService.copy(id).subscribe(...)` (mirroring how
`admin-exhibits` handles its own copy action, which is correctly wired).

**Test impact.** `gallery/tests/collections/copy-collection.spec.ts` is `test.skip()`.
**On fix:** un-skip. The equivalent exhibit-copy test is active and passing, so it is a good
template for the assertions this one should make.

---

## 3. Wall Advance error shows the wrong (less useful) message

**Severity:** cosmetic but user-facing — the helpful sentence the API sends is never shown.

**File:** `gallery.ui/src/app/components/wall/wall.component.ts:120`

```ts
const message = err?.error?.Detail || err?.error?.title || 'Already at the last move/inject.';
//                            ^^^^^^ capital D
```

The API returns camelCase `ProblemDetails`. Verified against the live API — advancing an
exhibit already at its last move/inject gives HTTP 400 with:

```json
{"title":"Cannot advance.","status":400,
 "detail":"Already at the last move/inject. There are no further moves or injects to advance to."}
```

`err.error.Detail` is therefore always `undefined`, so the expression falls through to
`title` and the snackbar reads just **"Cannot advance."** The descriptive `detail` sentence
— which is the one worth showing — is unreachable. ASP.NET serialises `ProblemDetails`
camelCase by default (`ExhibitController.AdvanceExhibit` constructs it with PascalCase C#
property names, but that is the CLR-side name, not the wire name).

**Suggested fix.** `err?.error?.detail || err?.error?.title || '...'`. This is the only
PascalCase ProblemDetails read in the UI — I grepped `gallery.ui/src/app` for
`.error?.Detail` / `.error.Title` and this line is the sole hit, so the fix is local.

**Test impact.** `gallery/tests/edge-cases/advance-boundary.spec.ts` asserts the snackbar
text `'Cannot advance.'` — i.e. what the app really does today — with a comment explaining
why. **On fix:** widen that assertion to the `detail` sentence. Do **not** treat the test as
broken; the assertion is deliberate.

---

## 4. `POST /api/collections/json` returns 500 on the first upload of a freshly-downloaded collection

**Severity:** documented feature (Upload Collection) fails outright, intermittently, with a 500.

**Files:**
- `gallery.api/Gallery.Api/Services/CollectionService.cs:200-235` (`DownloadJsonAsync`)
- `gallery.api/Gallery.Api/Services/CollectionService.cs:238-255` (`UploadJsonAsync`)
- `gallery.api/Gallery.Api/Services/CollectionService.cs:141-198` (`privateCollectionCopyAsync`)

**Observed.** Download a collection as JSON, then upload that same file:

```
UP#0 status=500 {"title":"The instance of entity type 'UserEntity' cannot be tracked because
 another instance with the same key value for {'Id'} is already being tracked. When attaching
 existing entities, ensure that only one entity instance with a given key value is attached.",
 "status":500,"detail":"System.InvalidOperationException: ..."}
```

Measured at **6 × 500 out of 12 attempts** via the API, and roughly 1-in-3 through the UI. Once
a *particular* downloaded file is bad it fails 8/8 — the variability is in the download, not the
upload. Depending on which entity EF happens to have tracked first, the same failure also
surfaces naming `CollectionMembershipEntity` rather than `UserEntity`, thrown from
`privateCollectionCopyAsync` line 158.

**Cause.** `DownloadJsonAsync` loads the collection **tracked** — the `Collections` query at
`:202-203` has no `AsNoTracking()`, unlike the sibling `Cards`/`Articles` queries at `:209-217`.
Authorization has already run on the same scoped `DbContext` and loaded that user's
`CollectionMembershipEntity` rows (`Services/UserClaimsService.cs:272`), so the tracked
entity's `Memberships` navigation (`Gallery.Api.Data/Models/Collection.cs:18`) is populated and
gets serialised into the export by `ReferenceHandler.Preserve` — memberships and the nested
`UserEntity` graph included. On import, `privateCollectionCopyAsync` re-`Add`s that graph, EF
finds it is already tracking an entity with the same key, and `SaveChangesAsync` (`:183`)
throws. Note the method already defensively nulls `cardEntity.Collection`,
`articleEntity.Collection` and `articleEntity.Card` (`:166,176,178`) — but not
`collectionEntity.Memberships`.

**Why it is intermittent.** Claims are cached for 60s
(`Gallery.Api/appsettings.json:80` `"CacheExpirationSeconds": 60`). On a cache **miss** the
membership rows are loaded into the change tracker and the export embeds them; on a **hit** they
are never loaded and the export is clean. Proved causal in both directions: with a fresh token
the export embeds 1 membership row and 3/3 uploads 500; with a warm token the export embeds 0
rows and the upload returns 200. Injecting a real membership row into an otherwise-clean export
reproduces the 500 deterministically.

Same collection, three consecutive downloads:

```
DL#0 bytes=7308 hasMemberships=true hasUser=true  hasUserId=true    <- this file always 500s on upload
DL#1 bytes=377  hasMemberships=true hasUser=false hasUserId=false   <- this file uploads fine
DL#2 bytes=377  hasMemberships=true hasUser=false hasUserId=false
```

Same collection, same endpoint, three consecutive calls: the first serialises 7308 bytes with a
full `"User":{"$id":"5","Id":"9b3b331c-...","Name":"Admin User","TeamUsers":{...}}` blob; later
ones serialise 377 bytes without it. So the exported file is not a stable artifact — its
contents depend on request-local EF state, which also means a downloaded collection may not be
re-importable later.

**Suggested fix — one line.** Add `.AsNoTracking()` to the `Collections` query in
`DownloadJsonAsync` (`:202-203`). **`ExhibitService.cs:213-214` already does exactly this** for
the same query, which is precisely why the exhibit round-trip works and the collection one does
not. Optionally also null `collectionEntity.Memberships` in `privateCollectionCopyAsync` before
`AddAsync`, for symmetry with the card/article handling. Fixing the download half additionally
makes exports deterministic, which matters independently: today a downloaded collection may not
be re-importable depending on cache timing.

**Test impact.** `gallery/tests/collections/upload-collection.spec.ts` asserts
`uploadResponse.status()).toBe(200)`. That assertion is **correct and left as-is** — the test
fails intermittently and that is the app bug reporting itself, not test flake. The
download-then-upload round-trip in `edge-cases/download-upload-roundtrip.spec.ts` has its upload
half split into a separate `test.skip()` pointing here, with the download half fully asserted and
passing. **On fix:** delete that skip and merge the two halves (keep the `exact: true` locators —
the imported copy is named `<name> - Admin User`, which otherwise collides in strict mode). Do
not "stabilise" either test by accepting a 500 or retrying the upload.

---

## 5. `admin-teams` sort crashes on a team with no short name

**Severity:** an admin page fails to render rows as soon as a second team exists.

**File:** `gallery.ui/src/app/components/admin/admin-teams/admin-teams.component.ts:197-216`

```ts
206:      case 'email':
207:        const aEmail = a.email ? a.email.toLowerCase() : '';   // guarded
208:        const bEmail = b.email ? b.email.toLowerCase() : '';
...
211:      default:
213:          (a.shortName.toLowerCase() < b.shortName.toLowerCase() ? -1 : 1) *   // NOT guarded
```

(Re-verified 2026-07-29 against the working tree: the `email`/`default` cases now sit at
`:206-213`, so the line numbers above may drift by a line or two; the asymmetry — `email`
null-guarded, `shortName` not — is unchanged.)

`Team.ShortName` is nullable and the admin UI lets you create a team with only a name, so
`shortName` is legitimately `null`. The comparator only runs with 2+ teams, so a single-team
exhibit looks fine and adding a second one throws
`TypeError: Cannot read properties of null (reading 'toLowerCase')`. Note `email` two cases up
*is* null-guarded — the pattern was known, `shortName` was just missed.

**Suggested fix.** Guard it the same way `email` is:
`const aShort = a.shortName ? a.shortName.toLowerCase() : '';`

**Independently reproduced as a cross-worker flake.** `create-manage-teams.spec.ts` passed
serially but failed roughly 1-in-2 runs at `--workers 2`: the `POST /api/teams` returned **201**
and the new row still never rendered.

```
Locator: getByRole('region', { name: 'Exhibit Teams' }).getByText('Managed Team 1785340146559-569869', { exact: true })
Expected: visible          Error: element(s) not found
```

The reason is that the team store is global, not per-exhibit: `getSortedTeams()` re-sorts on
*every* store emission (`admin-teams.component.ts:57-62`), and `gallery/fixtures.ts` was
creating its shared `seededExhibit` team with **no `shortName`**. So a sibling worker's
null-shortName team landing in the store made this worker's list throw mid-render and show
nothing. Giving the fixture's team a `shortName` made 3/3 parallel runs pass. That is a
workaround in *our* seed data for a real app defect — the app should not depend on a nullable
column being populated.

**Test impact.** `gallery/tests/teams/create-manage-teams.spec.ts` seeds its own collection and
exhibit rather than reusing the shared `seededExhibit` fixture, specifically so it controls how
many teams exist; and `gallery/fixtures.ts` now sets a `shortName` on the seeded team, with a
comment pointing here. **On fix:** the spec can be simplified to use `seededExhibit`, and the
fixture comment can go (keep the `shortName` value — it is realistic data either way).

---

## 6. Invalid JSON upload fails silently in the UI, and 500s at the API

**Severity:** a user who uploads a bad file gets no feedback at all.

**Files:**
- `gallery.ui/src/app/data/collection/collection-data.service.ts` (`uploadJson`) and the
  exhibit equivalent in `.../data/exhibit/exhibit-data.service.ts`
- `gallery.api/Gallery.Api/Services/CollectionService.cs:251` (`JsonSerializer.Deserialize`)

**UI half.** `uploadJson` subscribes with its own error callback that only does
`setLoading(false)` + `uploadProgress.next(0)`. Because the error is handled there, it never
reaches Angular's global `ErrorHandler` (`ErrorService`), which is the only thing that opens
the `app-system-message` sheet. Result: no sheet, no snackbar, no dialog — the upload just
quietly does nothing.

**API half.** `UploadJsonAsync` calls `JsonSerializer.Deserialize` with no try/catch, and
`JsonException` does not implement `IApiException`, so `ExceptionMiddleware` maps it to a 500
rather than a 400:

```
HTTP 500 {"title":"'this is not json at all\n' is an invalid JSON literal. ...","status":500}
HTTP 500 {"title":"Expected depth to be zero at the end of the JSON payload. ...","status":500}
```

A malformed client upload is a client error; this should be a 400.

**Suggested fix.** API: wrap the deserialise and throw a `BadRequest`-mapped exception (or
return `ValidationProblem`). UI: let the error propagate, or surface it explicitly via the
snackbar/system-message path so the user learns the file was rejected.

**Test impact.** `gallery/tests/edge-cases/invalid-upload.spec.ts` pins the current behaviour:
the payload is rejected, **no record is created**, the UI recovers — plus an explicit assertion
that *no* error notification appears. That last assertion is **deliberately inverted** so that
fixing the app makes the test fail loudly instead of silently passing. **On fix:** flip it to
assert the error message the app then shows.

---

## 7. A late `loadMine()` response can clobber the admin Collections list

**Severity:** intermittent — the admin Collections table silently shows only the user's own
collections, or empties out.

**Files:**
- `gallery.ui/src/app/data/collection/collection-data.service.ts:121-141` (`load()`) and
  `:143-163` (`loadMine()`)
- callers: `gallery.ui/src/app/components/home-app/home-app.component.ts:164`,
  `gallery.ui/src/app/components/admin/admin-container/admin-container.component.ts:120-123`,
  `gallery.ui/src/app/components/admin/admin-collections/admin-collections.component.ts:86-89`

**Cause.** `load()` (`GET /api/collections` — everything) and `loadMine()`
(`GET /api/my-collections` — only the user's memberships) both end in the *same* unconditional
whole-store replacement, `this.collectionStore.set(collections)`. Neither tags provenance nor
guards against a stale in-flight response, so when both are in flight against one store slice,
**whichever HTTP response lands last wins**. Navigating home → Administration fires `loadMine()`
from the home page and then `load()` from the admin container; if `my-collections` resolves
second, the admin table is replaced by the caller's handful of personal collections.

The two endpoints return very different sets for the same admin user, so the difference is
stark:

```
/api/collections    200  39
/api/my-collections 200   4
```

Forcing the slow ordering (3s delay on `**/api/my-collections`, then load admin) shows the
table populate correctly and then collapse:

```
t=2500ms status="1 – 10 of 46" rows=10
t=3000ms status="1 – 3 of 3"   rows=3     <- my-collections response clobbers the store
AFTER FILTER status="0 of 0" rows=0
```

Under normal timing the interleaving is merely *unforced*, not safe — request logs show
`my-collections` usually resolving ~200ms before `collections` (benign), but nothing enforces
that.

**Suggested fix.** Stop sharing one store slice between two different scopes, or make the write
conditional: carry a monotonic request token in `load()`/`loadMine()` and drop a response whose
token is stale. Cleaner still, give the admin container its own store/selector so a "mine" query
can never overwrite the admin list.

Separately worth removing: `admin-collections.component.ts:86-89` repeats the same
`shouldLoadAllCollections()` load the container already performed at
`admin-container.component.ts:120-123`, so two `GET /api/collections` fire per admin visit.

**Test impact.** Nothing is skipped or weakened — `collection-pagination.spec.ts` and
`collection-sorting-search.spec.ts` assert real row counts and real row order, and pass
deterministically because they seed their own rows and filter by a unique marker. A comment in
`collection-pagination.spec.ts` names this race as the likely cause should it ever flake with a
too-low row count, so nobody "fixes" it by loosening the count assertions. **On fix:** no test
change required; the comment can go.

---

## 8. `GET /api/collections/{id}/json` 500s when Description is null

**Severity:** Download is unusable for any collection created without a description — and
description is optional on create.

**File:** `gallery.api/Gallery.Api/Services/CollectionService.cs:233`

```cs
var filename = collection.Description.ToLower().EndsWith(".json") ? collection.Description : collection.Description + ".json";
```

No null guard — and the download filename is derived from `Description` rather than `Name`,
which is itself odd.

**Observed.** `POST /api/collections {"name":"NoDescProbe ..."}` (no description) returns 201
with `"description":null`; the download then fails:

```
create status 201 description = null
DOWNLOAD status 500
{"title":"Object reference not set to an instance of an object.","status":500,
 "detail":"System.NullReferenceException: ...
   at Gallery.Api.Services.CollectionService.DownloadJsonAsync(...) in CollectionService.cs:line 233"}
```

**Suggested fix.** Null-coalesce, and prefer `Name` for the filename — e.g. build it from
`collection.Name` and only honour `Description` when it already ends in `.json`.

**Test impact.** Not currently covered — every spec that downloads a collection happens to set a
description. **On fix (or before):** worth a dedicated case for the description-less collection;
until then be aware that seeding a collection without a description will break any download
assertion.

---

## 9. Constraint violations are reported as 500, not 4xx

**Severity:** Low, but it makes every API client (including these tests) unable to distinguish
"you sent a bad request" from "the server is broken". It also generalises the specific case in
§6.

**File:** `gallery.api/Gallery.Api/Infrastructure/Exceptions/Middleware/ExceptionMiddleware.cs:99-158`

`TransformPostgresException` (`:116-135`) already classifies the Postgres SQLSTATE correctly and
builds a clean, user-safe message for each case:

```cs
"23505" => new InvalidOperationException("A record with this identifier already exists."),
"23503" => new InvalidOperationException("Referenced entity does not exist. ..."),
"23514" => new InvalidOperationException("Data validation failed."),
```

…but it returns a plain `InvalidOperationException`, which does **not** implement `IApiException`.
`GetStatusCodeFromException` (`:99-109`) only consults `IApiException`, so all three fall through
to the `HttpStatusCode.InternalServerError` default. The classification work is done and then
thrown away.

**Observed.** Duplicate `POST /api/teamarticles`:

```
POST teamarticles -> 500 {"title":"A record with this identifier already exists.","status":500,
 "detail":"System.InvalidOperationException: A record with this identifier already exists."}
```

The body is correct and actionable; only the status code is wrong.

**Suggested fix.** Give the transform methods exception types that implement `IApiException` with
the right status — `409 Conflict` for `23505`/`2601`/`2627`, `400 Bad Request` for
`23503`/`23514`/`547`. Same three-line change covers SQL Server (`:142-158`). Doing this also
fixes the API half of §6 if `JsonException` is mapped alongside it.

**Test impact.** Nothing asserts on these codes today. **On fix:** a duplicate-insert probe can
assert `409` instead of having to string-match the 500 body, which is what any test would
otherwise be forced to do.

---

## 10. Admin Collections table has no `trackBy` — the cards/articles panel collapses when *anyone* touches *any* collection

**Severity:** Real UX bug, not just a test problem. Any admin with a collection's Cards or
Articles panel open loses it — mid-edit — whenever any other user anywhere creates, edits, or
deletes any collection, card, or article.

**Files:**
- `gallery.ui/src/app/components/admin/admin-collections/admin-collections.component.ts:77,82`
- `gallery.ui/src/app/components/admin/admin-collections/admin-collections.component.html:80,107`
- `gallery.api/Gallery.Api/Infrastructure/EventHandlers/CollectionHandler.cs:45`
- `gallery.api/Gallery.Api/Hubs/MainHub.cs:28,143`

**Mechanism.** On every `collectionQuery.selectAll()` emission the component rebuilds its list
out of fresh object clones and reassigns the table data:

```ts
this.collectionList.push({ ...collection });   // :77 — new object identity every time
...
this.dataSource.data = this.collectionList;    // :82
```

The row template has no `trackBy`:

```html
<tr mat-row *matRowDef="let row; columns: displayedColumns" ...>   <!-- :107 -->
```

so Angular destroys and rebuilds every row. The expanded detail is behind
`@if (element.id === expandedCollectionId)` (`:80`), so the panel is recreated **collapsed**.

The trigger is global, not per-collection: `CollectionHandler.cs:45` adds
`MainHub.COLLECTION_GROUP` to the notify list, and `MainHub.cs:143` puts *every* holder of
`ViewCollections` into that group. So one user's unrelated collection change collapses every
other admin's open panel. `CardHandler.cs:60` and `ArticleHandler.cs:50` broadcast to the same
group.

**Observed.** Proven by tagging the live `<app-admin-articles>` DOM element, POSTing an
*unrelated* collection, and watching the tag disappear with the `mat-expanded` count dropping
to 0. An earlier hypothesis (an `aria-modal` overlay hiding the panel) was disproved — 8/8
cancel loops were stable in isolation.

**Suggested fix.** Add `trackBy` keyed on `collection.id` to the row definition. Keying the
rows stops the rebuild and the panel survives the store emission. Narrowing the SignalR
broadcast so a collection change only notifies watchers of *that* collection would reduce the
churn further, but `trackBy` alone fixes the collapse.

**Test impact.** This is why `gallery/tests/cards/` and `gallery/tests/articles/` specs wrap
panel interactions in `ensure{Articles,Cards}Panel` helpers plus `expect(...).toPass()`. With
`workers: 2` the sibling specs collapse each other's panels constantly. **On fix:** the
`toPass()` wrappers and re-open helpers can be deleted — do not delete them before then, and
do not mistake them for ordinary flake-padding.

---

## 11. `DELETE /api/cards/{id}` 500s when the card still has articles

**Severity:** A card with articles cannot be deleted at all, and the UI surfaces a generic
"Internal Server Error" dialog with no indication of the real cause.

**File:** `gallery.api/Gallery.Api/Services/CardService.cs:141-148`

```cs
public async Task<bool> DeleteAsync(Guid id, CancellationToken ct)
{
    var cardToDelete = await _context.Cards.SingleOrDefaultAsync(v => v.Id == id, ct);
    _context.Cards.Remove(cardToDelete);
    await _context.SaveChangesAsync(ct);
    return true;
}
```

No check for dependent `ArticleEntity.CardId` rows and no cascade configured, so Postgres
rejects the delete. (`cardToDelete` is also unguarded against null — a delete of a nonexistent
id will `NullReferenceException`.)

**Observed** against the live stack — create collection → card → one article on that card, then
delete the card:

```
article create -> 201
DELETE card (has 1 article) -> 500
{"title":"Referenced entity does not exist. Please verify all referenced entities exist.",
 "status":500,"detail":"System.InvalidOperationException: Referenced entity does not exist. ..."}
```

Note the message is actively misleading: the referenced entity *does* exist — that is precisely
why the delete fails. It comes from `ExceptionMiddleware`'s `23503` branch, which assumes a
foreign-key violation means a dangling reference on insert rather than a restrict on delete.

**Suggested fix.** Decide the intended semantics and implement one: cascade-delete the card's
articles, or null out their `CardId`, or reject with a `409`/`400` and a message naming the
blocking articles. Also null-guard `cardToDelete` and return `EntityNotFoundException`. The
`23503` message should distinguish insert-side from delete-side violations. See also §9 — the
status code should not be 500 either way.

**Test impact.** `gallery/tests/cards/edit-delete-cards.spec.ts` pins the current failure
deliberately, so the test fails once this is fixed. **On fix:** update it to assert the chosen
behaviour.

---

## 12. The "Add a Card" dialog is titled "Edit Card"

**Severity:** Cosmetic, trivially fixable, user-visible on every card creation.

**File:** `gallery.ui/src/app/components/admin/admin-card-edit-dialog/admin-card-edit-dialog.component.html:7`

```html
dialogTitle="Edit Card"
```

Hardcoded, so the same dialog component shows "Edit Card" when adding a new one.

**Suggested fix.** Bind the title to the mode, e.g. `[dialogTitle]="data.card?.id ? 'Edit Card'
: 'Add a Card'"`.

**Test impact.** `gallery/tests/cards/view-create-cards.spec.ts` deliberately does *not* assert
the dialog title, since asserting "Edit Card" for an add would enshrine the bug. **On fix:** add
the title assertion.

---

## 13. `ArticleEntity.Exhibit` is typed as `CardEntity`

**Severity:** Latent. It has not caused an observed failure, but it is plainly wrong and will
bite whenever anything tries to `Include(a => a.Exhibit)`.

**File:** `gallery.api/Gallery.Api.Data/Models/Article.cs:23`

```cs
public Guid? ExhibitId { get; set; }
public CardEntity Exhibit { get; set; }     // <-- should be ExhibitEntity
public Guid? CardId { get; set; }
public CardEntity Card { get; set; }
```

Almost certainly copy-paste from the `Card` pair two lines below. EF Core will try to map
`Exhibit` as a second relationship to `Cards` using `ExhibitId` as the FK.

**Suggested fix.** Change the type to `ExhibitEntity`. Worth checking whether a migration is
needed for the resulting FK, and whether anything currently depends on the wrong mapping.

**Test impact.** None today — no spec navigates `Article.Exhibit`.

---

## 14. Wall/Archive Akita stores are not scoped to the active exhibit

**Severity:** High. A user in two exhibits sees another exhibit's cards and articles appear in
the one they are currently viewing, live, without a refresh. Unread counts are wrong as a
result.

**Files:**
- `gallery.ui/src/app/services/signalr.service.ts:282-296` (`addUserArticleHandlers`), plus the
  same pattern in `addCardHandlers` and `addTeamCardHandlers`
- `gallery.ui/src/app/data/user-article/user-article.store.ts`, `.../card/card.store.ts`
- `gallery.api/Gallery.Api/Infrastructure/EventHandlers/UserArticleHandler.cs:63,155`
- `gallery.api/Gallery.Api/Infrastructure/EventHandlers/CardHandler.cs:40-66`
- `gallery.api/Gallery.Api/Infrastructure/EventHandlers/TeamCardHandler.cs:40-56`

**Mechanism.** The API broadcasts these events to the **user** group rather than an exhibit
group:

```cs
// UserArticleHandler.cs:63
tasks.Add(_mainHub.Clients.Group(userArticleEntity.UserId.ToString())
    .SendAsync(method, userArticle, modifiedProperties, cancellationToken));
```

`CardHandler.GetGroups` adds every user of every team of every exhibit **in the card's
collection**; `TeamCardHandler` adds every TeamUser of the team. `MainHub.GetTeamIdList` does
maintain an exhibit-id group, but these three handlers don't use it.

The UI handlers then upsert with **no exhibit check**:

```ts
this.hubConnection.on('UserArticleCreated', (userArticle: UserArticle) => {
  this.userArticleDataService.setAsDates(userArticle);
  this.userArticleDataService.updateStore(userArticle);   // no exhibitId filter
});
```

and the stores are flat, keyed only by id — `UserArticleStore extends
EntityStore<UserArticleState>` with `EntityState<UserArticle>` and no scoping. So an event for
the same user in a *different* exhibit lands in the currently-open exhibit's list.

The REST endpoints are correctly scoped (`UserArticleService.cs:110-122` filters
`ua.ExhibitId == exhibitId`), so this is purely UI store hygiene — a reload shows the right data.

**Observed.** Two-tab probe, reading an article in exhibit A while tab 2 sits in a different
exhibit:

```
tab2 before            ["Probe Article 1785342893025"]
tab2 after read-on-A   ["Probe Article 1785342893025","News Article 1"]
tab2 title             Gallery Archive (1)
```

Wall probe — a card created in another exhibit appears in the open one:

```
wall before  ["Test Card 1","Test Card 2","Test Card 3"]
wall after   ["Probe2 Card 1785343465210","Test Card 1","Test Card 2","Test Card 3"]
```

**Suggested fix.** Drop payloads whose `exhibitId` (for Card/TeamCard, whose card's
exhibit/collection) is not the active exhibit, or key the stores per exhibit and clear on
exhibit change. Alternatively narrow the API broadcast to the exhibit group `MainHub` already
maintains.

**Test impact.** `wall-advance` and `wall-unread-count` own uniquely-named data so they never
observe it (keep that regardless — it is also correct state hygiene). The archive specs scope
list assertions to seeded names and use `.first()` on same-named `mat-option`s, each with a
comment naming this bug. **On fix:** restore `expect(options).toHaveText([...])` in
`archive-card-filter`, drop the `.first()` calls in
`archive-card-filter`/`archive-combined-filters`, and restore `toHaveCount(1)` on
`section.cards mat-card` in `archive-article-share`.

---

## 15. Article Share succeeds with no user-visible confirmation

**Severity:** Medium. A successful share and a silently-failed one look identical.

**Files:**
- `gallery.ui/src/app/components/archive/archive.component.ts` (`openShareDialog` — closes on
  `editComplete`, no snackbar; the file contains **zero** `MatSnackBar` references)
- `gallery.ui/src/app/data/user-article/user-article-data.service.ts:181-192`

```ts
shareUserArticle(userArticleId: string, shareDetails: ShareDetails) {
  this.userArticleStore.setLoading(true);
  this.userArticleService.shareUserArticle(userArticleId, shareDetails)
    .pipe(tap(() => { this.userArticleStore.setLoading(false); }), take(1))
    .subscribe();          // bare subscribe — no success or error feedback
}
```

Contrast `wall.component.ts#advanceExhibit`, which does open a snackbar (on error — see §3).
Test-plan §4.8 expects "Success message appears".

**Observed.** `PUT /api/userarticles/{id}/share` → 200, dialog closed,
`mat-snack-bar-container` count 0, and the target user's unread count went 0 → 1. The share
works; only the feedback is missing.

**Suggested fix.** Open a snackbar on success, and add an error path (a failed share is
currently invisible too).

**Test impact.** `archive-article-share.spec.ts` proves the share at the data layer and carries
a **deliberate** `expect(page.locator('mat-snack-bar-container')).toHaveCount(0)` with a
comment. **On fix:** replace it with a positive assertion on the snackbar text.

---

## 16. `getQueryParams()` writes state during change detection, forcing every exhibit click to the Archive

**Severity:** Medium. Clicking an exhibit on My Exhibits can never land on the Wall, and each
exhibit's remembered section is silently overwritten just by rendering the list.

**File:** `gallery.ui/src/app/components/home-app/home-app.component.ts:465-469`

```ts
getQueryParams(exhibitId: string) {
  const queryParams = { exhibit: exhibitId };
  this.uiDataService.setSection(exhibitId, Section.archive);   // side effect during render
  return queryParams;
}
```

**Mechanism.** `home-app.component.html:61` calls this from a template binding, once per row:

```html
<a [routerLink]="['/']" [queryParams]="getQueryParams(exhibit.id)">
```

so merely rendering My Exhibits rewrites every exhibit's remembered section in
`localStorage['uiState']` (`ui-data.service.ts` persists on each `saveChanges()`). The link
carries no `section`, and `startup()` reads the remembered value (falling back to `archive`), so
the click always lands on the Archive. Test-plan §2.4 expects the Wall. It is also an impure
template binding — writing state during change detection is a bug in its own right.

**Observed.** After visiting the Wall, `uiState.exhibitSection[EX] === "wall"`; after merely
loading the home page with **no click**, it had been rewritten to `"archive"`; the click then
landed on `Gallery Archive (2)`.

**Suggested fix.** Make `getQueryParams` pure — remove the `setSection` call — and either
preserve the remembered section or point the link at `section=wall` explicitly.

**Test impact.** `my-exhibits-navigation.spec.ts` asserts the **current** behaviour and
demonstrates the mechanism: pins the section to `wall`, shows that rendering the table flips it
to `archive`, asserts the click lands on the Archive (`app-archive` visible, `app-wall`
`toHaveCount(0)`), then reaches the Wall via the Archive's Wall button to satisfy §2.4. Marked
`CURRENT BEHAVIOUR` with post-fix instructions.

---

## Related non-bug findings (context, no action needed)

- **`POST /api/exhibits/json` copies the whole collection.** `UploadJsonAsync` calls
  `privateExhibitCopyAsync(..., copyTheCollection: true)`, so importing an exhibit creates a
  *new* collection. That is intended behaviour, but it silently doubled test data until the
  specs started capturing the returned `collectionId` for cleanup. Worth knowing if you ever
  wonder where the extra collections came from.
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
  of seeded articles, instead of warning and continuing with an empty list. The only real app
  issue here is the status code, which is §9.
