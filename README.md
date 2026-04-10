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

The agents require Crucible services to be running since they interact with the applications through a real browser.

The agent definitions are generated during container creation by `npx playwright init-agents` (see `postcreate.sh` in the crucible-development repo) and stored in the crucible-development workspace.

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

# Skip service health checks
./run-tests.sh topomojo --no-check

# View test report
./run-tests.sh report

# Direct Playwright commands
npx playwright test --project=chromium topomojo/tests/
```

The script automatically checks that **Keycloak** and the **target application** are reachable before running tests. Use `--no-check` to skip these checks.

**Supported applications:** `alloy`, `blueprint`, `caster`, `cite`, `gallery`, `gameboard`, `keycloak`, `moodle`, `player`, `steamfitter`, `topomojo`

## Configuring Service URLs

All service URLs are defined in a single file at the root of this repository:

```
.env
```

Edit this file to change ports or hostnames for your environment. The `.env` file is loaded by:
- **Shell scripts** (`run-tests.sh`, `setup.sh`) via `source`
- **Playwright config and fixtures** via `dotenv`

If the file is missing, all URLs fall back to their default `localhost` values.

Example entries:
```bash
TOPOMOJO_UI_URL=http://localhost:4201
KEYCLOAK_URL=https://localhost:8443
BLUEPRINT_UI_URL=http://localhost:4725
```

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

## Troubleshooting

- **Services not running** — Start Aspire first via a VS Code launch profile or `aspire run`
- **Auth failures** — Verify Keycloak is running at the URL configured in `.env` (ignore cert warning)
- **Timeouts** — Check the Aspire dashboard for service health (URL in `.env`)
- **Wrong URLs** — Edit `.env` to match your environment; all scripts and fixtures read from it
- **Browser issues** — Run `npx playwright install --force` to reinstall browsers
