// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { test as base, Page } from '@playwright/test';
import { authStatePath } from '../auth-paths';
import { freshAuthStatePath, savedSessionState } from '../auth-state';
import {
  Services,
  authenticateWithKeycloak,
  ensureAuthenticatedShell,
  setAuthenticatedSignal,
} from '../shared-fixtures';
import {
  THEMES,
  Theme,
  isDarkTheme,
  expectBodyTheme,
  closeMenuAndWaitForOverlay,
  themedUrl,
} from '../theme-helpers';
import { poolUsers, PoolUser } from '../user-pool';
import { deletePlayerUser, getPlayerToken, provisionPlayerUser, PlayerUser } from '../player-helpers';

export async function authenticatePlayerVmWithKeycloak(
  page: Page,
  username: string = 'admin',
  password: string = 'admin'
): Promise<void> {
  // Authenticate against Player UI, not the VM UI: the VM UI has no route that
  // works without a view id (its root renders "View Not Found"), so there is
  // nothing there to land on. The Keycloak SSO session carries over to the
  // Player VM UI on the next navigation, which is what lets a spec go straight
  // to `/views/{seededViewId}/...`.
  await authenticateWithKeycloak(page, Services.Player.UI, username, password);
}

// There is deliberately no "find me a view/VM in this environment" helper here.
// Discovery made every VM-facing spec conditional — no views meant a self-skip
// that reported green — and it made assertions depend on what the discovered
// record happened to contain. Specs seed what they need instead: see
// `vm-helpers.ts` (`seedView`, `seedViewWithVm`). A theme-parameterized spec
// seeds inside each theme's `describe`, so the light and dark runs never share
// a record.

export type PlayerVmFixtures = {
  playerVmAuthenticatedPage: Page;
};

/** A pool user (see `user-pool.ts`) with its Player row provisioned. */
export type PlayerVmPoolUser = PoolUser & { player: PlayerUser };

export type PlayerVmWorkerFixtures = {
  /** This worker's two pool users: non-admins, registered with Player, on no team. */
  nonAdminUsers: PlayerVmPoolUser[];
  /** The first of `nonAdminUsers`. */
  nonAdminUser: PlayerVmPoolUser;
};

/**
 * Extended test with Player VM-specific fixtures.
 *
 * `storageState` defaults to Player's pre-authenticated state captured once by
 * global-setup.ts (refreshed when its token is near expiry), so every spec's
 * browser context starts with a valid Player OIDC token in sessionStorage.
 * The `page` fixture replays that sessionStorage and registers the Player Menu
 * button as the authenticated signal, so the existing `authenticatePlayerVmWithKeycloak`
 * calls return as soon as the Player shell renders — no per-test Keycloak round-trip.
 * Auth-flow specs opt out with `test.use({ storageState: { cookies: [], origins: [] } })`.
 *
 * Player's OIDC client (oidc-client-ts) stores its token in sessionStorage, not localStorage,
 * so the saved state alone is not enough: the `page` override below replays the session entries
 * via `addInitScript` when the state was loaded from the saved path.
 */
export const test = base.extend<PlayerVmFixtures, PlayerVmWorkerFixtures>({
  // Reset contract for Player: a test removes the pool user from every team it put them
  // on — in practice by deleting the view it seeded, which takes the view's teams and
  // their memberships with it. The Player row (Player has no "create user" call: the row
  // appears when the user's token is first presented) is provisioned here and deleted when
  // the worker ends. Leased by `parallelIndex`, the stable worker slot.
  nonAdminUsers: [
    async ({}, use, workerInfo) => {
      const leased: PlayerVmPoolUser[] = [];
      for (const user of poolUsers(workerInfo.parallelIndex, 2)) {
        const token = await getPlayerToken(user.username, user.password);
        leased.push({ ...user, player: await provisionPlayerUser(token, user.userId) });
      }
      await use(leased);
      const adminToken = await getPlayerToken();
      for (const user of leased) await deletePlayerUser(adminToken, user.userId);
    },
    { scope: 'worker' },
  ],
  nonAdminUser: [async ({ nonAdminUsers }, use) => use(nonAdminUsers[0]), { scope: 'worker' }],

  // `undefined` when global-setup could not provision Player; the shell check below
  // then falls back to an interactive login.
  storageState: async ({ browser }, use) => use(await freshAuthStatePath('player', browser)),

  // Override the built-in `page` fixture to replay sessionStorage when the saved state is loaded.
  // Player's OIDC token lives in sessionStorage, and Playwright's `storageState` only restores
  // localStorage/cookies, so without this the default `page` would navigate to Player with cookies
  // but no token, triggering a full login despite the state being loaded.
  // It also registers the Player Menu button as this page's authenticated signal, so the specs'
  // `authenticatePlayerVmWithKeycloak` calls see the signed-in shell (or the Keycloak form) as
  // soon as it renders instead of sitting out the helper's 15 s "will OIDC redirect?" window.
  page: async ({ page, storageState }, use) => {
    setAuthenticatedSignal(page, page.getByRole('button', { name: 'Menu', exact: true }));
    if (storageState === authStatePath('player')) {
      const entries = savedSessionState('player');
      await page.addInitScript(
        (items) => {
          for (const [k, v] of items) sessionStorage.setItem(k, v);
        },
        entries
      );
    }
    await use(page);
  },

  playerVmAuthenticatedPage: async ({ page, storageState }, use) => {
    await ensureAuthenticatedShell(page, {
      app: 'player',
      url: Services.Player.UI,
      shell: page.getByRole('button', { name: 'Menu', exact: true }),
      login: authenticatePlayerVmWithKeycloak,
      restoreSession: storageState === authStatePath('player'),
      fromSavedState: storageState === authStatePath('player'),
    });

    await use(page);
  },
});

/**
 * Themes every authenticated Player VM functional spec is parameterized over. Each
 * spec runs once per entry so every screen is exercised in both light and dark mode.
 */
export const PLAYERVM_THEMES = THEMES;
export type PlayerVmTheme = Theme;

/** Whether the Player VM UI is currently rendering the dark theme. */
export async function playerVmIsDarkTheme(page: Page): Promise<boolean> {
  return isDarkTheme(page);
}

/**
 * Switch the Player VM UI between light and dark theme through the top bar user
 * menu's "Dark Theme" switch, and wait for the change to land on `document.body`.
 *
 * Unlike Player, the VM UI does NOT persist the theme: its localStorage entry
 * (`akita-vm-ui`) holds only `vmUISession`, so a theme set here lasts only until
 * the next full page load (`page.goto` / reload). For navigation, prefer
 * {@link gotoPlayerVm}, which carries the theme in the URL. This helper is for
 * switching the theme on the page that is already loaded.
 *
 * No-ops when the requested theme is already active, so callers can use it to
 * restore state unconditionally.
 */
export async function setPlayerVmTheme(page: Page, theme: PlayerVmTheme): Promise<void> {
  if ((await playerVmIsDarkTheme(page)) === (theme === 'dark')) return;

  await page.getByRole('button', { name: 'Menu', exact: true }).click();
  const toggle = page.locator('mat-slide-toggle button[role=switch]');
  await toggle.waitFor({ state: 'visible', timeout: 10000 });
  await toggle.click();
  await closeMenuAndWaitForOverlay(page);

  await expectBodyTheme(page, theme);
}

/** A Player VM UI URL for `path` that boots straight into `theme`. */
export function playerVmUrl(path: string, theme: PlayerVmTheme): string {
  return themedUrl(Services.PlayerVM.UI, path, theme);
}

/**
 * Navigate to a Player VM UI route in the given theme.
 *
 * The theme travels in the `?theme=` query param, the same channel Player uses
 * when it embeds the VM UI in an iframe. This is the robust option here because
 * the VM UI keeps the theme only in memory: switching via the menu would be lost
 * on every `page.goto` or reload, whereas the param is re-read on every boot (and
 * survives a reload, since it stays on the URL). The VM UI does write `?theme=`
 * back onto the URL when the theme later changes. A spec that asserts on the URL
 * has to expect the param (see `vm-main/open-vm-tab.spec.ts`).
 *
 * Waits for `<body>` to reflect the theme before returning.
 */
export async function gotoPlayerVm(page: Page, path: string, theme: PlayerVmTheme): Promise<void> {
  await page.goto(playerVmUrl(path, theme));
  await expectBodyTheme(page, theme);
}

export { expect } from '@playwright/test';
export { Services };
