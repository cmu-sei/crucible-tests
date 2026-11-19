// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { FullConfig } from '@playwright/test';
import { loadCrucibleEnv } from './load-env';
import { pathFiltersIncludeApp } from './playwright-run-filters';
import { purgeAllCiteTestData } from './cite/fixtures';
import { purgeAllSteamfitterTestData } from './steamfitter/fixtures';
import { purgeAllBlueprintTestData } from './blueprint/test-helpers';
import { deleteBlueprintSeed } from './blueprint/caster-helpers';
import { purgeAllPlayerTestData } from './player/fixtures';
import { purgeAllGalleryTestData } from './gallery/fixtures';
import { purgeAllGameboardTestData } from './gameboard/fixtures';
import { purgeAllCasterTestData } from './caster/fixtures';
import { isFresh, refreshAppAuthState, savedAccessToken } from './auth-state';
import { deleteUserPool, POOL_CONSUMER_APPS } from './user-pool';

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
  const teardownStart = Date.now();
  // NOTE: these must be static top-level imports (see above), not `await import(...)`.
  // Playwright's TS transform is applied to this module's static import graph, but a
  // runtime dynamic import() of a sibling .ts is loaded by bare Node and fails with
  // "Cannot use import statement outside a module" — which the catch below would then
  // silently swallow, skipping the purge entirely. The fixtures modules have no
  // network side effects at import time, so importing them eagerly is safe.

  // Run all app purges concurrently. Each is wrapped in its own try/catch so one
  // failure doesn't block others.
  const purgeTasks: Promise<void>[] = [];

  if (pathFiltersIncludeApp('cite')) {
    purgeTasks.push(
      (async () => {
        const start = Date.now();
        try {
          await purgeAllCiteTestData();
          console.log(`[global-teardown] CITE purge complete (${Date.now() - start} ms)`);
        } catch (error) {
          console.warn(`[global-teardown] CITE test-data purge skipped: ${error}`);
        }
      })()
    );
  }

  if (pathFiltersIncludeApp('steamfitter')) {
    purgeTasks.push(
      (async () => {
        const start = Date.now();
        try {
          await purgeAllSteamfitterTestData();
          console.log(`[global-teardown] Steamfitter purge complete (${Date.now() - start} ms)`);
        } catch (error) {
          console.warn(`[global-teardown] Steamfitter test-data purge skipped: ${error}`);
        }
      })()
    );
  }

  if (pathFiltersIncludeApp('blueprint')) {
    purgeTasks.push(
      (async () => {
        const start = Date.now();
        try {
          // The Blueprint purge (and its Caster cleanup) authenticate with tokens
          // lifted from the saved state, which may have expired during a long run.
          // Each refresh is independent: a failed Blueprint refresh must not leave the
          // Caster token (also used by deleteBlueprintSeed below) stale.
          for (const app of ['blueprint', 'caster']) {
            const saved = savedAccessToken(app);
            if (saved && !isFresh(saved.exp)) {
              await refreshAppAuthState(app).catch(error =>
                console.warn(`[global-teardown] ${app} auth refresh failed: ${error}`),
              );
            }
          }
          await purgeAllBlueprintTestData();
          console.log(`[global-teardown] Blueprint purge complete (${Date.now() - start} ms)`);
        } catch (error) {
          console.warn(`[global-teardown] Blueprint test-data purge skipped: ${error}`);
        }
        // Independent of the purge: the run-level Caster templates global-setup seeded,
        // and their seed file, are removed even when the purge failed.
        try {
          await deleteBlueprintSeed();
        } catch (error) {
          console.warn(`[global-teardown] Blueprint Caster template cleanup skipped: ${error}`);
        }
      })()
    );
  }

  if (pathFiltersIncludeApp('player')) {
    purgeTasks.push(
      (async () => {
        const start = Date.now();
        try {
          await purgeAllPlayerTestData();
          console.log(`[global-teardown] Player purge complete (${Date.now() - start} ms)`);
        } catch (error) {
          console.warn(`[global-teardown] Player test-data purge skipped: ${error}`);
        }
      })()
    );
  }

  if (pathFiltersIncludeApp('gallery')) {
    purgeTasks.push(
      (async () => {
        const start = Date.now();
        try {
          await purgeAllGalleryTestData();
          console.log(`[global-teardown] Gallery purge complete (${Date.now() - start} ms)`);
        } catch (error) {
          console.warn(`[global-teardown] Gallery test-data purge skipped: ${error}`);
        }
      })()
    );
  }

  if (pathFiltersIncludeApp('caster')) {
    purgeTasks.push(
      (async () => {
        const start = Date.now();
        try {
          // Only `E2E Shared Project [` — never Blueprint's run-level
          // `E2E Shared Blueprint Caster Templates` project (deleted by its own seed teardown).
          await purgeAllCasterTestData();
          console.log(`[global-teardown] Caster purge complete (${Date.now() - start} ms)`);
        } catch (error) {
          console.warn(`[global-teardown] Caster test-data purge skipped: ${error}`);
        }
      })()
    );
  }

  if (pathFiltersIncludeApp('gameboard')) {
    purgeTasks.push(
      (async () => {
        const start = Date.now();
        try {
          // The run-level workspaces from `.auth/gameboard-seed.json` (and the file), plus
          // any per-worker shared game or sponsor a crashed worker left behind.
          await purgeAllGameboardTestData();
          console.log(`[global-teardown] Gameboard purge complete (${Date.now() - start} ms)`);
        } catch (error) {
          console.warn(`[global-teardown] Gameboard test-data purge skipped: ${error}`);
        }
      })()
    );
  }

  // Wait for all purges to complete.
  await Promise.allSettled(purgeTasks);

  // Last: the app purges above may still need a pool user's token. Each app fixture's
  // worker teardown has already deleted the pool users' app-side rows.
  if (POOL_CONSUMER_APPS.some(app => pathFiltersIncludeApp(app))) {
    const start = Date.now();
    try {
      await deleteUserPool();
      console.log(`[global-teardown] User pool deletion complete (${Date.now() - start} ms)`);
    } catch (error) {
      console.warn(`[global-teardown] User pool deletion skipped: ${error}`);
    }
  }

  console.log(`[global-teardown] Total teardown time: ${Date.now() - teardownStart} ms`);
}

export default globalTeardown;
