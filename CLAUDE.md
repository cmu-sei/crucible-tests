# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository purpose

End-to-end Playwright tests for the **Crucible** platform — a suite of apps (`alloy`, `blueprint`, `caster`, `cite`, `gallery`, `gameboard`, `keycloak`, `moodle`, `player`, `steamfitter`, `topomojo`) that all sit behind Keycloak SSO. Tests drive real browsers against a locally-running Crucible stack; there are no mocks. The stack is started outside this repo (via the `crucible-development` dev container running Aspire — F5 in VS Code or `aspire run` from `Crucible.AppHost`).

## Running tests

```bash
./run-tests.sh <app>                     # all tests for one app
./run-tests.sh all                       # everything
./run-tests.sh all --app cite            # same as `./run-tests.sh cite`
./run-tests.sh quick [--app <app>]       # smoke tests (grep "login|home")
./run-tests.sh ui | headed | debug [app] # interactive modes
./run-tests.sh <app> --filter <pattern>  # --grep wrapper
./run-tests.sh <cmd> --no-check          # skip the Keycloak/app health check
./run-tests.sh report                    # open last HTML report

# Direct Playwright (when the wrapper is in the way):
npx playwright test <app>/tests/                      # app subset
npx playwright test <path/to/file.spec.ts>            # single file
npx playwright test -g "test title fragment"          # single test
npx playwright test --project=chromium                # pick a browser project
```

`run-tests.sh` pre-flight-checks Keycloak and the target app's URL; `--no-check` skips this when the stack is known-good. Reports land in `playwright-report/`; artifacts (traces, video on failure, screenshots) in `test-results/`.

## Architecture

### Test discovery

`playwright.config.ts` sets `testMatch: '**/tests/**/*.spec.ts'` — **only files under a `tests/` subdirectory are discovered**. Top-level helpers (`seed.spec.ts`, `*-helpers.ts`) are intentionally excluded. `fullyParallel: false`; local runs retry once, CI retries twice with `workers: 1`. Per-test timeout is 5 minutes (auth redirects can legitimately take that long on cold services).

### Service URLs — single source of truth

All service URLs live in `/.env` at the repo root. Both sides read it:
- Shell scripts (`run-tests.sh`, `setup.sh`) via `source`.
- Playwright config and `shared-fixtures.ts` via `dotenv`.

In TypeScript, **always** reach URLs through the `Services` object exported from `shared-fixtures.ts` (e.g. `Services.Gameboard.UI`, `Services.Keycloak`). Never hardcode `http://localhost:4XXX` in a spec — if a port moves, `.env` is the only place that should change.

### Authentication

`authenticateWithKeycloak(page, appUrl, username?, password?)` in `shared-fixtures.ts` handles the full OIDC dance: navigate → detect Keycloak redirect (sync or async via Angular OIDC client) → submit the login form → wait for redirect back (including the `/auth-callback` hop). Default creds are `admin`/`admin`. Keycloak is HTTPS with a self-signed cert — `ignoreHTTPSErrors: true` is already set globally.

Each app has a thin `{app}/fixtures.ts` that wraps this helper in an `{app}AuthenticatedPage` fixture. Import `test` and `expect` from the app's own fixtures file in specs, not directly from `@playwright/test`, so the fixture chain is picked up.

**Gameboard is the exception**: its home page is public, so the shared helper doesn't trigger a redirect. `gameboard/fixtures.ts` works around this by navigating to `/admin` to force the login flow — if you see auth logic that looks different there, that's why.

### Per-app layout

```
{app}/
├── {app}-test-plan.md       # human-readable plan; drives what specs exist
├── fixtures.ts              # extends shared fixtures with {app}AuthenticatedPage
└── tests/
    └── {feature}/           # e.g. authentication/, admin/, team/, leaderboard/
        └── {scenario}.spec.ts
```

When adding a new app: create the dir, add URLs to `.env` AND `Services` in `shared-fixtures.ts` (both — env var drives runtime, `Services` entry drives type-safe access), write `fixtures.ts`, write the test plan, then add specs.

### Shared helpers at the repo root

These live at the root (not inside any app dir) because multiple apps use them. Prefer them over reinventing per-app variants.

- **`keycloak-admin.ts`** — create/delete temporary users via the Keycloak admin API. Tests that need a non-admin account (unauthorized-access scenarios, team-invite acceptance, etc.) use `createKeycloakUser` → exercise → `deleteKeycloakUser` in teardown. `tempUsername()` generates collision-free names. `getUserToken()` gets a user-level OIDC access token for API-level assertions.
- **`topomojo-helpers.ts`** — workspace lifecycle via the TopoMojo REST API. Used from Gameboard/Alloy/Steamfitter tests that need a real workspace id. Notes on this helper: the POST-then-PUT pattern in `createWorkspace` is intentional — POST doesn't reliably persist the `audience` field. Audience must contain `gameboard` for Gameboard to see the workspace.
- **`gameboard/db-helpers.ts`** — direct Postgres access for seeding scoring data that the API doesn't expose (leaderboard rank, correct count). Reads the password from the running `crucible-postgres` container via `docker inspect`, or `CRUCIBLE_POSTGRES_PASSWORD` if set. Only used in this one app; don't reach for direct DB access unless the API genuinely can't do it.

### Seed spec + test agents

`seed.spec.ts` is a deliberately-empty template used by the `playwright-test-generator` agent (`npx playwright init-agents` sets these up in the dev container — planner, generator, healer). If you edit this file, keep it minimal; it's not a real test.

## Conventions

- Test files must be under `{app}/tests/**/*.spec.ts` or they won't be discovered.
- Import `test`/`expect` from the app's `fixtures.ts`, not from `@playwright/test`.
- Use `Services.X.UI`/`Services.X.API` for URLs — never hardcode ports.
- Tests must be independent; the config runs serially but depends on no ordering.
- Long-running waits should use the fixture-level timeouts already configured — don't override `actionTimeout`/`navigationTimeout` per call without a reason.
- When re-enabling a `test.skip(...)`, check the "Skipped tests" table in `README.md` for the upstream tracking issue — some skips are waiting on service-side fixes.
