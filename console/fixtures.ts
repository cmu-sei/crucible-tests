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

// Console specs get their VM id from `playerVm/vm-helpers.ts` (`seedViewWithVm`),
// not from scraping the VM list for whatever machine the environment happens to
// have. Discovery made the spec skip itself when no VM turned up, which reads as
// a pass while asserting nothing about the console. A theme-parameterized spec
// seeds inside each theme's `describe`, so the light and dark runs never share
// a VM.

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
