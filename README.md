# Crucible Playwright Tests

End-to-end tests for the Crucible platform using [Playwright](https://playwright.dev/), organized by application.

## Prerequisites

These tests are designed to run from the [crucible-development](https://github.com/cmu-sei/crucible-development) dev container. The dev container automatically installs all dependencies (Node.js, Playwright browsers, and npm packages) during container creation — no manual setup required.

## Test Agents

The dev container automatically initializes three [Playwright test agents](https://playwright.dev/docs/test-agents) These agents allow you to plan, generate, and fix tests by interacting with a real browser.

| Agent | Purpose |
|-------|---------|
| **playwright-test-planner** | Explores a running application in a browser and produces a comprehensive test plan markdown file |
| **playwright-test-generator** | Executes test plan steps in a real browser and generates `.spec.ts` files from the recorded actions |
| **playwright-test-healer** | Runs failing tests, debugs them in a live browser, and fixes the test code |

To use the agents, describe what you need. The right agent is automatically selected:

- *"Create a test plan for the Player application"* — the **planner** explores the Player UI and saves a test plan
- *"Generate tests for the Blueprint authentication section"* — the **generator** creates spec files from the test plan
- *"Fix the failing Blueprint tests"* — the **healer** debugs and repairs broken tests

To generate comprehensive coverage for an application, use a prompt like:

> @"playwright-test-generator (agent)" look at the `<app>-test-plan.md` and generate all tests mentioned in the test plan with multiple agents running in parallel using the established shared fixtures and authentication mechanism. Read the application documentation for additional context and add test-plan coverage where necessary.

The agents require Crucible services to be running since they interact with the applications through a real browser.

The Claude agent definitions are stored in `.claude/agents/`. The
repository-local `.mcp.json` starts the `playwright-test` MCP server using this
suite's Playwright configuration.

### Codex Agents

Codex uses equivalent project-scoped agents in `.codex/agents/`:
`playwright-test-planner`, `playwright-test-generator`, and
`playwright-test-healer`. The `.codex/config.toml` file starts the local
`playwright-test` MCP server using this repository's Playwright configuration.

From a Codex session opened in this repository, prefer the repository-local
skills in `.codex/skills/`. They explicitly dispatch the matching agent role
and wait for it to complete:

```text
$plan-crucible-tests Plan CITE team-management coverage.
$generate-crucible-tests Implement CITE scenario "Create a team".
$heal-crucible-tests Repair the failing gameboard leaderboard spec.
```

Name the target app and the feature, test-plan scenario, or failing spec in the
prompt. Include the failing command, logs, trace, or screenshot when healing a
test. Use `/mcp` to confirm that `playwright-test` is connected before
browser-driven work.

Use `/agent playwright-test-planner`, `/agent playwright-test-generator`, or
`/agent playwright-test-healer` if project skills are unavailable in
the Codex surface. Crucible services must be running before any agent can
drive the browser or run an end-to-end test.

## Running Tests

Before running tests, start the Crucible services using one of the VS Code launch profiles (F5) or `aspire run` from the AppHost directory.

### Using the VS Code Playwright Extension

The dev container includes the [Playwright Test for VS Code](https://marketplace.visualstudio.com/items?itemName=ms-playwright.playwright) extension, pre-configured to use this test suite.

#### Opening the Test Explorer

1. Click the **Testing** icon (beaker) in the VS Code Activity Bar, or press `Ctrl+Shift+T`
2. The test tree shows all applications and their spec files — expand any app to see individual tests

#### Running Tests

- **Run a single test** — hover over a test name and click the **Run** (▶) button
- **Run a file or suite** — click **Run** on a parent node (e.g., an app folder or `describe` block)
- **Run all tests** — click **Run** at the top of the test tree
- **Keyboard shortcut** — select a test and press `Ctrl+Shift+R` to run it

#### Watching the Browser (Headed Mode)

Check **Show browser** at the top of the Testing panel to launch a visible Chromium window when tests run. This is useful for understanding what a test does or diagnosing failures.

#### Debugging Tests

1. Set breakpoints in any `.spec.ts` file by clicking the gutter
2. Right-click a test in the test tree and choose **Debug Test**, or click the **Debug** icon next to the test name
3. The test pauses at your breakpoints — use the VS Code debug toolbar to step through code
4. The browser stays open while paused, so you can inspect the page in DevTools

#### Picking a Locator

The extension includes a **Pick locator** tool that helps you find robust selectors:

1. Check **Show browser** and run any test so a browser window opens
2. Click **Pick locator** in the Testing panel toolbar
3. Hover over elements in the browser — the extension generates a recommended Playwright locator
4. Click an element to copy the locator to your clipboard for use in test code

#### Viewing Traces

After a test fails, click the **Show trace** link in the test results to open the [Playwright Trace Viewer](https://playwright.dev/docs/trace-viewer). The trace shows a timeline of every action with DOM snapshots, network requests, and console logs.

#### Filtering and Searching

- Use the **Filter** text box at the top of the test tree to search tests by name (e.g., type `login` to show only login-related tests)
- Use the **@failed** filter to re-display only tests that failed on the last run

#### Selecting a Browser Project

The extension reads browser projects from `playwright.config.ts`. Click the **Select Default Profile** dropdown in the Testing panel to choose between configured projects (Chromium or Firefox). Only Chromium is installed by default in the dev container — to use Firefox, run `npx playwright install firefox` first.

### Using the Command Line

```bash
cd /mnt/data/crucible/crucible-tests

# Run tests for a specific application
./run-tests.sh topomojo
./run-tests.sh blueprint
./run-tests.sh player

# Run all tests
./run-tests.sh all

# Run all tests for a specific app (equivalent to the app shorthand above)
./run-tests.sh all --app cite

# Smoke tests (matches tests with "login" or "home" in the name)
./run-tests.sh quick --app gameboard
./run-tests.sh quick                   # all apps

# Interactive UI mode
./run-tests.sh ui caster

# Headed mode (see browser)
./run-tests.sh headed alloy

# Debug mode
./run-tests.sh debug steamfitter

# Filter tests by pattern
./run-tests.sh gallery --filter "home"
./run-tests.sh all --filter login --app player

# Control the number of parallel workers (count or percentage)
./run-tests.sh all --workers 4
./run-tests.sh cite --workers 50%

# Skip service health checks
./run-tests.sh topomojo --no-check

# View test report
./run-tests.sh report

# Direct Playwright commands
npx playwright test --project=chromium topomojo/tests/
```

The script automatically checks that **Keycloak** and the **target application** are reachable before running tests. Use `--no-check` to skip these checks.

By default the number of parallel workers comes from `playwright.config.ts` (1 on CI, 2 locally). Use `--workers <n>` to override it per run — accepting either a count (`4`) or a percentage of CPU cores (`50%`). The flag is ignored for the interactive `ui` and `debug` modes, which Playwright always runs with a single worker. Note that tests share a single Crucible stack, so raising the worker count increases concurrent load on Keycloak and the apps and can surface auth/timing flakiness.

**Supported applications:** `alloy`, `blueprint`, `caster`, `cite`, `gallery`, `gameboard`, `keycloak`, `moodle`, `player`, `steamfitter`, `topomojo`

## Configuring Service URLs

Service URLs live in env files at the root of this repository. The suite supports two deployment topologies and selects between them via the `CRUCIBLE_TARGET` environment variable (or the `--target` flag on `run-tests.sh`):

| `CRUCIBLE_TARGET` | File loaded     | Use when…                                                                |
|-------------------|-----------------|--------------------------------------------------------------------------|
| _(unset)_         | `.env`          | You want today's behavior — whatever you have configured locally.        |
| `aspire`          | `.env.aspire`   | Crucible is running via .NET Aspire (each app on its own `localhost:<port>`). |
| `minikube`        | `.env.minikube` | Crucible is running in Minikube via Helm (single ingress host).          |

`.env.local` (gitignored) is loaded last — use it to override individual values without editing the tracked profile files. Shell-exported vars beat all of the above.

```bash
# One-off
CRUCIBLE_TARGET=minikube ./run-tests.sh blueprint

# Same thing via the flag
./run-tests.sh blueprint --target minikube

# Aspire (the default; equivalent to today)
./run-tests.sh blueprint --target aspire

# Set for the whole shell
export CRUCIBLE_TARGET=minikube
./run-tests.sh all
```

If you copy `.env.minikube` to `.env.local`, you can edit a single override (e.g. a custom ingress host) without touching the tracked file:

```bash
# .env.local
CRUCIBLE_HOST=mycluster.example.com
KEYCLOAK_URL=https://mycluster.example.com/keycloak
# …only the keys you want to override
```

### Minikube caveats

- The Aspire dashboard does not exist under Minikube; `Services.AspireDashboard` is empty in that profile.
- `gameboard/db-helpers.ts` uses `docker inspect crucible-postgres` to read the DB password. Under Minikube that container does not exist — set `CRUCIBLE_POSTGRES_PASSWORD` and port-forward `5432` to the in-cluster `crucible-infra-postgresql-rw` service, or skip the affected scoreboard tests.
- A handful of tests still hardcode `localhost:4xxx` / `localhost:8443` regex matchers (mostly under `player/tests/`). They do not pass against Minikube without per-test fixes — convert them to `Services.X.UI` if you need them green.

## Directory Structure

```
crucible-tests/
├── .env                       # Service URLs (single source of truth)
├── playwright.config.ts       # Global Playwright config
├── shared-fixtures.ts         # Shared auth helpers and service URL map
├── package.json
├── setup.sh                   # Manual setup (if needed outside the dev container)
├── run-tests.sh               # Test runner with app targeting
├── seed.spec.ts               # Seed template for agent test generation
└── {app}/                     # Per-application test directory
    ├── {app}-test-plan.md     # Test plan documentation
    ├── fixtures.ts            # App-specific auth fixtures (optional)
    └── tests/
        └── {feature}/
            └── {scenario}.spec.ts
```

**Applications:** alloy, blueprint, caster, cite, gallery, gameboard, keycloak, moodle, player, steamfitter, topomojo

## Writing Tests

### Authentication

All Crucible apps authenticate through Keycloak. Use the shared fixtures:

```typescript
import { test, expect } from '@playwright/test';
import { Services, authenticateWithKeycloak } from '../shared-fixtures';

test('should access application', async ({ page }) => {
  await authenticateWithKeycloak(page, Services.Blueprint.UI);
  await expect(page).toHaveURL(new RegExp(Services.Blueprint.UI));
});
```

Default credentials: `admin` / `admin`

### App-Specific Fixtures

Each app can extend shared fixtures with an authenticated page:

```typescript
// {app}/fixtures.ts
import { test as base } from '@playwright/test';
import { Services, authenticateWithKeycloak } from '../shared-fixtures';

export const test = base.extend({
  authenticatedPage: async ({ page }, use) => {
    await authenticateWithKeycloak(page, Services.MyApp.UI);
    await use(page);
  },
});

export { expect } from '@playwright/test';
```

### Test Organization

- Each app has a test plan (`{app}-test-plan.md`) that guides what tests to write
- Group tests by feature in subdirectories under `tests/`
- Keep tests independent — they should not depend on each other
- Use `Services` from `shared-fixtures.ts` for all URLs (never hardcode ports)

## Adding Tests for a New Application

1. Add service URLs to `.env` (e.g., `MYAPP_UI_URL=http://localhost:XXXX`)
2. Add the corresponding `process.env` entry in `shared-fixtures.ts`
3. Create the app directory: `mkdir -p {app}/tests`
4. Write a test plan: `{app}/{app}-test-plan.md`
5. Create `{app}/fixtures.ts` with an app-specific auth fixture (optional)
6. Add feature directories and spec files following the test plan

**Note:** Authentication is handled by `authenticateWithKeycloak()` in `shared-fixtures.ts`, which works for all apps. No need to create per-app auth setup files.

## Skipped tests

Some tests are skipped pending fixes in upstream Crucible services. These use `test.skip(...)` with a comment linking to the tracked issue. Check the note in the spec file before re-enabling.

| App | Test | Reason |
|-----|------|--------|
| gameboard | `Large Data Set Handling - Leaderboard Pagination` (`gameboard/tests/error-handling/leaderboard-pagination.spec.ts`) | `/api/game/{id}/score` performs per-team queries in a loop and times out at 60s for 120 seeded teams. Blocked on batched-query rewrite of `ScoringService.GetGameScore`. |
| blueprint | `Delete Team` (`teams-and-organizations-management/delete-team.spec.ts`) | **BP-1** — the Teams grid does not refresh after a delete: `DELETE /api/teams/{id}` returns 204 and the API confirms removal, but the row stays rendered (>15s, no follow-up GET). |
| blueprint | `MSEL Form Validation - empty name is rejected` (`msel-management/msel-form-validation.spec.ts`) | **BP-3** — the MSEL Name field has no validator at either layer. With the form dirtied, clearing Name leaves Save enabled, shows no `mat-error`, PUTs 200, and persists `name: ""`. |
| blueprint | `Required Field Validation` (`error-handling-and-validation/required-field-validation.spec.ts`) | **BP-3** — same defect, asserted from the missing-`mat-error` angle. |
| blueprint | `View Scenario Events in MSEL` (`scenario-events-management/view-scenario-events-in-msel.spec.ts`) | **BP-5** — `GET /api/msels/{id}/scenarioEvents` omits `dataValues` (the list query lacks `.Include`), so every Scenario Events grid cell renders blank. |
| blueprint | `User Logout Flow` (`authentication-and-authorization/user-logout-flow.spec.ts`) | **BP-7** — Logout does nothing: the OIDC token stays in `sessionStorage`, no Keycloak end-session redirect, user stays signed in. |
| blueprint | `Date Range Validation` (`error-handling-and-validation/date-range-validation.spec.ts`) | **BP-8** — a MSEL accepts a negative `durationSeconds`, i.e. an end time before its start. |
| blueprint | `API Error Display` (`error-handling-and-validation/api-error-display.spec.ts`) | **BP-9** — a failed save shows no error and disables Save as if it succeeded, so the edit is silently lost. |
| blueprint | `Import Scenario Events from Excel` (`export-and-import/import-scenario-events-from-csv.spec.ts`) | **BP-10** — xlsx import discards each event's exported time and assigns `rowIndex * 60`, silently rewriting the timeline. |
| blueprint | `Screen Reader Compatibility` (`accessibility-and-usability/screen-reader-compatibility.spec.ts`) | **BP-12** — no ARIA landmarks on any route, and `/` and `/build` render no headings at all (`/admin` has one `<h2>`). |
| blueprint | `Responsive Layout - Mobile View` (`accessibility-and-usability/responsive-layout-mobile-view.spec.ts`) | **BP-13** — at a 375px viewport, controls render up to 708px past the right edge while the document does not scroll horizontally, so they are unreachable. |
| blueprint | `Player Integration - View Name Displayed` (`integration-with-crucible-services/player-integration-view-association.spec.ts`) | **BP-15** — all four deployed-integration name lookups are browser-side calls to the other services' APIs and every one fails CORS preflight, so only a raw GUID renders. |
| ~~blueprint~~ | ~~`Memory Leak Detection`~~ — **BP-11 is fixed; this test now passes** | **BP-11 (resolved)** — the MSEL Info section retained ~963 detached DOM nodes per render (`msel-info.component.ts:326` subscribed `dataFieldQuery.selectAll()` without `takeUntil`). Fixed in Blueprint.Ui branch `fix/msel-info-datafield-subscription-leak` (local, unpushed). The spec was verified to still fail against the unfixed build, so it guards the regression. |

Every blueprint skip above keeps its **correct** assertion in the test body — nothing is
deleted, weakened, or commented out — so each one starts passing as soon as the underlying
defect is fixed. Each skipped assertion has also been **verified to fail when un-skipped**: a
skip whose assertion is wrong hides the defect just as effectively as a deleted one. BP-11 is
the worked example of the whole cycle: the assertion was left in its correct failing form, the
app defect was fixed, and the spec went green without being touched.

Full reproductions and evidence for BP-1 … BP-15 are in
[`blueprint/blueprint-app-bugs.md`](blueprint/blueprint-app-bugs.md). That file also records
defects which do **not** block a test, and so have no row above:

- **BP-4** — `GET /api/msels/{id}` returns 500 with a stack trace for a nonexistent id.
- **BP-6** — `POST` to an entity that has a SignalR handler can wedge the API. The write path
  awaits `Task.WhenAll` over the hub fan-out
  (`Infrastructure/EventHandlers/UserHandler.cs`), so one leaked or half-dead client connection
  blocks it indefinitely. Reproduced outside Playwright: `GET /api/users` in 8ms while
  `POST /api/users` hung past 25s with no browsers running, zero blocked DB locks, and
  `aspire resource blueprint-api restart` unable to stop the process. Restarting the API
  restores 8–22ms writes with no test change. **If a run suddenly shows API timeouts after a
  long session, restart `blueprint-api` rather than suspecting the specs.**
- **BP-14** — a user's role change never reaches the local store, so the admin Users table
  shows a stale role until a full page load (`user-data.service.ts` uses insert-only akita
  `add()` where all five sibling data services use `upsert()`).

The whole Blueprint suite runs at `--workers 2`. An earlier note here claimed
`admin-inject-types-and-catalogs` needed `--workers 1` because of "~77 positional locators";
that was not the mechanism. Deleting an inject type **cascade-deletes every catalog that
references it**, and five specs bound their catalog to the globally-first `mat-option` — often
a sibling spec's inject type — so that sibling's cleanup destroyed this spec's catalog
mid-test. Each spec now selects the inject type it created itself and seeds under
`tempBlueprintName()`, and the directory is 2-worker-safe.

Note that **concurrent Blueprint suite runs against one stack will sabotage each other**: the
`globalTeardown` purge deletes every row whose name matches the `tempBlueprintName()` shape,
including another in-flight run's fixtures. Run the suite once at a time.

## Troubleshooting

- **Services not running** — Start Aspire first via a VS Code launch profile or `aspire run`
- **Auth failures** — Verify Keycloak is running at the URL configured in `.env` (ignore cert warning)
- **Timeouts** — Check the Aspire dashboard for service health (URL in `.env`)
- **Wrong URLs** — Edit `.env` to match your environment; all scripts and fixtures read from it
- **Browser issues** — Run `npx playwright install --force` to reinstall browsers
