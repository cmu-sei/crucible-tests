// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { chromium, FullConfig } from '@playwright/test';
import fs from 'fs';
import path from 'path';
import { loadCrucibleEnv } from './load-env';
import { authSessionStatePath, authStatePath } from './auth-paths';
import { pathFiltersIncludeApp } from './playwright-run-filters';
import { isFresh, refreshAppAuthState, savedAccessToken } from './auth-state';
import { provisionTargets } from './provision-targets';
import { writeCiteSeed } from './cite/fixtures';
import { gameboardSeedPath, writeGameboardSeed } from './gameboard/fixtures';
import { ensureCasterTemplate } from './blueprint/caster-helpers';
import { createUserPool, POOL_CONSUMER_APPS, POOL_SIZE, userPoolPath } from './user-pool';

// Provisioning skips any app whose saved `.auth/<app>.json` token still has more than
// 5 minutes left, so back-to-back targeted runs do not log in again. Set
// CRUCIBLE_SKIP_AUTH_PROVISION=1 to provision nothing at all — the supported switch
// for expiry drills (fake-expire a saved state, then let auth-state.ts refresh it).

// Load environment based on CRUCIBLE_TARGET (aspire | minikube) before reading Services.
loadCrucibleEnv();


/**
 * Authenticate each provisioned app once and persist its browser state to
 * `.auth/<app>.json`. Runs before the test suite via `globalSetup` in the config.
 *
 * Failure policy: if an app cannot be provisioned (stack down, auth changed), we
 * remove any stale state file and continue rather than aborting the whole run. The
 * per-app fixture falls back to a full interactive login when the state file is
 * missing or expired, so the suite still works — just without the speed-up.
 */
async function globalSetup(config: FullConfig): Promise<void> {
  const totalStart = Date.now();
  // Ensure the .auth directory exists (gitignored; regenerated each run).
  const authDir = path.resolve(__dirname, '.auth');
  fs.mkdirSync(authDir, { recursive: true });

  await provisionAuthStates();

  // The run-level seeds run concurrently with each other, after auth provisioning (the
  // Blueprint Caster templates read Caster's saved state; the others use password or
  // admin grants). Each is best-effort and logs its own failure.
  const seedTasks: Promise<void>[] = [];

  // The run's non-admin Keycloak users (see user-pool.ts), two per worker slot. Only
  // when the run can include an app whose specs lease them.
  if (POOL_CONSUMER_APPS.some(app => pathFiltersIncludeApp(app))) {
    seedTasks.push(
      (async () => {
        const start = Date.now();
        try {
          const users = await createUserPool(Math.max(POOL_SIZE, 2 * config.workers));
          console.log(`[global-setup] Ensured ${users.length} pool users in ${userPoolPath()} (${Date.now() - start} ms)`);
        } catch (error) {
          console.warn(`[global-setup] User pool creation failed; specs that lease pool users will fail. Error: ${error}`);
        }
      })()
    );
  }

  // CITE's run-level read-only records (shared evaluations, scoring model, team type),
  // ensured by fixed name and written to `.auth/cite-seed.json`. Independent of auth
  // provisioning: it uses an API password grant, not a saved browser state.
  if (pathFiltersIncludeApp('cite')) {
    seedTasks.push(
      (async () => {
        const start = Date.now();
        try {
          await writeCiteSeed();
          console.log(`[global-setup] Wrote CITE run-level seed to .auth/cite-seed.json (${Date.now() - start} ms)`);
        } catch (error) {
          console.warn(`[global-setup] CITE run-level seed failed; workers will ensure it themselves. Error: ${error}`);
        }
      })()
    );
  }

  // Gameboard's run-level TopoMojo workspaces (one visible to Gameboard, one with no
  // audience), written to `.auth/gameboard-seed.json`. writeGameboardSeed removes any
  // stale file first, so a failure leaves none and each worker creates its own pair.
  if (pathFiltersIncludeApp('gameboard')) {
    seedTasks.push(
      (async () => {
        const start = Date.now();
        try {
          await writeGameboardSeed();
          console.log(`[global-setup] Wrote Gameboard run-level seed to ${gameboardSeedPath()} (${Date.now() - start} ms)`);
        } catch (error) {
          fs.rmSync(gameboardSeedPath(), { force: true });
          console.warn(`[global-setup] Gameboard run-level seed failed; workers will create their own workspaces. Error: ${error}`);
        }
      })()
    );
  }

  // Blueprint's run-level Caster templates (read-only for the caster-integration specs),
  // written to `.auth/blueprint-seed.json`. Uses the Caster auth state provisioned above
  // (Caster is `neededBy` Blueprint in provision-targets.ts).
  if (pathFiltersIncludeApp('blueprint')) {
    seedTasks.push(
      (async () => {
        const start = Date.now();
        try {
          await ensureCasterTemplate();
          console.log(`[global-setup] Wrote Blueprint run-level seed to .auth/blueprint-seed.json (${Date.now() - start} ms)`);
        } catch (error) {
          console.warn(`[global-setup] Blueprint Caster template seed failed; consumers will seed their own. Error: ${error}`);
        }
      })()
    );
  }

  await Promise.all(seedTasks);
  console.log(`[global-setup] Total setup time: ${Date.now() - totalStart} ms`);
}

async function provisionAuthStates(): Promise<void> {
  if (process.env.CRUCIBLE_SKIP_AUTH_PROVISION === '1') {
    console.log('[global-setup] Skipping auth provisioning (CRUCIBLE_SKIP_AUTH_PROVISION)');
    return;
  }

  const setupStart = Date.now();
  const selected = provisionTargets().filter(
    target => [target.app, ...(target.neededBy ?? [])].some(app => pathFiltersIncludeApp(app))
  );

  // Launch one browser shared by all provisioning calls.
  const browser = await chromium.launch();
  try {
    // Provision all selected apps concurrently. Each creates its own context.
    const results = await Promise.allSettled(
      selected.map(async target => {
        const appStart = Date.now();
        const statePath = authStatePath(target.app);
        const haveBothFiles = fs.existsSync(statePath) && fs.existsSync(authSessionStatePath(target.app));
        if (haveBothFiles && isFresh(savedAccessToken(target.app)?.exp)) {
          console.log(`[global-setup] Reusing fresh auth state for ${target.app}`);
          return { app: target.app, elapsed: Date.now() - appStart };
        }
        try {
          // refreshAppAuthState logs in (target.authenticate or authenticateWithKeycloak),
          // waits for appShellSelector so the token is persisted, and writes both state
          // files — the same single writer the fixtures use for mid-run refreshes.
          console.log(`[global-setup] Authenticating ${target.app} at ${target.homeUrl}...`);
          await refreshAppAuthState(target.app, browser, { reason: 'setup' });
          console.log(`[global-setup] Saved ${target.app} auth state to ${statePath} (${Date.now() - appStart} ms)`);
          return { app: target.app, elapsed: Date.now() - appStart };
        } catch (error) {
          // Remove any stale/partial state so the fixture's fresh-login fallback kicks
          // in rather than loading a broken state file.
          fs.rmSync(statePath, { force: true });
          fs.rmSync(authSessionStatePath(target.app), { force: true });
          console.warn(
            `[global-setup] Failed to provision auth for ${target.app}; tests will fall back to interactive login. Error: ${error}`,
          );
          throw error;
        }
      })
    );

    const succeeded = results.filter(r => r.status === 'fulfilled').map(r => (r as PromiseFulfilledResult<any>).value.app);
    const failed = results.filter(r => r.status === 'rejected').length;
    console.log(`[global-setup] Auth provisioning complete: ${succeeded.length} succeeded, ${failed} failed (${Date.now() - setupStart} ms)`);
  } finally {
    await browser.close();
  }
}

export default globalSetup;
