// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { chromium, FullConfig } from '@playwright/test';
import fs from 'fs';
import path from 'path';
import { loadCrucibleEnv } from './load-env';
import { Services, authenticateWithKeycloak } from './shared-fixtures';
import { authStatePath } from './auth-paths';

// Load environment based on CRUCIBLE_TARGET (aspire | minikube) before reading Services.
loadCrucibleEnv();

/**
 * One app to provision authenticated browser state for. `appShellSelector` is a
 * DOM signal that only renders once the Angular app has bootstrapped AND the OIDC
 * client has resolved a user — i.e. "authenticated and ready", not merely "page
 * exists". Waiting on it (rather than a fixed delay) means setup is as fast as the
 * app allows and never saves state before the token is in place.
 */
interface ProvisionTarget {
  app: string;
  homeUrl: string;
  appShellSelector: string;
}

/**
 * Apps to pre-authenticate. Each entry gets its token captured once here and
 * reused by every test in that app's suite via `storageState`.
 *
 * EXTENSION POINT: other apps (player, gameboard, topomojo, ...) should adopt this
 * by (a) adding an entry here and (b) pointing their own `fixtures.ts` at
 * `authStatePath('<app>')`, mirroring how cite/fixtures.ts consumes it. Only cite
 * is wired up for now.
 */
const PROVISION: ProvisionTarget[] = [
  {
    app: 'cite',
    homeUrl: Services.Cite.UI,
    // mat-toolbar renders only after the OIDC client resolves a user, so it is a
    // reliable "authenticated shell is up" marker for CITE.
    appShellSelector: 'app-root mat-toolbar',
  },
];

/**
 * Authenticate each provisioned app once and persist its browser state to
 * `.auth/<app>.json`. Runs before the test suite via `globalSetup` in the config.
 *
 * Failure policy: if an app cannot be provisioned (stack down, auth changed), we
 * remove any stale state file and continue rather than aborting the whole run. The
 * per-app fixture falls back to a full interactive login when the state file is
 * missing or expired, so the suite still works — just without the speed-up.
 */
async function globalSetup(_config: FullConfig): Promise<void> {
  // Ensure the .auth directory exists (gitignored; regenerated each run).
  const authDir = path.resolve(__dirname, '.auth');
  fs.mkdirSync(authDir, { recursive: true });

  for (const target of PROVISION) {
    const statePath = authStatePath(target.app);
    const browser = await chromium.launch();
    try {
      const context = await browser.newContext({ ignoreHTTPSErrors: true });
      const page = await context.newPage();

      console.log(`[global-setup] Authenticating ${target.app} at ${target.homeUrl}...`);
      await authenticateWithKeycloak(page, target.homeUrl);

      // Wait for the authenticated app shell so the OIDC token is fully persisted
      // to localStorage before we snapshot the state.
      await page.locator(target.appShellSelector).first().waitFor({
        state: 'visible',
        timeout: 60000,
      });

      await context.storageState({ path: statePath });
      console.log(`[global-setup] Saved ${target.app} auth state to ${statePath}`);

      await context.close();
    } catch (error) {
      // Remove any stale/partial state so the fixture's fresh-login fallback kicks
      // in rather than loading a broken state file.
      fs.rmSync(statePath, { force: true });
      console.warn(
        `[global-setup] Failed to provision auth for ${target.app}; tests will fall back to interactive login. Error: ${error}`,
      );
    } finally {
      await browser.close();
    }
  }
}

export default globalSetup;
