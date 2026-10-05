// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { createHash } from 'crypto';
import { test as base, expect, Page, TestInfo, request as pwRequest } from '@playwright/test';
import { Services, authenticateWithKeycloak } from '../shared-fixtures';

const VIEW_LINK = 'a[href^="/view/"]';

export async function authenticatePlayerVmWithKeycloak(
  page: Page,
  username: string = 'admin',
  password: string = 'admin'
): Promise<void> {
  // Authenticate against Player UI: the Player VM UI has no view list of its
  // own (its root renders "View Not Found"), so we land on Player to discover
  // a real view id. The Keycloak SSO session then carries over to the Player
  // VM UI on the next navigation.
  await authenticateWithKeycloak(page, Services.Player.UI, username, password);
}

/**
 * Returns the id of the first view in the authenticated user's "My Views"
 * list, or null if the user has no views. Assumes the page is already on the
 * Player UI home (i.e. authenticatePlayerVmWithKeycloak has run).
 */
export async function getFirstViewId(page: Page): Promise<string | null> {
  const ids = await getAllViewIds(page);
  return ids.length > 0 ? ids[0] : null;
}

/**
 * Returns the ids of all views in the authenticated user's "My Views" list
 * (across all pages of the table is not handled — only the first page is read,
 * which is sufficient for the seeded dev/test data). Assumes the page is on
 * the Player UI home.
 */
export async function getAllViewIds(page: Page): Promise<string[]> {
  await expect(page.getByText('My Views')).toBeVisible({ timeout: 30000 });
  const links = page.locator(VIEW_LINK);
  const count = await links.count();
  const ids: string[] = [];
  for (let i = 0; i < count; i++) {
    const href = await links.nth(i).getAttribute('href');
    const match = href?.match(/\/view\/([0-9a-fA-F-]{36})/);
    if (match) {
      ids.push(match[1]);
    }
  }
  return ids;
}

/** A Player view seeded through the Player API for the duration of one test. */
export interface SeededPlayerVmView {
  id: string;
  name: string;
}

export type PlayerVmFixtures = {
  playerVmAuthenticatedPage: Page;
  /**
   * A fresh Player view (with its Admin team, which the creating admin user
   * belongs to) seeded via the Player API and deleted after the test. Its name is
   * unique per project, theme variant, worker and retry, so the light and dark
   * runs of a spec never collide.
   */
  playerVmView: SeededPlayerVmView;
};

function seededViewName(testInfo: TestInfo): string {
  const seed = createHash('sha1')
    .update(`${testInfo.project.name}:${testInfo.file}:${testInfo.titlePath.join(' > ')}:${testInfo.retry}`)
    .digest('hex')
    .slice(0, 8);
  return `E2E PlayerVm View [${testInfo.project.name}-w${testInfo.workerIndex}-r${testInfo.retry}-${seed}]`;
}

/** The OIDC access token the authenticated page holds in browser storage. */
async function accessToken(page: Page): Promise<string> {
  const token = await page.evaluate(() => {
    for (const storage of [localStorage, sessionStorage]) {
      for (let i = 0; i < storage.length; i++) {
        try {
          const value = JSON.parse(storage.getItem(storage.key(i)!) ?? '');
          if (typeof value?.access_token === 'string') return value.access_token as string;
        } catch {
          // Non-JSON application state shares browser storage with the OIDC user.
        }
      }
    }
    return null;
  });
  if (!token) throw new Error('Authenticated page did not contain an OIDC access token');
  return token;
}

/**
 * Delete any VM API maps left on a seeded view (e.g. by a map test that failed
 * before its own delete step). Deleting the Player view does not remove them.
 *
 * The VM API only accepts the VM UI's token (the Player UI token gets 403), and
 * that token lives in the VM UI origin's storage, so this only runs when the
 * page is still on the VM UI. Tests that never left Player created no maps.
 */
async function deleteViewMaps(page: Page, viewId: string): Promise<void> {
  if (!page.url().startsWith(Services.PlayerVM.UI)) return;
  const headers = { Authorization: `Bearer ${await accessToken(page)}` };
  const api = await pwRequest.newContext({ ignoreHTTPSErrors: true });
  try {
    const list = await api.get(`${Services.PlayerVM.API}/api/views/${viewId}/maps/all`, { headers });
    if (!list.ok()) return;
    for (const map of (await list.json()) as Array<{ id: string }>) {
      await api.delete(`${Services.PlayerVM.API}/api/views/maps/${map.id}`, { headers });
    }
  } finally {
    await api.dispose();
  }
}

export const test = base.extend<PlayerVmFixtures>({
  playerVmAuthenticatedPage: async ({ page }, use) => {
    await authenticatePlayerVmWithKeycloak(page);
    await use(page);
  },

  playerVmView: async ({ playerVmAuthenticatedPage: page }, use, testInfo) => {
    const headers = { Authorization: `Bearer ${await accessToken(page)}`, 'Content-Type': 'application/json' };
    const api = await pwRequest.newContext({ ignoreHTTPSErrors: true });
    const name = seededViewName(testInfo);
    const response = await api.post(`${Services.Player.API}/api/views`, {
      headers,
      data: { name, description: `E2E fixture data for ${name}`, status: 'Active', isTemplate: false, createAdminTeam: true },
    });
    if (!response.ok()) {
      await api.dispose();
      throw new Error(`Failed to create Player view "${name}": ${response.status()} ${await response.text()}`);
    }
    const view: SeededPlayerVmView = await response.json();
    try {
      await use({ id: view.id, name });
    } finally {
      await deleteViewMaps(page, view.id).catch((error) =>
        console.warn(`PlayerVm fixture map cleanup failed for view ${view.id}: ${error}`)
      );
      const del = await api.delete(`${Services.Player.API}/api/views/${view.id}`, { headers });
      if (!del.ok() && del.status() !== 404) {
        console.warn(`PlayerVm fixture cleanup failed for view ${view.id}: ${del.status()}`);
      }
      await api.dispose();
    }
  },
});

/**
 * Themes every authenticated Player VM functional spec is parameterized over. Each
 * spec runs once per entry so every screen is exercised in both light and dark mode.
 */
export const PLAYERVM_THEMES = ['light', 'dark'] as const;
export type PlayerVmTheme = (typeof PLAYERVM_THEMES)[number];

/** Whether the Player VM UI is currently rendering the dark theme. */
export async function playerVmIsDarkTheme(page: Page): Promise<boolean> {
  return page.evaluate(() => document.body.classList.contains('darkMode'));
}

async function expectBodyTheme(page: Page, theme: PlayerVmTheme): Promise<void> {
  if (theme === 'dark') {
    await expect(page.locator('body')).toHaveClass(/\bdarkMode\b/, { timeout: 10000 });
  } else {
    await expect(page.locator('body')).not.toHaveClass(/\bdarkMode\b/, { timeout: 10000 });
  }
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
  // Close the menu, and wait for its overlay to tear down so a lingering CDK
  // backdrop can't silently intercept the test's next click.
  await page.keyboard.press('Escape');
  await page.locator('.mat-mdc-menu-panel').waitFor({ state: 'detached', timeout: 5000 });
  await page.locator('.cdk-overlay-backdrop').waitFor({ state: 'detached', timeout: 5000 });

  await expectBodyTheme(page, theme);
}

/** `?theme=` values the VM UI's `AppComponent` understands. */
const THEME_PARAM: Record<PlayerVmTheme, string> = { light: 'light-theme', dark: 'dark-theme' };

/** A Player VM UI URL for `path` that boots straight into `theme`. */
export function playerVmUrl(path: string, theme: PlayerVmTheme): string {
  const url = new URL(path, Services.PlayerVM.UI);
  url.searchParams.set('theme', THEME_PARAM[theme]);
  return url.toString();
}

/**
 * Navigate to a Player VM UI route in the given theme.
 *
 * The theme travels in the `?theme=` query param, the same channel Player uses
 * when it embeds the VM UI in an iframe. This is the robust option here because
 * the VM UI keeps the theme only in memory: switching via the menu would be lost
 * on every `page.goto` or reload, whereas the param is re-read on every boot (and
 * survives a reload, since it stays on the URL). The VM UI does write `?theme=`
 * back onto the URL when the theme later changes, but no Player VM spec asserts
 * on the query string, so carrying it from the start costs nothing.
 *
 * Waits for `<body>` to reflect the theme before returning.
 */
export async function gotoPlayerVm(page: Page, path: string, theme: PlayerVmTheme): Promise<void> {
  await page.goto(playerVmUrl(path, theme));
  await expectBodyTheme(page, theme);
}

export { expect } from '@playwright/test';
export { Services };
