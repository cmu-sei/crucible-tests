// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { createHash } from 'crypto';
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

function buildSeededViewName(baseName: string, testInfo: TestInfo): string {
  const seed = createHash('sha1')
    .update(`${testInfo.project.name}:${testInfo.file}:${testInfo.title}:${testInfo.retry}`)
    .digest('hex')
    .slice(0, 8);

  return `${baseName} [${testInfo.project.name}-w${testInfo.workerIndex}-r${testInfo.retry}-${seed}]`;
}

export function seededPrimaryViewName(): string {
  return buildSeededViewName(primaryViewBaseName, test.info());
}

export function seededSteamfitterViewName(): string {
  return buildSeededViewName(steamfitterViewBaseName, test.info());
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
  const primaryViewName = buildSeededViewName(primaryViewBaseName, testInfo);
  const steamfitterViewName = buildSeededViewName(steamfitterViewBaseName, testInfo);

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

export { expect } from '@playwright/test';
export { Services, serviceUrlPattern, oidcStorageKey, waitForFirstVisible };
