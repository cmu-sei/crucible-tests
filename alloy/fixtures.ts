// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { test as base, Page } from '@playwright/test';
import { authStatePath } from '../auth-paths';
import { freshAuthStatePath, savedSessionState } from '../auth-state';
import {
  authenticateWithKeycloak,
  ensureAuthenticatedShell,
  Services,
  setAuthenticatedSignal,
} from '../shared-fixtures';
import { alloyUserMenuButton } from './test-helpers';
import { poolUsers, PoolUser } from '../user-pool';
import { getUserToken } from '../keycloak-admin';
import { sharedRequestContext } from '../api-cache';

export { expect } from '@playwright/test';
export { Services };

interface AlloyFixtures {
  alloyAuthenticatedPage: Page;
}

interface AlloyWorkerFixtures {
  /** This worker's two pool users (see `user-pool.ts`): non-admins with no Alloy permissions. */
  nonAdminUsers: PoolUser[];
  /** The first of `nonAdminUsers`. */
  nonAdminUser: PoolUser;
}

/**
 * Delete a user's Alloy row (created by Alloy the first time the user's token reaches
 * it). Tolerates 404 — a worker whose tests never used the user has no row to delete.
 */
async function deleteAlloyUser(userId: string): Promise<void> {
  const token = await getUserToken('admin', 'admin', 'alloy.ui', 'openid alloy');
  const ctx = await sharedRequestContext();
  const res = await ctx.delete(`${Services.Alloy.API}/api/users/${userId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok() && res.status() !== 404) {
    console.warn(`deleteAlloyUser(${userId}) returned ${res.status()}`);
  }
}

/**
 * Extended test with Alloy-specific fixtures.
 *
 * `storageState` defaults to the pre-authenticated state captured once by
 * global-setup.ts (refreshed by `freshAuthStatePath` when its token is near expiry),
 * so every spec's browser context starts with a valid OIDC token in sessionStorage.
 * The `page` fixture replays that sessionStorage and registers the user menu as the
 * authenticated signal, so the existing `authenticateWithKeycloak` calls return as soon
 * as the shell renders — no per-test Keycloak round-trip. Auth-flow
 * specs opt out with `test.use({ storageState: { cookies: [], origins: [] } })`.
 *
 * Alloy's OIDC client (oidc-client-ts) stores its token in sessionStorage, not localStorage,
 * so the saved state alone is not enough: the `page` override below replays the session entries
 * via `addInitScript` when the state was loaded from the saved path.
 */
export const test = base.extend<AlloyFixtures, AlloyWorkerFixtures>({
  // Reset contract for Alloy: a test deletes the events/templates it seeds (with them go
  // the event memberships a pool user picked up by launching or being enlisted); the
  // user's Alloy row, which Alloy creates on first contact, is deleted here when the
  // worker ends. Leased by `parallelIndex`, the stable worker slot.
  nonAdminUsers: [
    async ({}, use, workerInfo) => {
      const users = poolUsers(workerInfo.parallelIndex, 2);
      await use(users);
      for (const user of users) await deleteAlloyUser(user.userId);
    },
    { scope: 'worker' },
  ],
  nonAdminUser: [async ({ nonAdminUsers }, use) => use(nonAdminUsers[0]), { scope: 'worker' }],

  // `undefined` when global-setup could not provision Alloy; the shell check below
  // then falls back to an interactive login.
  storageState: async ({ browser }, use) => use(await freshAuthStatePath('alloy', browser)),

  // Override the built-in `page` fixture to replay sessionStorage when the saved state is loaded.
  // Alloy's OIDC token lives in sessionStorage, and Playwright's `storageState` only restores
  // localStorage/cookies, so without this the default `page` would navigate to Alloy with cookies
  // but no token, triggering a full login despite the state being loaded.
  // It also registers the user menu as this page's authenticated signal, so the specs'
  // `authenticateWithKeycloak` calls see the signed-in shell (or the Keycloak form) as
  // soon as it renders instead of sitting out the helper's 15 s "will OIDC redirect?" window.
  page: async ({ page, storageState }, use) => {
    setAuthenticatedSignal(page, alloyUserMenuButton(page));
    if (storageState === authStatePath('alloy')) {
      const entries = savedSessionState('alloy');
      await page.addInitScript(
        (items) => {
          for (const [k, v] of items) sessionStorage.setItem(k, v);
        },
        entries
      );
    }
    await use(page);
  },

  alloyAuthenticatedPage: async ({ page, storageState }, use) => {
    await ensureAuthenticatedShell(page, {
      app: 'alloy',
      url: Services.Alloy.UI,
      shell: alloyUserMenuButton(page),
      login: (p) => authenticateWithKeycloak(p, Services.Alloy.UI),
      fromSavedState: storageState === authStatePath('alloy'),
    });

    await use(page);
  },
});
