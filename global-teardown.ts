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
  // CITE teardown
  if (pathFiltersIncludeApp('cite')) {
    try {
      const { purgeAllCiteTestData } = await import('./cite/fixtures');
      await purgeAllCiteTestData();
    } catch (error) {
      console.warn(`[global-teardown] CITE test-data purge skipped: ${error}`);
    }
  }

  // Blueprint teardown
  if (pathFiltersIncludeApp('blueprint')) {
    await purgeBlueprint();
  }
}

/**
 * Purge leftover Blueprint test data, best-effort.
 *
 * Importing `blueprint/test-helpers` from inside globalTeardown is unreliable, in two
 * different ways depending on which specs the run selected:
 *   - Playwright's loader sometimes hands the module back CJS-wrapped, so the namespace
 *     holds only `{ default, 'module.exports' }` and a named destructure is `undefined`.
 *   - Sometimes the transform isn't applied at all and the ESM `import` inside the helper
 *     throws `SyntaxError: Cannot use import statement outside a module`.
 *
 * Either way the purge silently stopped running, which is exactly the failure a safety net
 * must not have. So: try the in-process import first (fast path, keeps logs inline), and if
 * that throws for any reason, re-run the purge in a `tsx` subprocess, which compiles the
 * helper properly. Both paths are wrapped — a teardown failure must never fail a green run.
 */
async function purgeBlueprint(): Promise<void> {
  try {
    const mod: any = await import('./blueprint/test-helpers');
    const purge = mod.purgeAllBlueprintTestData ?? mod.default?.purgeAllBlueprintTestData;
    if (typeof purge !== 'function') {
      throw new Error('purgeAllBlueprintTestData not found on blueprint/test-helpers');
    }
    await purge();
    return;
  } catch (error) {
    console.warn(
      `[global-teardown] Blueprint purge via import failed (${error}); retrying in a subprocess.`
    );
  }

  try {
    const { execFileSync } = await import('node:child_process');
    execFileSync(
      'npx',
      [
        'tsx',
        '-e',
        "import { purgeAllBlueprintTestData } from './blueprint/test-helpers'; purgeAllBlueprintTestData();",
      ],
      { cwd: __dirname, stdio: 'inherit', timeout: 120_000 }
    );
  } catch (error) {
    console.warn(`[global-teardown] Blueprint test-data purge skipped: ${error}`);
  }
}

export default globalTeardown;
