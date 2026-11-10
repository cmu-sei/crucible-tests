// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { defineConfig, devices } from '@playwright/test';
import { loadCrucibleEnv } from './load-env';

// Load environment based on CRUCIBLE_TARGET (aspire | minikube). Defaults to .env.
loadCrucibleEnv();

/**
 * Playwright configuration for Crucible applications
 * Supports testing multiple applications: Blueprint, Player, CITE, Gameboard, TopoMojo, Steamfitter, Moodle, etc.
 * See https://playwright.dev/docs/test-configuration
 */
export default defineConfig({
  testDir: './',
  testMatch: '**/tests/**/*.spec.ts',

  // Never discover specs inside nested git worktrees (`.claude/worktrees/<name>/`).
  // Those checkouts carry their own `node_modules`, so a spec found there imports a
  // second copy of @playwright/test — which throws at config load and drops
  // discovery to 0 tests for the entire suite, not just the worktree.
  // The lint fixtures in `scripts/__fixtures__/wait-antipatterns/tests/` are deliberate bad examples
  // (fixed sleeps, networkidle, test.setTimeout) used by check-wait-antipatterns.mjs and must not run as tests.
  testIgnore: ['**/.claude/**', '**/node_modules/**', '**/scripts/**'],

  // Authenticate every app in provision-targets.ts (those the run's path
  // filters include) once before the suite, concurrently, and save their browser
  // storageState to .auth/<app>.json; it also seeds the run-level records (CITE
  // evaluations, Blueprint's Caster templates, Gameboard workspaces, the Keycloak user
  // pool). Consuming apps load that state via their fixtures so per-test runs skip the
  // full Keycloak redirect. See
  // global-setup.ts. Note: no global `use.storageState` here on purpose — that would
  // leak one app's auth into every other app's tests; consumption is opted into
  // per-app in each app's fixtures.ts.
  globalSetup: require.resolve('./global-setup'),

  // After the whole suite, run each included app's purge (CITE, Steamfitter, Blueprint,
  // Player, Gallery, Gameboard, Caster) concurrently, deleting test data left behind by
  // name prefix, then delete the user pool — a safety net. This does NOT replace
  // per-test cleanup — every test must delete what it seeds (see CLAUDE.md "Test data
  // hygiene"); this only catches crashed-before-cleanup cases.
  globalTeardown: require.resolve('./global-teardown'),

  // Maximum time one test can run for. Auth is restored from saved state, so a test no
  // longer pays a cold login; the slowest passing test took ~43 s at baseline.
  timeout: 120000,

  // Test timeout for each assertion
  expect: {
    timeout: 10000,
  },

  // Run tests in files in parallel
  fullyParallel: false,

  // Fail the build on CI if you accidentally left test.only in the source code
  forbidOnly: !!process.env.CI,

  // Retry on CI only; local retries are off so sleep-removal flakiness shows up immediately
  retries: process.env.CI ? 2 : 0,

  // CI runs with 2 workers; local default is 4 (the baseline achieved 1.96× on 2 workers,
  // so the stack is not the bottleneck). Override with --workers.
  workers: process.env.CI ? 2 : 4,

  // Reporter to use
  reporter: [
    ['html'],
    ['json', { outputFile: 'test-results/results.json' }],
    // Owns the terminal output for the test phase: prints per-test lines and a
    // bottom-pinned "% complete" bar to /dev/tty, and a clean plain-text copy to
    // CRUCIBLE_LOG_FILE (set by run-tests.sh). Replaces the built-in 'list'
    // reporter — do not enable both, they would double every line. Falls back to
    // plain stdout lines when there is no controlling terminal (CI, redirected).
    ['./progress-reporter.ts'],
  ],

  // Shared settings for all the projects below
  use: {
    // Base URL read from .env (defaults to Blueprint UI)
    baseURL: process.env.BLUEPRINT_UI_URL || 'http://localhost:4725',

    // Collect trace when retrying the failed test
    trace: 'on-first-retry',

    // Screenshot on failure
    screenshot: 'only-on-failure',

    // Video on failure
    video: 'retain-on-failure',

    // Ignore HTTPS errors (for self-signed Keycloak certificate)
    ignoreHTTPSErrors: true,

    // Browser context options
    viewport: { width: 1920, height: 1080 },

    // Action timeout
    actionTimeout: 10000,

    // Navigation timeout
    navigationTimeout: 30000,
  },

  // Configure projects for major browsers (env-driven via CRUCIBLE_BROWSERS)
  projects: (() => {
    const BROWSERS = (process.env.CRUCIBLE_BROWSERS ?? 'chromium').split(',').map(s => s.trim());
    const ALL_PROJECTS = [
      { name: 'chromium', use: { ...devices['Desktop Chrome'], acceptDownloads: true } },
      { name: 'firefox', use: { ...devices['Desktop Firefox'], acceptDownloads: true } },
    ];
    const validNames = ALL_PROJECTS.map(p => p.name);
    for (const name of BROWSERS) {
      if (!validNames.includes(name)) {
        throw new Error(
          `CRUCIBLE_BROWSERS="${process.env.CRUCIBLE_BROWSERS}" names an unknown project "${name}". ` +
          `Valid projects: ${validNames.join(', ')}`
        );
      }
    }
    return ALL_PROJECTS.filter(p => BROWSERS.includes(p.name));
  })(),

  // Run your local dev server before starting the tests
  // webServer: {
  //   command: 'npm run start',
  //   url: 'http://localhost:4725',
  //   reuseExistingServer: !process.env.CI,
  //   timeout: 120000,
  // },
});
