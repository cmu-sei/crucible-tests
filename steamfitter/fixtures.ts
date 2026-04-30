// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { test as base, Page, APIRequestContext } from '@playwright/test';
import { Services, authenticateWithKeycloak } from '../shared-fixtures';

export async function authenticateSteamfitterWithKeycloak(
  page: Page,
  username: string = 'admin',
  password: string = 'admin'
): Promise<void> {
  await authenticateWithKeycloak(page, Services.Steamfitter.UI, username, password);
}

/**
 * Obtain a Keycloak access token using the Resource Owner Password Credentials grant.
 * This token can be used to authenticate Playwright APIRequestContext calls.
 */
export async function getKeycloakAccessToken(
  request: APIRequestContext,
  username: string = 'admin',
  password: string = 'admin'
): Promise<string> {
  const tokenUrl = `${Services.KeycloakRealm}/protocol/openid-connect/token`;
  const resp = await request.post(tokenUrl, {
    form: {
      grant_type: 'password',
      client_id: 'steamfitter.ui',
      username,
      password,
      scope: 'openid profile steamfitter',
    },
    ignoreHTTPSErrors: true,
  });
  if (!resp.ok()) {
    throw new Error(`Failed to obtain Keycloak token: ${resp.status()} ${await resp.text()}`);
  }
  const data = await resp.json();
  return data.access_token as string;
}

/**
 * Helper that wraps a Playwright APIRequestContext so every request includes
 * a Bearer token. Returns an object with the same HTTP-verb methods.
 */
export function authenticatedApi(request: APIRequestContext, token: string) {
  const authHeaders = { Authorization: `Bearer ${token}` };
  const defaultTimeout = 60000;
  return {
    get(url: string, opts?: Parameters<APIRequestContext['get']>[1]) {
      return request.get(url, { timeout: defaultTimeout, ...opts, headers: { ...authHeaders, ...opts?.headers } });
    },
    post(url: string, opts?: Parameters<APIRequestContext['post']>[1]) {
      return request.post(url, { timeout: defaultTimeout, ...opts, headers: { ...authHeaders, ...opts?.headers } });
    },
    put(url: string, opts?: Parameters<APIRequestContext['put']>[1]) {
      return request.put(url, { timeout: defaultTimeout, ...opts, headers: { ...authHeaders, ...opts?.headers } });
    },
    patch(url: string, opts?: Parameters<APIRequestContext['patch']>[1]) {
      return request.patch(url, { timeout: defaultTimeout, ...opts, headers: { ...authHeaders, ...opts?.headers } });
    },
    delete(url: string, opts?: Parameters<APIRequestContext['delete']>[1]) {
      return request.delete(url, { timeout: defaultTimeout, ...opts, headers: { ...authHeaders, ...opts?.headers } });
    },
  };
}

/**
 * Obtain a Keycloak access token for the Player API.
 */
export async function getPlayerAccessToken(
  request: APIRequestContext,
  username: string = 'admin',
  password: string = 'admin'
): Promise<string> {
  const tokenUrl = `${Services.KeycloakRealm}/protocol/openid-connect/token`;
  // Use steamfitter.ui client which has direct access grants enabled and includes the player scope.
  // The Player API (views, teams) runs on port 4300.
  const resp = await request.post(tokenUrl, {
    form: {
      grant_type: 'password',
      client_id: 'steamfitter.ui',
      username,
      password,
      scope: 'openid profile player',
    },
    ignoreHTTPSErrors: true,
  });
  if (!resp.ok()) {
    throw new Error(`Failed to obtain Player Keycloak token: ${resp.status()} ${await resp.text()}`);
  }
  const data = await resp.json();
  return data.access_token as string;
}

export type SteamfitterFixtures = {
  steamfitterAuthenticatedPage: Page;
  steamfitterApi: ReturnType<typeof authenticatedApi>;
  playerApi: ReturnType<typeof authenticatedApi>;
};

export const test = base.extend<SteamfitterFixtures>({
  steamfitterAuthenticatedPage: async ({ page }, use) => {
    await authenticateSteamfitterWithKeycloak(page);
    await use(page);
  },
  steamfitterApi: async ({ request }, use) => {
    const token = await getKeycloakAccessToken(request);
    const api = authenticatedApi(request, token);
    await use(api);
  },
  playerApi: async ({ request }, use) => {
    const token = await getPlayerAccessToken(request);
    const api = authenticatedApi(request, token);
    await use(api);
  },
});

export { expect } from '@playwright/test';
export { Services, authenticateWithKeycloak };
