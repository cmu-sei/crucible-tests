// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

/**
 * Keycloak admin API helpers for Crucible tests.
 *
 * Provides reusable functions to create/delete users in the Keycloak
 * `crucible` realm during tests. Tests that need a secondary user account
 * (for example, to verify "unauthorized access", "team invitation acceptance",
 * or "user B cannot edit user A's data") create a temporary user with a known
 * password, exercise the scenario, then delete the user in teardown.
 *
 * These helpers are app-agnostic and live at the repo root so every Crucible
 * app can import them from `../keycloak-admin`.
 *
 * Default master-realm admin credentials are `admin`/`admin` — override via
 * the KEYCLOAK_ADMIN_USER and KEYCLOAK_ADMIN_PASSWORD env vars if your
 * environment differs.
 */

import { APIRequestContext, request as playwrightRequest } from '@playwright/test';
import { Services } from './shared-fixtures';

const ADMIN_REALM = 'master';
const ADMIN_CLIENT_ID = 'admin-cli';

function adminUsername(): string {
  return process.env.KEYCLOAK_ADMIN_USER || 'admin';
}
function adminPassword(): string {
  return process.env.KEYCLOAK_ADMIN_PASSWORD || 'admin';
}

async function newContext(): Promise<APIRequestContext> {
  return playwrightRequest.newContext({ ignoreHTTPSErrors: true });
}

/**
 * Acquire a master-realm admin token with full admin-cli privileges.
 * This token can manage users, roles, and clients in any realm.
 */
export async function getKeycloakAdminToken(): Promise<string> {
  const ctx = await newContext();
  try {
    const keycloak = Services.Keycloak.replace(/\/$/, '');
    const res = await ctx.post(
      `${keycloak}/realms/${ADMIN_REALM}/protocol/openid-connect/token`,
      {
        form: {
          client_id: ADMIN_CLIENT_ID,
          grant_type: 'password',
          username: adminUsername(),
          password: adminPassword(),
        },
      }
    );
    if (!res.ok()) {
      throw new Error(
        `Keycloak admin token request failed (${res.status()}): ${await res.text()}`
      );
    }
    const data = await res.json();
    return data.access_token as string;
  } finally {
    await ctx.dispose();
  }
}

export interface KeycloakUserOptions {
  /** Username for the new user. Must be unique. */
  username: string;
  /** Password to assign (used for password-grant token acquisition later). */
  password: string;
  email?: string;
  firstName?: string;
  lastName?: string;
  /**
   * Realm-level role names to assign (e.g., `['Administrator']`). Each role
   * must already exist in the realm.
   */
  realmRoles?: string[];
  /** Realm to create the user in. Defaults to 'crucible'. */
  realm?: string;
}

export interface KeycloakUser {
  id: string;
  username: string;
  password: string;
  realm: string;
}

/**
 * Create a temporary Keycloak user in the `crucible` realm (or specified realm).
 * Returns the new user's id — pair every call with `deleteKeycloakUser` in a
 * test teardown block.
 *
 * The password is set non-temporary so tests can immediately use the
 * password grant with the new credentials.
 */
export async function createKeycloakUser(
  adminToken: string,
  opts: KeycloakUserOptions
): Promise<KeycloakUser> {
  const realm = opts.realm || 'crucible';
  const keycloak = Services.Keycloak.replace(/\/$/, '');
  const ctx = await newContext();
  try {
    // POST /admin/realms/{realm}/users
    const createRes = await ctx.post(`${keycloak}/admin/realms/${realm}/users`, {
      headers: {
        Authorization: `Bearer ${adminToken}`,
        'Content-Type': 'application/json',
      },
      data: {
        username: opts.username,
        email: opts.email ?? `${opts.username}@test.local`,
        firstName: opts.firstName ?? 'Test',
        lastName: opts.lastName ?? 'User',
        enabled: true,
        emailVerified: true,
        // requiredActions = [] clears default "Update Password" / "Verify Email"
        // actions so the password grant works immediately.
        requiredActions: [],
        credentials: [
          { type: 'password', value: opts.password, temporary: false },
        ],
      },
    });
    if (!createRes.ok() && createRes.status() !== 201) {
      throw new Error(
        `Keycloak createUser(${opts.username}) failed (${createRes.status()}): ${await createRes.text()}`
      );
    }

    // Keycloak returns 201 with a Location header containing the new user URL.
    const location = createRes.headers()['location'];
    let userId: string | undefined = location?.split('/').pop();
    if (!userId) {
      // Fallback: query by username.
      const searchRes = await ctx.fetch(
        `${keycloak}/admin/realms/${realm}/users?username=${encodeURIComponent(opts.username)}&exact=true`,
        { headers: { Authorization: `Bearer ${adminToken}` } }
      );
      const found = (await searchRes.json()) as any[];
      userId = found[0]?.id;
    }
    if (!userId) {
      throw new Error(`Could not determine newly-created user id for ${opts.username}`);
    }

    // The realm may define default required actions (e.g., TERMS_AND_CONDITIONS,
    // VERIFY_EMAIL) that block the password grant. Clear them explicitly via PUT.
    const clearActionsRes = await ctx.fetch(
      `${keycloak}/admin/realms/${realm}/users/${userId}`,
      {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${adminToken}`,
          'Content-Type': 'application/json',
        },
        data: { requiredActions: [] },
      }
    );
    if (!clearActionsRes.ok()) {
      console.warn(
        `Could not clear requiredActions for ${opts.username} (${clearActionsRes.status()})`
      );
    }

    // Assign realm roles if requested.
    if (opts.realmRoles && opts.realmRoles.length > 0) {
      const rolesToAssign: Array<{ id: string; name: string }> = [];
      for (const roleName of opts.realmRoles) {
        const roleRes = await ctx.fetch(
          `${keycloak}/admin/realms/${realm}/roles/${encodeURIComponent(roleName)}`,
          { headers: { Authorization: `Bearer ${adminToken}` } }
        );
        if (!roleRes.ok()) {
          throw new Error(
            `Realm role "${roleName}" not found in realm ${realm} (${roleRes.status()})`
          );
        }
        const role = await roleRes.json();
        rolesToAssign.push({ id: role.id, name: role.name });
      }
      const assignRes = await ctx.post(
        `${keycloak}/admin/realms/${realm}/users/${userId}/role-mappings/realm`,
        {
          headers: {
            Authorization: `Bearer ${adminToken}`,
            'Content-Type': 'application/json',
          },
          data: rolesToAssign,
        }
      );
      if (!assignRes.ok()) {
        throw new Error(
          `Failed to assign roles to ${opts.username} (${assignRes.status()}): ${await assignRes.text()}`
        );
      }
    }

    return {
      id: userId,
      username: opts.username,
      password: opts.password,
      realm,
    };
  } finally {
    await ctx.dispose();
  }
}

/**
 * Delete a Keycloak user by id. Safe to call on a non-existent id — swallows
 * 404 so teardown blocks don't fail a passing test.
 */
export async function deleteKeycloakUser(
  adminToken: string,
  userId: string,
  realm: string = 'crucible'
): Promise<void> {
  const keycloak = Services.Keycloak.replace(/\/$/, '');
  const ctx = await newContext();
  try {
    const res = await ctx.fetch(
      `${keycloak}/admin/realms/${realm}/users/${userId}`,
      {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${adminToken}` },
      }
    );
    if (!res.ok() && res.status() !== 404) {
      console.warn(`deleteKeycloakUser(${userId}) returned ${res.status()}`);
    }
  } finally {
    await ctx.dispose();
  }
}

/**
 * Generate a unique username suitable for temporary test accounts.
 * Format: `<prefix>-<timestamp>-<random>`.
 */
export function tempUsername(prefix: string = 'tmpuser'): string {
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 1_000_000)}`;
}

/**
 * Acquire a user-level bearer token for `username` / `password` against the
 * `crucible` realm using the specified OIDC client (defaults to `gameboard.ui`).
 * Useful when a test needs to call an app's API as a non-admin user.
 */
export async function getUserToken(
  username: string,
  password: string,
  clientId: string = 'gameboard.ui',
  scope: string = 'openid profile gameboard'
): Promise<string> {
  const keycloak = Services.Keycloak.replace(/\/$/, '');
  const ctx = await newContext();
  try {
    const res = await ctx.post(
      `${keycloak}/realms/crucible/protocol/openid-connect/token`,
      {
        form: {
          client_id: clientId,
          grant_type: 'password',
          username,
          password,
          scope,
        },
      }
    );
    if (!res.ok()) {
      throw new Error(
        `User token request failed for ${username} (${res.status()}): ${await res.text()}`
      );
    }
    const data = await res.json();
    return data.access_token as string;
  } finally {
    await ctx.dispose();
  }
}
