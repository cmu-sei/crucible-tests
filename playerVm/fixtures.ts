// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { test as base, Page } from '@playwright/test';
import { Services, authenticateWithKeycloak } from '../shared-fixtures';
import {
  THEMES,
  Theme,
  isDarkTheme,
  expectBodyTheme,
  closeMenuAndWaitForOverlay,
  themedUrl,
} from '../theme-helpers';

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

export const test = base.extend<PlayerVmFixtures>({
  playerVmAuthenticatedPage: async ({ page }, use) => {
    await authenticatePlayerVmWithKeycloak(page);
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
