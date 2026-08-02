# Blueprint Playwright suite — session report

**Date:** 2026-08-01 · **Branch:** `worktree-blueprint-tests` (14 commits on top of `d4dc4a3`)
**Command under test:** `./run-tests.sh blueprint --browser chromium --workers 2`

---

## Headline

| | Start of session | End of session |
|---|---:|---:|
| Tests discovered | 136 | **139** |
| Passed | 112 | **125** |
| Failed (`unexpected`) | 1 | **0** |
| Flaky (needed a retry) | 4 | **0** ¹ |
| Skipped | 19 | **14** |
| App bugs documented | 11 | **16** |
| `waitForTimeout` / `networkidle` | 206 | **81** |

¹ Reproduced repeatedly, including one run at **125/125 with zero retries** and one against a
**completely fresh database**. Runs interleaved with the BP-6 wedge (below) still show retries.

**The requested finishing condition — 5 consecutive runs with identical results — was not
reached, and the blocker is an application defect, not test quality.** See
[BP-6](#bp-6-the-blocker) for the evidence.

---

## What the numbers mean, honestly

The prior session's report (`blueprint-healing-report.html`) claimed **117 passed / 0 failed** at
2 workers. That did not reproduce. A clean run at session start gave **112 passed / 1 failed /
4 flaky / 19 skipped**, with the failures clustered exactly where that report's own
"needs `--workers 1`" section predicted. The first thing this session did was establish a real
baseline; everything after is measured against that.

Two accounting rules used throughout, because both were being violated:

1. **A run's summary line counts a flaky retry as "passed."** `Ran 139 tests: 125 passed` can
   hide three retries. Every result here is read from `results.json`
   (`expected` / `flaky` / `unexpected` / `skipped`), not the summary.
2. **A green test is not evidence.** Every spec that was rewritten or newly written was
   *sabotaged* — its key precondition withheld — and confirmed to fail before being trusted.
   Several "passing" specs turned out to assert nothing at all (below).

---

## The problem this session was actually about

Most of the work was not fixing broken tests. It was finding **tests that passed while verifying
nothing**, which is strictly worse than a failing test: it reports safety that does not exist.

### Specs that could not fail

| Spec | What was wrong |
|---|---|
| `signalr-connection-establishment` | The connection check was a `page.evaluate` containing `resolve(true)` in a `setTimeout` — a hardcoded pass. Its verdict then OR-ed in `(!hasSignalRError && consoleLogs.length > 0)`, true on any page that logs anything. |
| `memory-leak-detection` (prior session) | Imported `test` from `@playwright/test`, so it ran unauthenticated against the **Keycloak login page**; navigated three routes that do not exist; called `window.gc()`, which is `undefined` without `--expose-gc`. |
| `session-token-renewal` | Asserted the OIDC token exists in `sessionStorage` — which the *fixture* injects via `addInitScript`. It was checking the harness's own data. It also computed a silent-callback request list and a token/refresh log filter and never asserted on either, then slept 5s to "observe renewal" the realm's 1800s lifespan makes impossible. |
| `expand-unit-to-manage-user-msel-roles` | Located role controls as `mat-checkbox`; the app renders a multi-select `mat-select`. The wrong locator matched 0 elements and an `if (count > 0) … else assert the row is still visible` fallback hid it — the `else` re-asserted something proven four lines earlier, so **both branches passed unconditionally**. |
| `launch-new-event` | Every step guarded by `if (!visible) { test.skip(); return; }`. Ended on the comment `// One of these outcomes expected` with no assertion. |
| `manage-deployed-event` | Verdict was `expect(statusChanged || notifVisible).toBe(true)` — an OR over two soft probes, passing whichever way the app behaved. |
| `api-integration-*`, `player-integration-*` | Entirely wrapped in `if (await x.isVisible().catch(() => false))`. On this stack the outermost condition was false, so they asserted **nothing** — and leaked a MSEL every run under a literal name the purge could not match. |
| 4 search/filter specs | `expect(filteredCount).toBeGreaterThanOrEqual(0)` — always true. |

A recurring root cause: **`text=A, text=B` selectors.** Playwright's `text=` engine cannot be
comma-combined, so those locators match **zero elements**, which is what silently triggered most
of the self-skips.

### Test-helper defects that broke 17+ specs at once

- **`createScenarioEvent` never sent `scenarioEventType`.** `EventType` starts at 10
  (`Inject=10`), so omitting it persists **0** — not an enum member. The grid picks a row's
  columns by matching that value against the three members, so with 0 it renders **no cells at
  all**, regardless of the data. 17 specs seeded through this helper and could only ever assert
  row *presence*. Verified live: the API echoes back `"scenarioEventType": 0`.
- **`seedMselDataFields` depended on a pre-existing `Standard MSEL` row.** Nothing in the suite
  creates it. That made every scenario-events, playbook and event-detail spec depend on the
  current database shape — precisely what `CLAUDE.md` forbids — and all of them would have failed
  in `beforeEach` on a fresh database. Now declares the 13 fields literally.
- **The teardown purge matched almost nothing.** It filtered on the literal prefix `TestBP-`
  plus a hand-maintained allowlist, while specs generate **~50 different prefixes**
  (`DeleteUnit-`, `EditUnit-`, `SearchMatch-`, `ViewList1-`, …). A live stack was found holding
  **11 leaked units and 5 leaked MSELs**. Replaced with a match on the *shape*
  `tempBlueprintName()` emits (`/-\d{13}-\d{1,6}$/`), so a new prefix is swept automatically.

---

## Root causes found, rather than worked around

### `admin-inject-types-and-catalogs` — the only hard failure in the baseline

The prior session concluded this directory was "only sound single-threaded" (blaming ~77
positional locators) and documented a `--workers 1` requirement. That was not the mechanism.

Deleting an inject type **cascade-deletes every catalog that references it**:
```
POST /api/injectTypes {name: ZZCascadeIT}                    -> 201  id=IT
POST /api/catalogs    {name: ZZCascadeCat, injectTypeId: IT}  -> 201  id=CAT
DELETE /api/injectTypes/IT                                    -> 204
GET /api/catalogs/CAT                                         -> 204 (empty)   <-- gone
```
Five specs picked their inject type with `page.locator('mat-option, [role="option"]').first()` —
the **globally** first option, frequently a *sibling spec's*. That sibling's cleanup then
destroyed this spec's catalog mid-test. Each spec now selects the inject type it created itself.

### The launch flow is empty by design

Four specs self-skipped waiting for launch cards. `MselService.cs:2203`:
```csharp
// DISABLED: Auto-discovery based on email domain matching
// Users must now use invitation links directly to launch MSELs
return new List<ViewModels.Msel>();
```
`GET /api/my-launch-msels` returns `[]` unconditionally. A deliberate product decision, so **no
bug filed** — but it means no card can ever appear, which is why those specs degenerated. They
now assert that contract, and fail if auto-discovery is ever re-enabled.

### Joining is gated twice, not once

`my-join-msels` needs `status: Deployed` **+** non-null `PlayerViewId` **+** team membership.
But `POST .../join` separately checks the Player views the user is *genuinely* in, and otherwise
falls through to the invitation branch with **403**. So a joinable-looking MSEL is not a joinable
MSEL — an invitation is also required. Both are now seeded via `seedJoinableMsel`.

---

## Application bugs

Five new, and one materially re-diagnosed. Each was reproduced directly and traced to a source
line before being recorded; two agent-reported bugs were **rejected** after failing verification.

| ID | Severity | Summary |
|---|---|---|
| **BP-6** | high | *Re-diagnosed.* Every write to an entity with a SignalR handler wedges once a client connection goes stale; reads stay instant. See below. |
| **BP-12** | medium | No ARIA landmarks on any route; `/` and `/build` render no headings at all. |
| **BP-13** | medium | At 375px, controls render up to **708px** past the right edge while the document does not scroll — clipped and unreachable. |
| **BP-14** | medium | `user-data.service.ts:112` uses insert-only akita `add()` where all five sibling services use `upsert()`, so a role change never reaches the local store. |
| **BP-15** | medium | All four integration *name* lookups are browser-side calls to other services' APIs and every one fails CORS preflight. Verified: Player's API returns `Access-Control-Allow-Origin` for `:4301` but **no CORS headers at all** for Blueprint's `:4725`. |
| **BP-16** | medium | `admin-catalog-list` mounts one `<app-inject-list>` **per row** with no `@if` gate, and `loadByCatalog` does an unfiltered whole-store `set()`. Whichever catalog's GET resolves last wins for every mounted list. |
| **BP-9** | high | *Extended.* `archive()`'s error callback only calls `setLoading(false)` — it never reaches `ErrorService`, unlike lines 435/456/468 in the same file — so a failed **End Event** is completely silent. |

Two measurement claims in existing entries were **corrected** because they were wrong in ways
that mattered:

- BP-13's predecessor claimed `body.scrollWidth` was "~466px at 375px". Measured: **375**. Its
  assertion `expect(bodyWidth).toBeLessThanOrEqual(375)` would have **passed** — the metric could
  not detect the defect it described.
- BP-12's predecessor claimed the app "does not use semantic heading elements". Templates
  actually contain 3 `<h1>`, 10 `<h2>`, 4 `<h3>`, 5 `<h4>` — just not on the main surfaces. The
  *landmark* half was correct.

### BP-6, the blocker

Originally "the API intermittently stalls under light concurrency", diagnosis unknown. Reproduced
with a single `curl`, sequentially, **zero browsers running**:
```
GET  /api/users -> 200 in 0.004s
POST /api/users -> 000 after 12s      (also 15s, 20s, 25s caps)
```
Ruled out with evidence: **not the DB** (7 connections, **0 blocked locks**, no long query);
**not the service method** (`Add` + `SaveChangesAsync` + re-GET); **not load** (load avg ~1 on 16
cores); **not test concurrency** (single `curl`).

The cause is on the request path —
`Infrastructure/EventHandlers/UserHandler.cs:41-56` awaits `Task.WhenAll` over
`_mainHub.Clients.Group(...).SendAsync(...)` **before the HTTP response**. One half-dead client
connection holds the writer. Reads have no such handler, which is exactly why they stay fast.

**It is process state.** On a freshly started API the same POST is **201 in 8-62ms**; after a few
runs it hangs, with no test change in between — measured three separate times. Once wedged,
`aspire resource blueprint-api restart` can itself fail with *"Failed to stop resource"*.

**It degrades:** early in the session it took 3-4 full runs to wedge; by the end, 1-2.

Observed 5 times. Every failure it causes is a **write** timing out — never an assertion about
app behaviour being wrong.

---

## Verification

**Fresh-database run** (`aspire stop` → remove the postgres container **and its volume** →
`aspire start` → delete `.auth/`). Fresh DB holds only 3 migration-seeded MSELs, 0 units, 1 user:

> **139 tests: 125 passed, 0 failed, 14 skipped**

This is the real proof that every spec seeds its own data. (The user's suggested
`minikube/clean-postgres.sh` does not apply here — it looks for a Kubernetes StatefulSet via
`kubectl` and exits early under Aspire, which runs Postgres as the `crucible-postgres` container.)

**Consecutive-run attempts.** Best observed sequence on a healthy API:

| Run | Summary | Strict |
|---|---|---|
| 1 | 125 / 0 failed / 14 skipped | flaky=1 |
| 2 | 125 / 0 failed / 14 skipped | **flaky=0, unexpected=0** |
| 3 | 125 / 0 failed / 14 skipped | flaky=1 |
| 4 | 122 / **3 failed** / 14 skipped | unexpected=3 — all write timeouts (BP-6) |

Restarting `blueprint-api` before each run does not fix it, because the API wedges **during** a
run. **The 5-run gate is unreachable until BP-6 is fixed.**

---

## Remaining work

> **Superseded by the third pass (2 Aug 2026).** See `blueprint-third-pass-report.html`.
> All three items below are now closed, and one of them was based on a wrong premise:
>
> - **3 bare `test.skip()` → 0.** All three now seed their own fixtures and assert real
>   behaviour; each was verified to fail with its precondition withheld.
> - **81 `waitForTimeout`/`networkidle` → 0.**
> - **14 skips → 11** (the three bare skips became real tests).
>
> **Correction:** the claim that the wait residue was "concentrated in
> `admin-inject-types-and-catalogs` ... load-bearing there until BP-16 is fixed" was **wrong**.
> That directory contained **zero** `waitForTimeout`/`networkidle`, both now and at commit
> `6cc6dcc` (the commit this report was written from). The residue was in the SignalR (20),
> accessibility (19), integration (14) and performance (11) directories, and none of it was
> load-bearing. The real obstacle was that almost every sleep sat inside a spec that could not
> fail, so each had to gain a real fixture before its sleep could go.
>
> **BP-6 is fixed** on `fix/bp-6-signalr-broadcast-blocks-writes` in `blueprint.api`. Measured
> with 4 non-draining subscribers over 200 writes: p99 10,974 ms → 22 ms, max 11,003 ms → 48 ms,
> stalls ≥150 ms 4 → 0, with reads at 3 ms throughout. Two new app bugs were found by specs that
> started measuring something real: **BP-17** (permissions refetched per component mount — 11
> requests across 4 page loads) and **BP-18** (a client can silently stop receiving a MSEL's
> updates for the rest of its session; currently the only 2 failing specs).

## Caveat worth stating plainly

`blueprint.ui` is checked out on the local, unpushed branch
`fix/msel-info-datafield-subscription-leak` (the BP-11 leak fix from the prior session). The
suite's green state depends on that unpushed application change. On `main`,
`memory-leak-detection` fails at ~963 detached nodes per render — correctly, since it is a real
leak.

Also: **concurrent Blueprint suite runs against one stack sabotage each other.** The
`globalTeardown` purge deletes every row matching the generated-name shape, including another
in-flight run's fixtures. Run the suite one at a time.
