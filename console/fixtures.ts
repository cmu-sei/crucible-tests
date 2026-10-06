// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { test as base, expect, Page, APIRequestContext, request as pwRequest } from '@playwright/test';
import { Services, authenticateWithKeycloak } from '../shared-fixtures';
import {
  THEMES,
  Theme,
  isDarkTheme,
  expectBodyTheme,
  closeMenuAndWaitForOverlay,
  themedUrl,
  seededName,
  oidcAccessToken as accessToken,
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

/** A VM record (plus the Player view and team it belongs to) seeded for one test. */
export interface SeededConsoleVm {
  id: string;
  name: string;
  viewId: string;
  teamId: string;
}

export type ConsoleFixtures = {
  consoleAuthenticatedPage: Page;
  /**
   * A VM record seeded for the duration of one test: a Player view (with its
   * Admin team) through the Player API, then a VM API record with only `name`
   * and `teamIds`. It has no hypervisor behind it, so `/vm/{id}/console`
   * renders the options bar and stays "connecting". Names are unique per
   * project, theme variant, worker and retry. Everything is deleted afterwards.
   */
  consoleVm: SeededConsoleVm;
};

async function okJson<T>(res: Awaited<ReturnType<APIRequestContext['get']>>, what: string): Promise<T> {
  if (!res.ok()) throw new Error(`${what} failed: ${res.status()} ${await res.text()}`);
  return (await res.json()) as T;
}

export const test = base.extend<ConsoleFixtures>({
  consoleAuthenticatedPage: async ({ page }, use) => {
    await authenticateConsoleWithKeycloak(page);
    await use(page);
  },

  consoleVm: async ({ consoleAuthenticatedPage: page }, use, testInfo) => {
    const api = await pwRequest.newContext({ ignoreHTTPSErrors: true });
    const name = seededName('E2E Console', testInfo);
    // The Player API takes the Player UI token (the page is on Player after auth).
    const playerHeaders = { Authorization: `Bearer ${await accessToken(page)}`, 'Content-Type': 'application/json' };
    let viewId: string | undefined;
    let vmId: string | undefined;
    let vmHeaders: Record<string, string> | undefined;
    try {
      const view = await okJson<{ id: string }>(
        await api.post(`${Services.Player.API}/api/views`, {
          headers: playerHeaders,
          data: { name, description: `E2E fixture data for ${name}`, status: 'Active', isTemplate: false, createAdminTeam: true },
        }),
        `Create Player view "${name}"`
      );
      viewId = view.id;
      const teams = await okJson<Array<{ id: string }>>(
        await api.get(`${Services.Player.API}/api/views/${view.id}/teams`, { headers: playerHeaders }),
        'List view teams'
      );
      if (teams.length === 0) throw new Error(`Seeded view ${view.id} has no team`);
      const teamId = teams[0].id;

      // The VM API rejects the Player UI token; use the Console UI's own token,
      // which only exists in the Console UI origin's storage. Load a harmless
      // console route (an unknown VM id) to complete its silent sign-in.
      await page.goto(consoleUrl('/vm/00000000-0000-0000-0000-000000000000/console', 'light'));
      await expect(page.getByRole('heading', { name: 'VM Not Found' })).toBeVisible({ timeout: 30000 });
      vmHeaders = { Authorization: `Bearer ${await accessToken(page)}`, 'Content-Type': 'application/json' };
      const vm = await okJson<{ id: string }>(
        await api.post(`${Services.PlayerVM.API}/api/vms`, {
          headers: vmHeaders,
          data: { name, teamIds: [teamId] },
        }),
        `Create VM "${name}"`
      );
      vmId = vm.id;

      await use({ id: vm.id, name, viewId: view.id, teamId });
    } finally {
      if (vmId && vmHeaders) {
        const del = await api.delete(`${Services.PlayerVM.API}/api/vms/${vmId}`, { headers: vmHeaders });
        if (!del.ok() && del.status() !== 404) console.warn(`Console fixture cleanup failed for VM ${vmId}: ${del.status()}`);
      }
      if (viewId) {
        const del = await api.delete(`${Services.Player.API}/api/views/${viewId}`, { headers: playerHeaders });
        if (!del.ok() && del.status() !== 404) console.warn(`Console fixture cleanup failed for view ${viewId}: ${del.status()}`);
      }
      await api.dispose();
    }
  },
});

export { expect } from '@playwright/test';
export { Services };
