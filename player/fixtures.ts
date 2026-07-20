// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { test as base, Page, request as pwRequest, APIRequestContext } from '@playwright/test';
import fs from 'fs';
import {
  Services,
  serviceUrlPattern,
  oidcStorageKey,
  authenticateWithKeycloak,
  waitForFirstVisible,
} from '../shared-fixtures';
import { authSessionStatePath, authStatePath } from '../auth-paths';

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

interface PlayerView {
  id: string;
  name: string;
}

const playerHeaders = (token: string) => ({
  Authorization: `Bearer ${token}`,
  'Content-Type': 'application/json',
});

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

async function createPlayerView(
  apiContext: APIRequestContext,
  token: string,
  name: string
): Promise<PlayerView> {
  const response = await apiContext.post(`${Services.Player.API}/api/views`, {
    headers: playerHeaders(token),
    data: {
      name,
      description: `E2E fixture data for ${name}`,
      status: 'Active',
      isTemplate: false,
      createAdminTeam: true,
    },
  });

  if (!response.ok()) {
    throw new Error(`Failed to create Player view "${name}": ${response.status()} ${await response.text()}`);
  }

  return await response.json();
}

async function deletePlayerView(
  apiContext: APIRequestContext,
  token: string,
  viewId: string
): Promise<void> {
  const response = await apiContext.delete(`${Services.Player.API}/api/views/${viewId}`, {
    headers: playerHeaders(token),
  });

  if (!response.ok() && response.status() !== 404) {
    console.warn(`Player fixture cleanup failed for view ${viewId}: ${response.status()}`);
  }
}

async function seedLegacyPlayerData(token: string): Promise<() => Promise<void>> {
  const apiContext = await pwRequest.newContext({ ignoreHTTPSErrors: true });
  const viewIds: string[] = [];

  try {
    const primary = await createPlayerView(apiContext, token, 'Project Lagoon TTX - Admin');
    viewIds.push(primary.id);

    const teamsResponse = await apiContext.get(`${Services.Player.API}/api/views/${primary.id}/teams`, {
      headers: playerHeaders(token),
    });
    if (!teamsResponse.ok()) {
      throw new Error(`Failed to get Player fixture teams: ${teamsResponse.status()} ${await teamsResponse.text()}`);
    }
    const teams: Array<{ id: string }> = await teamsResponse.json();
    const adminTeam = teams[0];
    if (!adminTeam) {
      throw new Error(`Player fixture view ${primary.id} did not create an Admin team`);
    }

    const extraTeamResponse = await apiContext.post(`${Services.Player.API}/api/views/${primary.id}/teams`, {
      headers: playerHeaders(token),
      data: { name: 'Exercise Control' },
    });
    if (!extraTeamResponse.ok()) {
      throw new Error(`Failed to create Player fixture team: ${extraTeamResponse.status()} ${await extraTeamResponse.text()}`);
    }
    const extraTeam: { id: string } = await extraTeamResponse.json();

    const usersResponse = await apiContext.get(`${Services.Player.API}/api/users`, {
      headers: playerHeaders(token),
    });
    if (!usersResponse.ok()) {
      throw new Error(`Failed to get Player fixture user: ${usersResponse.status()} ${await usersResponse.text()}`);
    }
    const users: Array<{ id: string; name: string }> = await usersResponse.json();
    const admin = users.find(user => user.name === 'Admin User');
    if (!admin) {
      throw new Error('Player fixture could not find the Admin User');
    }
    const addAdminResponse = await apiContext.post(
      `${Services.Player.API}/api/teams/${extraTeam.id}/users/${admin.id}`,
      { headers: playerHeaders(token) }
    );
    if (!addAdminResponse.ok()) {
      throw new Error(`Failed to add Admin User to Player fixture team: ${addAdminResponse.status()} ${await addAdminResponse.text()}`);
    }

    for (const name of ['Steamfitter View']) {
      const view = await createPlayerView(apiContext, token, name);
      viewIds.push(view.id);
    }

    return async () => {
      for (const viewId of viewIds.reverse()) {
        await deletePlayerView(apiContext, token, viewId);
      }
      await apiContext.dispose();
    };
  } catch (error) {
    for (const viewId of viewIds.reverse()) {
      await deletePlayerView(apiContext, token, viewId);
    }
    await apiContext.dispose();
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

  playerAuthenticatedPage: async ({ page, storageState }, use) => {
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

    const cleanupLegacyData = await seedLegacyPlayerData(await getPlayerApiToken(page, playerSessionState));
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
