// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { test as base, Page } from '@playwright/test';
import { Services, authenticateWithKeycloak } from '../shared-fixtures';

/**
 * Caster-specific fixtures
 * Extends shared fixtures with Caster authentication
 */

/**
 * Caster-specific authentication helper
 * @param page - Playwright Page object
 * @param username - Keycloak username (default: 'admin')
 * @param password - Keycloak password (default: 'admin')
 */
export async function authenticateCasterWithKeycloak(
  page: Page,
  username: string = 'admin',
  password: string = 'admin'
): Promise<void> {
  await authenticateWithKeycloak(page, Services.Caster.UI, username, password);
}

/**
 * Get an access token from session storage and the API URL from the Angular
 * app's runtime settings.  Both are needed by the API helper functions below.
 */
async function getCasterApiContext(page: Page): Promise<{ apiUrl: string; token: string }> {
  return page.evaluate(async () => {
    const settingsResp = await fetch('/assets/config/settings.env.json');
    const settings = await settingsResp.json();
    const apiUrl: string = settings.ApiUrl;

    let token: string | null = null;
    for (let i = 0; i < sessionStorage.length; i++) {
      const key = sessionStorage.key(i);
      if (key) {
        try {
          const val = JSON.parse(sessionStorage.getItem(key) || '');
          if (val.access_token) {
            token = val.access_token;
            break;
          }
        } catch {
          // not a token entry
        }
      }
    }

    if (!token) throw new Error('No access token found in session storage');
    return { apiUrl, token };
  });
}

/**
 * Delete a Caster project via the API.
 * Reads the API URL from the Angular app's runtime settings, then calls
 * fetch() from the browser context with the authenticated user's token.
 * The Caster API has CORS configured to allow requests from the UI origin.
 */
async function deleteCasterProject(page: Page, projectId: string): Promise<number> {
  return page.evaluate(async (id: string) => {
    // Read the API URL from the Angular app's runtime config
    const settingsResp = await fetch('/assets/config/settings.env.json');
    const settings = await settingsResp.json();
    const apiUrl = settings.ApiUrl;

    // Get the access token from session storage
    let token: string | null = null;
    for (let i = 0; i < sessionStorage.length; i++) {
      const key = sessionStorage.key(i);
      if (key) {
        try {
          const val = JSON.parse(sessionStorage.getItem(key) || '');
          if (val.access_token) {
            token = val.access_token;
            break;
          }
        } catch {
          // not a token entry
        }
      }
    }

    if (!token) throw new Error('No access token found in session storage');

    const resp = await fetch(`${apiUrl}/api/projects/${id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    });
    return resp.status;
  }, projectId);
}

/**
 * Delete a Caster VLAN pool via the API.
 * The Caster DELETE /api/vlans/pools/{id} endpoint requires a JSON body
 * with a `force` boolean (set to true to delete even if VLANs are in use).
 */
async function deleteCasterPool(page: Page, poolId: string): Promise<number> {
  const { apiUrl, token } = await getCasterApiContext(page);
  return page.evaluate(
    async ({ apiUrl, token, poolId }) => {
      const resp = await fetch(`${apiUrl}/api/vlans/pools/${poolId}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ force: true }),
      });
      return resp.status;
    },
    { apiUrl, token, poolId },
  );
}

/**
 * Delete all Caster VLAN pools matching a given name via the API.
 * Lists all pools, finds every one matching the given name, and deletes each
 * with force=true.
 */
async function deleteCasterPoolByName(page: Page, poolName: string): Promise<number[]> {
  const { apiUrl, token } = await getCasterApiContext(page);
  return page.evaluate(
    async ({ apiUrl, token, poolName }) => {
      const listResp = await fetch(`${apiUrl}/api/vlans/pools`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!listResp.ok) return [listResp.status];
      const pools = await listResp.json();
      const matches = pools.filter((p: any) => p.name === poolName);
      if (matches.length === 0) return [404];

      const results: number[] = [];
      for (const pool of matches) {
        const delResp = await fetch(`${apiUrl}/api/vlans/pools/${pool.id}`, {
          method: 'DELETE',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ force: true }),
        });
        results.push(delResp.status);
      }
      return results;
    },
    { apiUrl, token, poolName },
  );
}

/**
 * Delete all Caster projects matching a given name via the API.
 * Lists all projects, finds every one matching the given name, and deletes each.
 */
async function deleteCasterProjectByName(page: Page, projectName: string): Promise<number[]> {
  const { apiUrl, token } = await getCasterApiContext(page);
  return page.evaluate(
    async ({ apiUrl, token, projectName }) => {
      const listResp = await fetch(`${apiUrl}/api/projects`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!listResp.ok) return [listResp.status];
      const projects = await listResp.json();
      const matches = projects.filter((p: any) => p.name === projectName);
      if (matches.length === 0) return [404];

      const results: number[] = [];
      for (const project of matches) {
        const delResp = await fetch(`${apiUrl}/api/projects/${project.id}`, {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${token}` },
        });
        results.push(delResp.status);
      }
      return results;
    },
    { apiUrl, token, projectName },
  );
}

/**
 * Delete a Caster role by name via the API.
 * Lists all roles, finds the one matching the given name, and deletes it.
 */
async function deleteCasterRoleByName(page: Page, roleName: string): Promise<number> {
  const { apiUrl, token } = await getCasterApiContext(page);
  return page.evaluate(
    async ({ apiUrl, token, roleName }) => {
      const listResp = await fetch(`${apiUrl}/api/system-roles`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!listResp.ok) return listResp.status;
      const roles = await listResp.json();
      const role = roles.find((r: any) => r.name === roleName);
      if (!role) return 404;

      const delResp = await fetch(`${apiUrl}/api/system-roles/${role.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      return delResp.status;
    },
    { apiUrl, token, roleName },
  );
}

/**
 * Caster-specific fixtures
 */
export type CasterFixtures = {
  casterAuthenticatedPage: Page;
  /** Register a Caster project ID to be deleted after the test completes */
  cleanupCasterProject: (projectId: string) => void;
  /** Register a Caster VLAN pool ID to be deleted after the test completes */
  cleanupCasterPool: (poolId: string) => void;
  /** Register a Caster project name to be deleted (pre-cleans leftovers and post-cleans after test) */
  cleanupCasterProjectByName: (projectName: string) => Promise<void>;
  /** Register a Caster pool name to be deleted (pre-cleans leftovers and post-cleans after test) */
  cleanupCasterPoolByName: (poolName: string) => Promise<void>;
  /** Register a Caster role name to be deleted (pre-cleans leftovers and post-cleans after test) */
  cleanupCasterRole: (roleName: string) => Promise<void>;
};

/**
 * Extended test with Caster-specific fixtures
 */
export const test = base.extend<CasterFixtures>({
  cleanupCasterProject: async ({ page }, use) => {
    const projectIds: string[] = [];
    await use((id: string) => {
      projectIds.push(id);
    });
    // Teardown: delete all registered projects via the Caster API
    for (const projectId of projectIds) {
      try {
        const status = await deleteCasterProject(page, projectId);
        console.log(`Cleanup: Deleted project ${projectId}, status: ${status}`);
      } catch (e) {
        console.warn(`Cleanup: Failed to delete project ${projectId}: ${e}`);
      }
    }
  },
  cleanupCasterProjectByName: async ({ page }, use) => {
    const projectNames: string[] = [];
    await use(async (name: string) => {
      projectNames.push(name);
      // Pre-clean: try to delete leftover projects from a previous failed run
      try {
        await deleteCasterProjectByName(page, name);
      } catch {
        // ignore – project may not exist yet
      }
    });
    // Post-clean: delete all registered projects by name
    for (const name of projectNames) {
      try {
        const statuses = await deleteCasterProjectByName(page, name);
        console.log(`Cleanup: Deleted project(s) "${name}", statuses: ${statuses}`);
      } catch (e) {
        console.warn(`Cleanup: Failed to delete project "${name}": ${e}`);
      }
    }
  },
  cleanupCasterPool: async ({ page }, use) => {
    const poolIds: string[] = [];
    await use((id: string) => {
      poolIds.push(id);
    });
    // Teardown: delete all registered pools via the Caster API
    for (const poolId of poolIds) {
      try {
        const status = await deleteCasterPool(page, poolId);
        console.log(`Cleanup: Deleted pool ${poolId}, status: ${status}`);
      } catch (e) {
        console.warn(`Cleanup: Failed to delete pool ${poolId}: ${e}`);
      }
    }
  },
  cleanupCasterPoolByName: async ({ page }, use) => {
    const poolNames: string[] = [];
    await use(async (name: string) => {
      poolNames.push(name);
      // Pre-clean: try to delete leftover pools from a previous failed run
      try {
        await deleteCasterPoolByName(page, name);
      } catch {
        // ignore – pool may not exist yet
      }
    });
    // Post-clean: delete all registered pools by name
    for (const name of poolNames) {
      try {
        const statuses = await deleteCasterPoolByName(page, name);
        console.log(`Cleanup: Deleted pool(s) "${name}", statuses: ${statuses}`);
      } catch (e) {
        console.warn(`Cleanup: Failed to delete pool "${name}": ${e}`);
      }
    }
  },
  cleanupCasterRole: async ({ page }, use) => {
    const roleNames: string[] = [];
    await use(async (name: string) => {
      roleNames.push(name);
      // Pre-clean: try to delete leftover role from a previous failed run
      try {
        await deleteCasterRoleByName(page, name);
      } catch {
        // ignore – role may not exist yet
      }
    });
    // Post-clean: delete all registered roles
    for (const name of roleNames) {
      try {
        const status = await deleteCasterRoleByName(page, name);
        console.log(`Cleanup: Deleted role "${name}", status: ${status}`);
      } catch (e) {
        console.warn(`Cleanup: Failed to delete role "${name}": ${e}`);
      }
    }
  },
  casterAuthenticatedPage: async ({ page }, use) => {
    await authenticateCasterWithKeycloak(page);
    await use(page);
  },
});

/**
 * Click the Add New Role button and wait for the dialog to open.
 * The MatTooltip overlay can intercept the first click, so retry if needed.
 */
export async function clickAddRoleButton(page: Page): Promise<void> {
  const permHeader = page.getByRole('columnheader', { name: 'Permissions' });
  const addButton = permHeader.getByRole('button').first();
  const dialog = page.getByRole('dialog');

  for (let attempt = 0; attempt < 3; attempt++) {
    await addButton.click();
    try {
      await dialog.waitFor({ state: 'visible', timeout: 3000 });
      return;
    } catch {
      // dialog didn't open — tooltip may have intercepted the click
    }
  }
  // Final attempt — let it throw with a clear timeout
  await addButton.click();
  await dialog.waitFor({ state: 'visible', timeout: 5000 });
}

export { expect } from '@playwright/test';
export { Services };
