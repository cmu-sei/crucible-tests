// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { FullConfig } from '@playwright/test';
import { loadCrucibleEnv } from './load-env';
import { pathFiltersIncludeApp } from './playwright-run-filters';

// Load environment based on CRUCIBLE_TARGET (aspire | minikube) before reading Services.
loadCrucibleEnv();

/**
 * Runs once after the entire suite (see `globalTeardown` in playwright.config.ts).
 *
 * This is a safety net that deletes any CITE test data left behind by name prefix, so
 * the database never accumulates leftovers across runs. It is NOT a license to skip
 * per-test cleanup — every test must still delete what it seeds (see CLAUDE.md "Test
 * data hygiene"). This backstop only catches the case where a test crashed before its
 * own afterEach/afterAll could run.
 *
 * Failure policy: best-effort. A teardown error must never fail an otherwise-green run,
 * so everything is wrapped and only logged.
 */
async function globalTeardown(_config: FullConfig): Promise<void> {
  if (!pathFiltersIncludeApp('cite')) {
    console.log('[global-teardown] Skipping CITE test-data purge for non-CITE path-filtered run.');
    return;
  }

  try {
    // Imported lazily so a failure loading the CITE fixtures (e.g. stack down) can't
    // break module resolution for the whole config.
    const { purgeAllCiteTestData } = await import('./cite/fixtures');
    await purgeAllCiteTestData();
  } catch (error) {
    console.warn(`[global-teardown] CITE test-data purge skipped: ${error}`);
  }
}

export default globalTeardown;
