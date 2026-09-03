// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { FullConfig } from '@playwright/test';
import { loadCrucibleEnv } from './load-env';
import { pathFiltersIncludeApp } from './playwright-run-filters';
import { purgeAllCiteTestData } from './cite/fixtures';
import { purgeAllSteamfitterTestData } from './steamfitter/fixtures';
import { purgeAllBlueprintTestData } from './blueprint/test-helpers';

// Load environment based on CRUCIBLE_TARGET (aspire | minikube) before reading Services.
loadCrucibleEnv();

/**
 * Runs once after the entire suite (see `globalTeardown` in playwright.config.ts).
 *
 * This is a safety net that deletes any test data left behind by name prefix, so
 * the database never accumulates leftovers across runs. It is NOT a license to skip
 * per-test cleanup — every test must still delete what it seeds (see CLAUDE.md "Test
 * data hygiene"). This backstop only catches the case where a test crashed before its
 * own afterEach/afterAll could run.
 *
 * Each app's purge runs only when the current path filters include that app, so a
 * filtered single-app run doesn't touch (or require a running API for) other apps.
 *
 * Failure policy: best-effort. A teardown error must never fail an otherwise-green run,
 * so everything is wrapped and only logged.
 */
async function globalTeardown(_config: FullConfig): Promise<void> {
  // NOTE: these must be static top-level imports (see above), not `await import(...)`.
  // Playwright's TS transform is applied to this module's static import graph, but a
  // runtime dynamic import() of a sibling .ts is loaded by bare Node and fails with
  // "Cannot use import statement outside a module" — which the catch below would then
  // silently swallow, skipping the purge entirely. The fixtures modules have no
  // network side effects at import time, so importing them eagerly is safe.
  if (pathFiltersIncludeApp('cite')) {
    try {
      await purgeAllCiteTestData();
    } catch (error) {
      console.warn(`[global-teardown] CITE test-data purge skipped: ${error}`);
    }
  }

  if (pathFiltersIncludeApp('steamfitter')) {
    try {
      await purgeAllSteamfitterTestData();
    } catch (error) {
      console.warn(`[global-teardown] Steamfitter test-data purge skipped: ${error}`);
    }
  }

  if (pathFiltersIncludeApp('blueprint')) {
    try {
      await purgeAllBlueprintTestData();
    } catch (error) {
      console.warn(`[global-teardown] Blueprint test-data purge skipped: ${error}`);
    }
  }
}

export default globalTeardown;
