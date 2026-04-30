# CLAUDE.md — Crucible Playwright Tests

This repo contains end-to-end Playwright tests for the Crucible platform, organized by application. Tests run against live services orchestrated by .NET Aspire from the `crucible-development` dev container.

## Repository Structure

```
crucible-tests/
├── shared-fixtures.ts         # Auth helpers, service URLs (Services object)
├── playwright.config.ts       # Global config (5min timeout, sequential, Chromium)
├── .env                       # Service URLs (single source of truth)
├── seed.spec.ts               # Seed template for agent test generation
├── run-tests.sh               # CLI test runner with app targeting
└── {app}/                     # One directory per Crucible application
    ├── fixtures.ts            # App-specific auth fixture (e.g., citeAuthenticatedPage)
    ├── test-helpers.ts        # Resource create/delete helpers (where needed)
    ├── {app}-test-plan.md     # Comprehensive test plan
    └── tests/{feature}/*.spec.ts
```

**Applications:** alloy, blueprint, caster, cite, gallery, gameboard, keycloak, moodle, player, steamfitter, topomojo

## Source Code Locations

Each Crucible application has a corresponding API and UI repo cloned under `/mnt/data/crucible/`. The naming convention is:

| App | API repo | UI repo |
|-----|----------|---------|
| alloy | `/mnt/data/crucible/Alloy.Api` | `/mnt/data/crucible/Alloy.Ui` |
| blueprint | `/mnt/data/crucible/Blueprint.Api` | `/mnt/data/crucible/Blueprint.Ui` |
| caster | `/mnt/data/crucible/Caster.Api` | `/mnt/data/crucible/Caster.Ui` |
| cite | `/mnt/data/crucible/Cite.Api` | `/mnt/data/crucible/Cite.Ui` |
| gallery | `/mnt/data/crucible/Gallery.Api` | `/mnt/data/crucible/Gallery.Ui` |
| gameboard | `/mnt/data/crucible/Gameboard` | `/mnt/data/crucible/Gameboard.Ui` |
| player | `/mnt/data/crucible/Player.Api` | `/mnt/data/crucible/Player.Ui` |
| steamfitter | `/mnt/data/crucible/Steamfitter.Api` | `/mnt/data/crucible/Steamfitter.Ui` |
| topomojo | `/mnt/data/crucible/TopoMojo` | `/mnt/data/crucible/TopoMojo.Ui` |

## Authentication

All apps authenticate through Keycloak (OIDC). Default credentials: `admin` / `admin`.

- **Shared helper:** `authenticateWithKeycloak(page, appUrl)` in `shared-fixtures.ts` handles three auth flows (immediate redirect, async redirect, already authenticated).
- **App fixtures:** Each app exports a pre-authenticated page fixture (e.g., `citeAuthenticatedPage`, `blueprintAuthenticatedPage`) from `{app}/fixtures.ts`.
- **Service URLs:** Always use `Services.{App}.UI` / `Services.{App}.API` from `shared-fixtures.ts` — never hardcode ports.

## Test Conventions

- Import `test`, `expect`, and `Services` from the app's `fixtures.ts`, not directly from `@playwright/test`.
- One spec file per test scenario, filed under `{app}/tests/{feature-category}/`.
- Tests must be independent — no test should depend on another test's state.
- Use accessibility-first locators: `getByRole()`, `getByLabel()`, `getByText()`.
- Include the copyright header in every `.ts` file.
- Include `// spec:` and `// seed:` comment lines linking back to the test plan.

## Resource Management (Critical)

Tests that create resources (evaluations, scoring models, event templates, etc.) **must** handle their own lifecycle:

1. **Create per-test** — each test creates the resources it needs within its own scope.
2. **Clean up per-test** — use `test.afterEach` to delete created resources, even if the test fails.
3. **Use test-helpers** — import create/delete functions from `{app}/test-helpers.ts`. Create a `test-helpers.ts` file if the app doesn't have one yet.
4. **Error-safe cleanup** — helper functions return booleans and log errors instead of throwing, to avoid masking the original test failure.
5. **Close dialogs before cleanup** — helpers should dismiss any open dialogs (Escape or Cancel) before attempting deletions.

Example pattern:
```typescript
test.describe('Feature', () => {
  const TEST_RESOURCE = 'Test Resource Automation';

  test('creates a resource', async ({ appAuthenticatedPage: page }) => {
    // ... test that creates TEST_RESOURCE ...
  });

  test.afterEach(async ({ appAuthenticatedPage: page }) => {
    await deleteResourceByName(page, TEST_RESOURCE);
  });
});
```

---

## Agent-Specific Instructions

### Planner Agent (`playwright-test-planner`)

**Goal:** Produce or update the test plan (`{app}/{app}-test-plan.md`) so it covers all features — especially new ones.

**Before creating or updating a test plan:**

1. **Review recent code changes.** Diff the app's API and UI repos against `main` to identify new features, modified endpoints, and UI changes:
   - API: check `/mnt/data/crucible/{App}.Api` (or equivalent) for new controllers, endpoints, models.
   - UI: check `/mnt/data/crucible/{App}.Ui` (or equivalent) for new components, routes, dialogs.
2. **Read the existing test plan** (`{app}/{app}-test-plan.md`) to understand what is already covered.
3. **Cross-reference** the code changes against the test plan. Identify any new features, modified behaviors, or new UI flows that are **not** covered by existing test scenarios.
4. **Explore the running app** in the browser to verify the features exist and understand their behavior before writing test steps.

**When writing the test plan:**

- Follow the existing format: `## Test Scenarios` > `### N. Category` > `#### N.M. Scenario` with `File:`, `Steps:`, and `- expect:` lines.
- Assign each scenario a file path following the convention: `tests/{feature-category}/{scenario-slug}.spec.ts`.
- Add new scenarios at the end of the appropriate category, or create a new category if none fits.
- Do not remove existing scenarios — only add or update.

### Generator Agent (`playwright-test-generator`)

**Goal:** Ensure every scenario in the test plan has a corresponding `.spec.ts` file, and generate any that are missing.

**Before generating tests:**

1. **Read the test plan** (`{app}/{app}-test-plan.md`) to get the full list of scenarios and their file paths.
2. **Check which spec files already exist** — compare the file paths listed in the plan against the files on disk under `{app}/tests/`.
3. **Identify missing tests** — any scenario in the plan without a corresponding spec file needs to be generated.
4. **Read the app's `fixtures.ts`** to know the correct authenticated page fixture name.
5. **Read the app's `test-helpers.ts`** (if it exists) to know available resource create/delete helpers.

**When generating tests:**

- Import from the app's `fixtures.ts` (e.g., `import { test, expect, Services } from '../../fixtures';`).
- Import resource helpers from the app's `test-helpers.ts` when the test creates or modifies resources.
- Use the app's authenticated page fixture (e.g., `{ citeAuthenticatedPage: page }`) — do not call `authenticateWithKeycloak` directly in test bodies.
- Each test that creates resources must clean them up via `test.afterEach`. Resources should be created within the test itself, not in `test.beforeEach` (unless shared across all tests in a describe block).
- Follow the steps and expectations from the test plan.
- Include the copyright header and `// spec:` / `// seed:` comment lines.
- If a `test-helpers.ts` doesn't exist for the app and the test needs resource helpers, create one following the patterns in `cite/test-helpers.ts` or `alloy/test-helpers.ts`.

### Healer Agent (`playwright-test-healer`)

**Goal:** Make all tests pass. Fix test code issues; flag application bugs.

**When debugging and fixing tests:**

1. **Run the failing tests** to reproduce the failure and read the error output.
2. **Inspect the live app in the browser** to verify what the UI actually renders — locators may be stale or selectors may have changed.
3. **Fix test code** when the issue is in the test (wrong locator, missing wait, incorrect assertion, timing issue).
4. **Fix resource lifecycle issues:**
   - If a test fails because it expects a resource that doesn't exist, add per-test resource creation.
   - If a test leaves stale resources that break other tests, add `test.afterEach` cleanup.
   - Every resource created in a test must be cleaned up in that same test's scope.
5. **Mark application bugs with `test.fixme`** — if the test is correct but the app has a bug that prevents it from passing:
   - Replace `test('name', ...)` with `test.fixme('name', ...)`.
   - Add a comment block **above** the `test.fixme` line describing the bug, what was expected, and what actually happens. Follow this format:
     ```typescript
     // FIXME: {Brief description of the app bug}
     // When {action}, the application {actual behavior}.
     // Expected: {expected behavior}.
     test.fixme('Test Name', async ({ appAuthenticatedPage: page }) => {
     ```
   - Do not delete the test body — keep it intact so it can be re-enabled when the bug is fixed.
6. **Do not modify `shared-fixtures.ts` or `playwright.config.ts`** unless the issue is clearly in those files.

## Running Tests

```bash
cd /mnt/data/crucible/crucible-tests

# Single app
./run-tests.sh cite

# Specific test file
npx playwright test cite/tests/admin/admin-create-scoring-model.spec.ts

# Quick smoke test
./run-tests.sh quick --app cite

# All apps
./run-tests.sh all
```

Services must be running first — start via VS Code launch profile (F5) or `aspire run` from the AppHost directory.
