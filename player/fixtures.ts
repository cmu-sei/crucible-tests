// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { test as base, Page, Locator, TestInfo } from '@playwright/test';
import fs from 'fs';
import {
  Services,
  serviceUrlPattern,
  oidcStorageKey,
  authenticateWithKeycloak,
  waitForFirstVisible,
} from '../shared-fixtures';
import { authSessionStatePath, authStatePath } from '../auth-paths';
import { THEMES, Theme, isDarkTheme, expectBodyTheme, closeMenuAndWaitForOverlay, seededName } from '../theme-helpers';
import {
  addUserToTeam,
  createTeam,
  createView,
  deleteView,
  getUsers,
  getViewTeams,
} from '../player-helpers';

export async function authenticatePlayerWithKeycloak(
  page: Page,
  username: string = 'admin',
  password: string = 'admin'
): Promise<void> {
  await authenticateWithKeycloak(page, Services.Player.UI, username, password);
}

export type PlayerFixtures = {
  playerAuthenticatedPage: Page;
};

const primaryViewBaseName = 'Project Lagoon TTX - Admin';
const steamfitterViewBaseName = 'Steamfitter View';

export function seededPrimaryViewName(): string {
  return seededName(primaryViewBaseName, test.info());
}

export function seededSteamfitterViewName(): string {
  return seededName(steamfitterViewBaseName, test.info());
}

export async function typeIntoSearch(searchField: Locator, value: string): Promise<void> {
  await searchField.click();
  await searchField.press('Control+A');
  await searchField.press('Delete');
  if (value.length > 0) {
    await searchField.pressSequentially(value);
  }
}

export async function dismissTransientOverlays(page: Page): Promise<void> {
  await page.mouse.move(0, 0).catch(() => {});
  await page.keyboard.press('Escape').catch(() => {});

  const backdrop = page.locator('.cdk-overlay-backdrop');
  await backdrop.first().waitFor({ state: 'hidden', timeout: 1000 }).catch(() => {});

  const tooltip = page.locator('mat-tooltip-component');
  await tooltip.first().waitFor({ state: 'hidden', timeout: 1000 }).catch(() => {});
}

export async function clickWithoutOverlayInterference(page: Page, locator: Locator): Promise<void> {
  await dismissTransientOverlays(page);
  try {
    await locator.click({ timeout: 1500 });
  } catch {
    await dismissTransientOverlays(page);
    await locator.click({ force: true });
  }
}

export async function findPlayerHomeViewLink(page: Page, viewName: string): Promise<Locator> {
  const searchField = page.getByRole('textbox', { name: 'Search' });
  await typeIntoSearch(searchField, viewName);

  const viewLink = page.getByRole('link', { name: viewName, exact: true });
  await viewLink.waitFor({ state: 'visible', timeout: 10000 });
  return viewLink;
}

export async function findAdminViewButton(page: Page, viewName: string): Promise<Locator> {
  const searchField = page.getByRole('textbox', { name: 'Search' });
  const searchableName = viewName.replace(/ \[[^\]]+\]$/, '');
  await typeIntoSearch(searchField, searchableName);

  const viewButton = page.getByRole('button', { name: viewName, exact: true });
  await viewButton.waitFor({ state: 'visible', timeout: 10000 });
  return viewButton;
}

function tokenFromStorageEntries(entries: Array<[string, string]>): string | null {
  for (const [, value] of entries) {
    try {
      const storedUser = JSON.parse(value);
      if (typeof storedUser.access_token === 'string') {
        return storedUser.access_token;
      }
    } catch {
      // OIDC storage shares browser storage with unrelated non-JSON application state.
    }
  }
  return null;
}

async function getPlayerApiToken(page: Page, savedSessionState: Array<[string, string]>): Promise<string> {
  const token = await page.evaluate(() => {
    for (const storage of [localStorage, sessionStorage]) {
      for (let index = 0; index < storage.length; index++) {
        const value = storage.getItem(storage.key(index)!);
        if (!value) continue;

        try {
          const storedUser = JSON.parse(value);
          if (typeof storedUser.access_token === 'string') {
            return storedUser.access_token;
          }
        } catch {
          // OIDC storage shares browser storage with unrelated non-JSON application state.
        }
      }
    }
    return null;
  });

  const savedToken = tokenFromStorageEntries(savedSessionState);
  if (!token && !savedToken) {
    throw new Error('Player authenticated page did not contain an OIDC access token');
  }

  return token ?? savedToken!;
}

/**
 * Seed the views the Player specs expect to find in the UI: the primary view
 * (with a second team beyond the Admin one the API creates, so team-switching has
 * something to switch to) and the view the Steamfitter-facing specs look for.
 *
 * The view/team/user calls all come from `../player-helpers`, which owns them for
 * the whole suite. The token is the *browser's* OIDC access token rather than a
 * fresh password-grant one, so the seeded views are owned by exactly the user the
 * test is signed in as — that is what makes them visible on the page under test.
 *
 * Returns a cleanup that removes the views newest-first. On a partial failure it
 * removes whatever was created before rethrowing, so a broken seed leaks nothing.
 */
async function seedLegacyPlayerData(token: string, testInfo: TestInfo): Promise<() => Promise<void>> {
  const viewIds: string[] = [];
  const primaryViewName = seededName(primaryViewBaseName, testInfo);
  const steamfitterViewName = seededName(steamfitterViewBaseName, testInfo);

  const cleanup = async () => {
    for (const viewId of viewIds.splice(0).reverse()) {
      await deleteView(token, viewId);
    }
  };

  try {
    const primary = await createView(token, primaryViewName, `E2E fixture data for ${primaryViewName}`);
    viewIds.push(primary.id);

    if (!(await getViewTeams(token, primary.id))[0]) {
      throw new Error(`Player fixture view ${primary.id} did not create an Admin team`);
    }

    const extraTeam = await createTeam(token, primary.id, 'Exercise Control');

    const admin = (await getUsers(token)).find(user => user.name === 'Admin User');
    if (!admin) {
      throw new Error('Player fixture could not find the Admin User');
    }
    await addUserToTeam(token, extraTeam.id, admin.id);

    const steamfitterView = await createView(
      token,
      steamfitterViewName,
      `E2E fixture data for ${steamfitterViewName}`
    );
    viewIds.push(steamfitterView.id);

    return cleanup;
  } catch (error) {
    await cleanup();
    throw error;
  }
}

const playerStatePath = authStatePath('player');
const playerStateExists = fs.existsSync(playerStatePath);
const playerSessionStatePath = authSessionStatePath('player');
const playerSessionState: Array<[string, string]> = fs.existsSync(playerSessionStatePath)
  ? JSON.parse(fs.readFileSync(playerSessionStatePath, 'utf8'))
  : [];

export const test = base.extend<PlayerFixtures>({
  // Reuse the authenticated state captured by global-setup. Authentication specs
  // opt out with an empty storageState and retain the interactive login flow.
  storageState: playerStateExists ? playerStatePath : undefined,

  playerAuthenticatedPage: async ({ page, storageState }, use, testInfo) => {
    if (storageState === playerStatePath && playerSessionState.length > 0) {
      await page.addInitScript((entries: Array<[string, string]>) => {
        for (const [key, value] of entries) {
          sessionStorage.setItem(key, value);
        }
      }, playerSessionState);
    }

    await page.goto(Services.Player.UI, { waitUntil: 'domcontentloaded' });

    const appShell = page.getByRole('button', { name: 'Menu' });
    const keycloakField = page.locator('input[name="username"]');
    const winner = await waitForFirstVisible(
      page,
      [
        { key: 'shell', locator: appShell },
        { key: 'keycloak', locator: keycloakField },
      ],
      { timeout: 20000 }
    );

    if (winner !== 'shell') {
      await authenticatePlayerWithKeycloak(page);
      await appShell.waitFor({ state: 'visible', timeout: 30000 });
    }

    const cleanupLegacyData = await seedLegacyPlayerData(await getPlayerApiToken(page, playerSessionState), testInfo);
    await page.reload({ waitUntil: 'domcontentloaded' });
    await appShell.waitFor({ state: 'visible', timeout: 30000 });

    try {
      await use(page);
    } finally {
      await cleanupLegacyData();
    }
  },
});

/**
 * Themes every authenticated Player functional spec is parameterized over. Each
 * spec runs once per entry so every screen is exercised in both light and dark mode.
 */
export const PLAYER_THEMES = THEMES;
export type PlayerTheme = Theme;

/** Whether Player is currently rendering the dark theme. */
export async function playerIsDarkTheme(page: Page): Promise<boolean> {
  return isDarkTheme(page);
}

/**
 * Switch Player between light and dark theme through the top bar user menu's
 * "Dark Theme" switch, and wait for the change to land on `document.body`.
 *
 * Player persists the selected theme in the `auth` slice of its Akita store, saved
 * to localStorage under 'akita-player-ui' (`{"auth":{"theme":"dark-theme"}}`). So a
 * theme set here survives the reloads and `page.goto` calls a test performs
 * afterward, and only needs applying once, right after authentication. The
 * preference never reaches the server, and the saved auth state carries no Akita
 * store, so every test's fresh browser context starts light.
 *
 * Use the switch rather than the `?theme=dark-theme` query param: once the param
 * has been seen, `AppComponent` writes it back onto the URL on every later theme
 * change, which would leak it into the URL assertions several specs make.
 *
 * No-ops when the requested theme is already active, so callers can use it to
 * restore state unconditionally.
 */
export async function setPlayerTheme(page: Page, theme: PlayerTheme): Promise<void> {
  if ((await playerIsDarkTheme(page)) === (theme === 'dark')) return;

  // The user menu is the top bar's name button, labelled "Menu".
  await page.getByRole('button', { name: 'Menu', exact: true }).click();
  const toggle = page.getByRole('switch', { name: 'Dark Theme' });
  await toggle.waitFor({ state: 'visible', timeout: 10000 });
  await toggle.click();
  await closeMenuAndWaitForOverlay(page);

  await expectBodyTheme(page, theme);
}

export { expect } from '@playwright/test';
export { Services, serviceUrlPattern, oidcStorageKey, waitForFirstVisible };
