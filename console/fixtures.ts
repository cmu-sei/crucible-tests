// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { test as base, expect, Locator, Page } from '@playwright/test';
import { Services, authenticateWithKeycloak } from '../shared-fixtures';
import {
  THEMES,
  Theme,
  isDarkTheme,
  expectBodyTheme,
  closeMenuAndWaitForOverlay,
  themedUrl,
} from '../theme-helpers';

export async function authenticateConsoleWithKeycloak(
  page: Page,
  username: string = 'admin',
  password: string = 'admin'
): Promise<void> {
  // The Console UI has no listing of its own; authenticate via Player (where
  // the view/VM lists live) and let the Keycloak SSO session carry over to the
  // Console UI. The Console UI uses its own OIDC client, so the first
  // navigation to it may still perform a silent redirect.
  await authenticateWithKeycloak(page, Services.Player.UI, username, password);
}

/**
 * Themes every authenticated Console spec is parameterized over. Each spec runs
 * once per entry so every screen is exercised in both light and dark mode.
 */
export const CONSOLE_THEMES = THEMES;
export type ConsoleTheme = Theme;

/** Whether the Console UI is currently rendering the dark theme. */
export async function consoleIsDarkTheme(page: Page): Promise<boolean> {
  return isDarkTheme(page);
}

/** A Console UI URL for `path` that boots straight into `theme`. */
export function consoleUrl(path: string, theme: ConsoleTheme): string {
  return themedUrl(Services.Console.UI, path, theme);
}

/**
 * Navigate to a Console UI route in the given theme.
 *
 * The Console UI does NOT persist the theme (localStorage is empty; the OIDC
 * user lives in sessionStorage), so a theme picked from the gear menu is lost on
 * the next `page.goto` or reload. The `?theme=` query param, the channel the
 * Player VM UI uses when it embeds the console in an iframe, is re-read on every
 * boot, so every Console UI navigation carries it.
 *
 * Waits for `<body>` to reflect the theme before returning.
 */
export async function gotoConsole(page: Page, path: string, theme: ConsoleTheme): Promise<void> {
  await page.goto(consoleUrl(path, theme));
  await expectBodyTheme(page, theme);
}

/**
 * Switch the Console UI between light and dark through the options bar gear
 * menu's "Dark Theme" switch, and wait for the change to land on `document.body`.
 * Requires a console page (one that renders an options bar).
 *
 * The theme lasts only until the next full page load; use {@link gotoConsole}
 * for navigation. No-ops when the requested theme is already active.
 */
export async function setConsoleTheme(page: Page, theme: ConsoleTheme): Promise<void> {
  if ((await consoleIsDarkTheme(page)) === (theme === 'dark')) return;

  await page.getByRole('button', { name: 'Console options' }).first().click();
  const toggle = page.getByRole('switch', { name: 'Dark Theme' });
  await toggle.waitFor({ state: 'visible', timeout: 10000 });
  await toggle.click();
  await closeMenuAndWaitForOverlay(page);

  await expectBodyTheme(page, theme);
}

/**
 * Open the options bar's "Console options" menu and then each submenu in `path`
 * (for example `openConsoleMenu(page, 'Power')`), and return the innermost open
 * panel. Waits for every level to be on screen, so the caller can assert on the
 * returned panel straight away. Close with {@link closeConsoleMenus}.
 */
export async function openConsoleMenu(page: Page, ...path: string[]): Promise<Locator> {
  await page.getByRole('button', { name: 'Console options' }).first().click();
  const menus = page.getByRole('menu');
  await expect(menus).toHaveCount(1);
  for (const [depth, item] of path.entries()) {
    await menus.nth(depth).getByRole('menuitem', { name: item, exact: true }).click();
    await expect(menus).toHaveCount(depth + 2);
  }
  return menus.last();
}

/**
 * Close every open options bar menu, however deeply nested, and wait for the
 * overlay to tear down so a lingering backdrop can't swallow the next click.
 *
 * Clicks the root menu's backdrop, which closes the whole tree at once. Escape
 * is no good here: it only reaches the menu that has focus, and hovering a
 * tooltip wrapper inside a submenu leaves focus elsewhere.
 */
export async function closeConsoleMenus(page: Page): Promise<void> {
  const backdrop = page.locator('.cdk-overlay-backdrop').first();
  if (await backdrop.isVisible()) {
    await backdrop.click({ position: { x: 5, y: 5 } });
  }
  await expect(page.getByRole('menu')).toHaveCount(0);
  await page.locator('.cdk-overlay-backdrop').waitFor({ state: 'detached', timeout: 5000 });
}

/**
 * Open a Proxmox VM's console in `theme` and wait until noVNC has drawn the
 * screen, which is when the options bar has the VM's Proxmox state to gate its
 * items on.
 */
export async function gotoProxmoxConsole(page: Page, vmId: string, theme: ConsoleTheme): Promise<void> {
  await gotoConsole(page, `/vm/${vmId}/console`, theme);
  await expect(page.locator('app-options-bar2')).toBeVisible({ timeout: 30000 });
  await expect(page.locator('app-proxmox-console canvas')).toBeVisible({ timeout: 60000 });
}

/**
 * Assert that an options bar control is enabled when the VM supports it, and
 * otherwise disabled with `reason` as its tooltip.
 *
 * The Proxmox bar wraps such a control in an element that carries the tooltip,
 * because a disabled button gets no pointer events and could not show one
 * itself; hovering that wrapper is how a user reads the reason.
 */
export async function expectGatedControl(
  page: Page,
  control: Locator,
  supported: boolean,
  reason: string
): Promise<void> {
  if (supported) {
    await expect(control).toBeEnabled();
    return;
  }
  await expect(control).toBeDisabled();
  await control.locator('..').hover();
  // The newest tooltip is the hovered control's: the previous control's (which
  // may carry the same text) can still be fading out.
  await expect(page.locator('.mat-mdc-tooltip').last()).toHaveText(reason);
  await expect(page.locator('.mat-mdc-tooltip').last()).toBeVisible();
}

// Console specs get their VM id from `playerVm/vm-helpers.ts` (`seedViewWithVm`),
// not from scraping the VM list for whatever machine the environment happens to
// have. Discovery made the spec skip itself when no VM turned up, which reads as
// a pass while asserting nothing about the console. A theme-parameterized spec
// seeds inside each theme's `describe`, so the light and dark runs never share
// a VM. The one exception is the Proxmox console specs (`tests/proxmox/`): a
// Proxmox machine can back only one VM API record, so they use the configured
// machine's existing record through `requireProxmoxConsoleVm`.

export type ConsoleFixtures = {
  consoleAuthenticatedPage: Page;
};

export const test = base.extend<ConsoleFixtures>({
  consoleAuthenticatedPage: async ({ page }, use) => {
    await authenticateConsoleWithKeycloak(page);
    await use(page);
  },
});

export { expect } from '@playwright/test';
export { Services };
