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

import { Services } from './shared-fixtures';
import {
  cachedToken,
  cachedUserToken,
  invalidateToken,
  invalidateTokensForUser,
  markTemporaryUser,
  sharedRequestContext,
  tokenKey,
} from './api-cache';

const ADMIN_REALM = 'master';
const ADMIN_CLIENT_ID = 'admin-cli';

function adminUsername(): string {
  return process.env.KEYCLOAK_ADMIN_USER || 'admin';
}
function adminPassword(): string {
  return process.env.KEYCLOAK_ADMIN_PASSWORD || 'admin';
}

/**
 * Acquire a master-realm admin token with full admin-cli privileges.
 * This token can manage users, roles, and clients in any realm.
 */
export async function getKeycloakAdminToken(): Promise<string> {
  return cachedToken(ADMIN_TOKEN_KEY(), fetchKeycloakAdminToken);
}

const ADMIN_TOKEN_KEY = () => tokenKey(ADMIN_REALM, ADMIN_CLIENT_ID, adminUsername(), '');

async function fetchKeycloakAdminToken(): Promise<string> {
  const ctx = await sharedRequestContext();
  {
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
  markTemporaryUser(opts.username);
  const ctx = await sharedRequestContext();
  {
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

    createdUsernames.set(userId, opts.username);
    return {
      id: userId,
      username: opts.username,
      password: opts.password,
      realm,
    };
  }
}

/** Usernames of the users `createKeycloakUser` made in this worker, by user id. */
const createdUsernames = new Map<string, string>();

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
  const username = createdUsernames.get(userId);
  if (username) {
    invalidateTokensForUser(username);
    createdUsernames.delete(userId);
  }
  const ctx = await sharedRequestContext();
  {
    const deleteUser = (token: string) =>
      ctx.fetch(`${keycloak}/admin/realms/${realm}/users/${userId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
    let res = await deleteUser(adminToken);
    if (res.status() === 401) {
      // The caller's admin token (often captured in beforeEach) expired; retry once fresh.
      invalidateToken(ADMIN_TOKEN_KEY());
      res = await deleteUser(await getKeycloakAdminToken());
    }
    if (!res.ok() && res.status() !== 404) {
      console.warn(`deleteKeycloakUser(${userId}) returned ${res.status()}`);
    }
  }
}

/**
 * The secret of a confidential realm client, read out of Keycloak.
 *
 * Needed when a test has to hand one Crucible service the credentials another one
 * authenticates with — `playerVm/vm-helpers.ts` subscribes the Player API to view
 * events and has to tell it which client to get its callback token as.
 *
 * Read rather than hardcoded on purpose: a secret checked in here would be right
 * for the dev realm and silently wrong everywhere else, with nothing but a failing
 * delivery to say so. The master-realm admin token this file already uses can ask
 * for the real one, so every deployment gets its own. Returns null when the client
 * does not exist or is public (no secret to read) — a deployment fact for
 * `requirePrecondition`, not a failure.
 */
export async function getClientSecret(
  adminToken: string,
  clientId: string,
  realm: string = 'crucible'
): Promise<string | null> {
  const keycloak = Services.Keycloak.replace(/\/$/, '');
  const ctx = await sharedRequestContext();
  {
    const headers = { Authorization: `Bearer ${adminToken}` };
    const found = await ctx.fetch(
      `${keycloak}/admin/realms/${realm}/clients?clientId=${encodeURIComponent(clientId)}`,
      { headers }
    );
    if (!found.ok()) {
      return null;
    }
    // `clientId` is the human name; every admin path below keys off the uuid.
    const uuid = ((await found.json()) as any[])[0]?.id;
    if (!uuid) {
      return null;
    }
    const secret = await ctx.fetch(
      `${keycloak}/admin/realms/${realm}/clients/${uuid}/client-secret`,
      { headers }
    );
    if (!secret.ok()) {
      return null;
    }
    return ((await secret.json()) as { value?: string }).value ?? null;
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
 *
 * Cached per worker, except for temporary users (see `isTemporaryUser` in
 * `api-cache.ts`), whose accounts are deleted within the test.
 */
export async function getUserToken(
  username: string,
  password: string,
  clientId: string = 'gameboard.ui',
  scope: string = 'openid profile gameboard'
): Promise<string> {
  return cachedUserToken('crucible', clientId, username, scope, () =>
    fetchUserToken(username, password, clientId, scope)
  );
}

async function fetchUserToken(
  username: string,
  password: string,
  clientId: string,
  scope: string
): Promise<string> {
  const keycloak = Services.Keycloak.replace(/\/$/, '');
  const ctx = await sharedRequestContext();
  {
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
  }
}
