// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { test as base, Page, request as pwRequest, APIRequestContext } from '@playwright/test';
import fs from 'fs';
import { randomUUID } from 'crypto';
import {
  Services,
  serviceUrlPattern,
  oidcStorageKey,
  authenticateWithKeycloak,
  waitForFirstVisible,
  settleForResponse,
} from '../shared-fixtures';
import { authStatePath } from '../auth-paths';
import { createView, deleteView, getPlayerToken } from '../player-helpers';

/**
 * Steamfitter-specific fixtures
 * Extends shared fixtures with Steamfitter authentication and API-based
 * seed/cleanup helpers for scenario templates.
 */

/**
 * Steamfitter-specific authentication helper.
 * @param page - Playwright Page object
 * @param username - Keycloak username (default: 'admin')
 * @param password - Keycloak password (default: 'admin')
 */
export async function authenticateSteamfitterWithKeycloak(
  page: Page,
  username: string = 'admin',
  password: string = 'admin'
): Promise<void> {
  await authenticateWithKeycloak(page, Services.Steamfitter.UI, username, password);
}

// ========================================================================
// API-based test data seeding and cleanup
// ========================================================================

/**
 * Module-level cache for the Steamfitter API token, keyed by nothing (this suite
 * only ever authenticates as admin/admin). Every seed/cleanup helper below opens
 * its own short-lived `APIRequestContext`, so without this cache a test calling
 * several helpers in sequence would pay for a Keycloak password-grant round trip
 * per call. `expiresAt` is read from the token's own `exp` claim, minus a 5s
 * safety margin so a token doesn't expire mid-request.
 */
let cachedToken: { token: string; expiresAt: number } | null = null;

function decodeJwtExpiryMs(token: string): number {
  const payload = token.split('.')[1];
  const { exp } = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
  return exp * 1000;
}

/**
 * Get a Keycloak access token for the Steamfitter API, reusing a cached token
 * until shortly before it expires.
 *
 * The API validates against the `steamfitter` scope/audience (see the API's
 * appsettings `AuthorizationScope: "steamfitter player player-vm"`), so request
 * those scopes here. The UI client id `steamfitter.ui` is a public client that
 * supports the resource-owner password grant in this dev environment.
 */
export async function getSteamfitterApiToken(apiContext: APIRequestContext): Promise<string> {
  if (cachedToken && cachedToken.expiresAt > Date.now()) {
    return cachedToken.token;
  }

  const tokenResponse = await apiContext.post(
    `${Services.Keycloak}/realms/crucible/protocol/openid-connect/token`,
    {
      form: {
        grant_type: 'password',
        client_id: 'steamfitter.ui',
        username: 'admin',
        password: 'admin',
        scope: 'openid profile steamfitter player player-vm',
      },
      ignoreHTTPSErrors: true,
    }
  );

  if (!tokenResponse.ok()) {
    throw new Error(
      `Failed to get Steamfitter API token: ${tokenResponse.status()} ${await tokenResponse.text()}`
    );
  }

  const data = await tokenResponse.json();
  cachedToken = { token: data.access_token, expiresAt: decodeJwtExpiryMs(data.access_token) - 5000 };
  return cachedToken.token;
}

/**
 * Seed a scenario template via the Steamfitter API.
 * Returns the created scenario template ID.
 *
 * Name/description must be at least 4 characters (the create dialog enforces a
 * `minlength` of 4); keep test names comfortably above that.
 */
export async function seedScenarioTemplate(
  name: string = `E2E Template ${Date.now()}`,
  description: string = 'E2E seeded scenario template',
  durationHours: number = 1
): Promise<string> {
  const apiContext = await pwRequest.newContext({ ignoreHTTPSErrors: true });
  try {
    const token = await getSteamfitterApiToken(apiContext);

    const response = await apiContext.post(`${Services.Steamfitter.API}/api/scenarioTemplates`, {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      data: {
        name,
        description,
        durationHours,
      },
    });

    if (!response.ok()) {
      throw new Error(
        `Failed to create scenario template: ${response.status()} ${await response.text()}`
      );
    }

    const template = await response.json();
    console.log(`API seed: Created scenario template "${name}" (${template.id})`);
    return template.id;
  } finally {
    await apiContext.dispose();
  }
}

/**
 * Delete a scenario template by ID via the Steamfitter API.
 * Treats 404 as success so cleanup is idempotent.
 */
export async function apiDeleteScenarioTemplate(scenarioTemplateId: string): Promise<void> {
  const apiContext = await pwRequest.newContext({ ignoreHTTPSErrors: true });
  try {
    const token = await getSteamfitterApiToken(apiContext);
    const response = await apiContext.delete(
      `${Services.Steamfitter.API}/api/scenarioTemplates/${scenarioTemplateId}`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    if (response.ok() || response.status() === 404) {
      console.log(`API cleanup: Deleted scenario template ${scenarioTemplateId}`);
    } else {
      console.warn(
        `API cleanup: Failed to delete scenario template ${scenarioTemplateId}: ${response.status()}`
      );
    }
  } finally {
    await apiContext.dispose();
  }
}

/**
 * Delete every scenario template whose name matches one of the given prefixes,
 * via the Steamfitter API. Used by afterEach/afterAll to clean up UI-created
 * templates (whose id the test may not have captured) by their well-known name.
 *
 * Matching is by name prefix so it only ever removes data this suite created;
 * real/operator templates are untouched. Returns the number removed.
 */
export async function deleteScenarioTemplatesByPrefix(
  prefixes: string[] = ['E2E ', 'Test Scenario Template', 'Updated Test Scenario Template']
): Promise<number> {
  const apiContext = await pwRequest.newContext({ ignoreHTTPSErrors: true });
  try {
    const token = await getSteamfitterApiToken(apiContext);
    const headers = { Authorization: `Bearer ${token}` };

    const listResponse = await apiContext.get(`${Services.Steamfitter.API}/api/scenarioTemplates`, {
      headers: { ...headers, Accept: 'application/json' },
    });
    if (!listResponse.ok()) {
      return 0;
    }

    const templates: Array<{ id: string; name: string }> = await listResponse.json();
    let removed = 0;
    for (const template of templates) {
      if (!prefixes.some((p) => (template.name ?? '').startsWith(p))) continue;
      const del = await apiContext
        .delete(`${Services.Steamfitter.API}/api/scenarioTemplates/${template.id}`, { headers })
        .catch(() => null);
      if (del && (del.ok() || del.status() === 404)) {
        removed++;
      } else if (del) {
        console.warn(
          `Cleanup: failed to delete scenario template "${template.name}" (${template.id}): ${del.status()}`
        );
      }
    }
    if (removed > 0) {
      console.log(`Cleanup: removed ${removed} scenario template(s) by name prefix`);
    }
    return removed;
  } finally {
    await apiContext.dispose();
  }
}

/**
 * Seed a task under a scenario template via the Steamfitter API. Returns the created
 * task ID.
 *
 * A task is the unit of work Steamfitter runs; the create dialog requires at least a
 * name, an action, and a trigger condition. We default to a benign `http_get`-style
 * shape (`http_post` with a placeholder URL) that persists without needing a live VM
 * or agent — enough for the UI list/edit/delete flows to exercise. Tasks cascade-
 * delete with their parent template, so cleanup is by deleting the template.
 */
export async function seedTask(
  scenarioTemplateId: string,
  name: string = `E2E Task ${Date.now()}`,
  description: string = 'E2E seeded task'
): Promise<string> {
  const apiContext = await pwRequest.newContext({ ignoreHTTPSErrors: true });
  try {
    const token = await getSteamfitterApiToken(apiContext);
    const response = await apiContext.post(`${Services.Steamfitter.API}/api/tasks`, {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      data: {
        name,
        description,
        scenarioTemplateId,
        action: 'http_post',
        apiUrl: 'http',
        actionParameters: {},
        triggerCondition: 'Manual',
        expectedOutput: '',
        delaySeconds: 0,
        intervalSeconds: 0,
        iterations: 1,
        iterationTermination: 'IterationCount',
        expirationSeconds: 0,
        vmMask: '',
        score: 0,
        userExecutable: false,
        repeatable: false,
      },
    });
    if (!response.ok()) {
      throw new Error(`Failed to create task: ${response.status()} ${await response.text()}`);
    }
    const task = await response.json();
    console.log(`API seed: Created task "${name}" (${task.id}) on template ${scenarioTemplateId}`);
    return task.id;
  } finally {
    await apiContext.dispose();
  }
}

// ========================================================================
// Player API integration (views) — optional dependency
// ========================================================================
//
// A scenario needs a Player *view* to be startable and to be edited through the UI
// dialog (the Save button is gated on a viewId). The Player API is a separate
// service that may or may not be running in a given environment, so view-dependent
// tests probe availability first and fall back to dependency-free assertions when
// Player is down.
//
// The view calls themselves live in `../player-helpers`, which owns every view
// create/delete in the suite. The two wrappers below exist only to keep the
// argument shape these specs already use — `createPlayerView(name)` returning an
// id, and `deletePlayerView(id)` — rather than threading a token through each
// spec, and to keep the "API seed:"/"API cleanup:" log lines that make a
// Steamfitter run readable. They do not re-implement anything.
//
// Note the token: `player-helpers` fetches its own via the `player.vm.api`
// password grant instead of reusing `getSteamfitterApiToken`. Both carry the
// `player` audience and both authenticate against the Player API, so the swap is
// invisible to a caller; it costs one extra Keycloak round trip per view, which
// is nothing against a browser test.

/**
 * Return true when the Player API is reachable and accepts a seeding token, so
 * view-dependent tests can decide whether to seed a real view or fall back to
 * dependency-free assertions. Never throws — any failure is treated as
 * "unavailable". Re-exported from `../player-helpers` so the probe and the
 * subsequent create use the same credentials.
 */
export { isPlayerApiAvailable } from '../player-helpers';

/**
 * Create a Player view and return its id. Used by view-dependent scenario tests;
 * pair every call with {@link deletePlayerView} in cleanup.
 */
export async function createPlayerView(
  name: string = `E2E View ${Date.now()}`,
  description: string = 'E2E seeded Player view'
): Promise<string> {
  const view = await createView(await getPlayerToken(), name, description);
  console.log(`API seed: Created Player view "${name}" (${view.id})`);
  return view.id;
}

/**
 * Delete a Player view by id. Treats 404 as success so cleanup is idempotent. Never
 * throws — cleanup must not mask a test failure.
 */
export async function deletePlayerView(viewId: string): Promise<void> {
  if (!viewId) return;
  try {
    // deleteView warns and resolves on a failed DELETE rather than throwing, so
    // the log has to follow its verdict — claiming a deletion that did not happen
    // sends the next person looking anywhere but at the leaked view.
    const deleted = await deleteView(await getPlayerToken(), viewId);
    console.log(
      deleted
        ? `API cleanup: Deleted Player view ${viewId}`
        : `API cleanup: Player view ${viewId} was NOT deleted and has leaked (see warning above)`
    );
  } catch (error) {
    // deleteView already swallows a failed DELETE (it warns); this catches the
    // token fetch, which would otherwise throw out of a teardown and replace the
    // test's real failure with its own.
    console.warn(`API cleanup: Failed to delete Player view ${viewId}: ${error}`);
  }
}

/**
 * Bind a Player view to an existing scenario via the Steamfitter API (PUT the
 * scenario with its viewId set). Returns the updated scenario. Used when a test
 * seeds a scenario and a view separately and then needs them linked so the scenario
 * is startable.
 */
export async function setScenarioView(scenarioId: string, viewId: string): Promise<void> {
  const apiContext = await pwRequest.newContext({ ignoreHTTPSErrors: true });
  try {
    const token = await getSteamfitterApiToken(apiContext);
    const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
    const getResp = await apiContext.get(`${Services.Steamfitter.API}/api/scenarios/${scenarioId}`, {
      headers: { ...headers, Accept: 'application/json' },
    });
    if (!getResp.ok()) {
      throw new Error(`Failed to load scenario ${scenarioId}: ${getResp.status()}`);
    }
    const scenario = await getResp.json();
    const putResp = await apiContext.put(`${Services.Steamfitter.API}/api/scenarios/${scenarioId}`, {
      headers,
      data: { ...scenario, viewId },
    });
    if (!putResp.ok()) {
      throw new Error(`Failed to bind view to scenario: ${putResp.status()} ${await putResp.text()}`);
    }
  } finally {
    await apiContext.dispose();
  }
}

/**
 * Seed a scenario via the Steamfitter API. Returns the created scenario ID.
 *
 * A scenario may be created standalone (name/description only) or bound to a
 * `scenarioTemplateId`. Name/description must be at least 4 characters. Optionally
 * bind a Player `viewId` so the scenario is startable (a scenario cannot start
 * without a view).
 */
export async function seedScenario(
  name: string = `E2E Scenario ${Date.now()}`,
  description: string = 'E2E seeded scenario',
  options: { scenarioTemplateId?: string; viewId?: string; durationHours?: number } = {}
): Promise<string> {
  const apiContext = await pwRequest.newContext({ ignoreHTTPSErrors: true });
  try {
    const token = await getSteamfitterApiToken(apiContext);
    const response = await apiContext.post(`${Services.Steamfitter.API}/api/scenarios`, {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      data: {
        name,
        description,
        scenarioTemplateId: options.scenarioTemplateId,
        viewId: options.viewId,
        durationHours: options.durationHours ?? 1,
      },
    });
    if (!response.ok()) {
      throw new Error(`Failed to create scenario: ${response.status()} ${await response.text()}`);
    }
    const scenario = await response.json();
    console.log(`API seed: Created scenario "${name}" (${scenario.id})`);
    return scenario.id;
  } finally {
    await apiContext.dispose();
  }
}

/**
 * Delete every scenario whose name matches one of the given prefixes, via the
 * Steamfitter API. An `active` scenario must be ended before it can be deleted, so
 * this ends-then-deletes. Matching is by name prefix so only suite-created data is
 * removed. Returns the number removed.
 */
export async function deleteScenariosByPrefix(
  prefixes: string[] = ['E2E ', 'Test Scenario', 'Updated Scenario', 'Original Scenario']
): Promise<number> {
  const apiContext = await pwRequest.newContext({ ignoreHTTPSErrors: true });
  try {
    const token = await getSteamfitterApiToken(apiContext);
    const headers = { Authorization: `Bearer ${token}` };

    const listResponse = await apiContext.get(`${Services.Steamfitter.API}/api/scenarios`, {
      headers: { ...headers, Accept: 'application/json' },
    });
    if (!listResponse.ok()) {
      return 0;
    }

    const scenarios: Array<{ id: string; name: string; status?: string }> = await listResponse.json();
    let removed = 0;
    for (const scenario of scenarios) {
      if (!prefixes.some((p) => (scenario.name ?? '').startsWith(p))) continue;
      // End first if active/paused so the delete is allowed; ignore the result
      // (already-ended scenarios return non-2xx and that's fine).
      if (scenario.status && scenario.status !== 'ready' && scenario.status !== 'ended') {
        await apiContext
          .put(`${Services.Steamfitter.API}/api/scenarios/${scenario.id}/end`, { headers })
          .catch(() => null);
      }
      const del = await apiContext
        .delete(`${Services.Steamfitter.API}/api/scenarios/${scenario.id}`, { headers })
        .catch(() => null);
      if (del && (del.ok() || del.status() === 404)) {
        removed++;
      } else if (del) {
        console.warn(
          `Cleanup: failed to delete scenario "${scenario.name}" (${scenario.id}): ${del.status()}`
        );
      }
    }
    if (removed > 0) {
      console.log(`Cleanup: removed ${removed} scenario(s) by name prefix`);
    }
    return removed;
  } finally {
    await apiContext.dispose();
  }
}

// ========================================================================
// Admin RBAC (users / groups / system roles) — Steamfitter API
// ========================================================================
//
// Users, groups, and system roles are all served by Steamfitter's own API
// (`/api/users`, `/api/groups`, `/api/system-roles`), not a separate identity
// service, so the same Steamfitter token authorizes these. The admin UI reaches them
// at `/admin?section=Users|Groups|Roles`. A user needs a valid GUID id on create; a
// role is assigned to a user by PUTting the user with `roleId` set.

/**
 * Create a user via the Steamfitter API. Returns the created user's id. The API
 * requires the caller to supply the id (a GUID) and a name of at least 4 characters,
 * mirroring the admin "Add User" inline form. Pass an explicit `id` when a test needs
 * to know it up front; otherwise a fresh GUID is generated.
 */
export async function seedUser(
  name: string = `E2E User ${Date.now()}`,
  id: string = randomUUID()
): Promise<string> {
  const apiContext = await pwRequest.newContext({ ignoreHTTPSErrors: true });
  try {
    const token = await getSteamfitterApiToken(apiContext);
    const response = await apiContext.post(`${Services.Steamfitter.API}/api/users`, {
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      data: { id, name },
    });
    if (!response.ok()) {
      throw new Error(`Failed to create user: ${response.status()} ${await response.text()}`);
    }
    console.log(`API seed: Created user "${name}" (${id})`);
    return id;
  } finally {
    await apiContext.dispose();
  }
}

/**
 * Delete every user whose name matches one of the given prefixes, via the Steamfitter
 * API. Matching is by name prefix so only suite-created users are removed; the seeded
 * admin/operator users are untouched. Returns the number removed.
 */
export async function deleteUsersByPrefix(prefixes: string[] = ['E2E ']): Promise<number> {
  const apiContext = await pwRequest.newContext({ ignoreHTTPSErrors: true });
  try {
    const token = await getSteamfitterApiToken(apiContext);
    const headers = { Authorization: `Bearer ${token}` };
    const listResponse = await apiContext.get(`${Services.Steamfitter.API}/api/users`, {
      headers: { ...headers, Accept: 'application/json' },
    });
    if (!listResponse.ok()) {
      return 0;
    }
    const users: Array<{ id: string; name: string }> = await listResponse.json();
    let removed = 0;
    for (const user of users) {
      if (!prefixes.some((p) => (user.name ?? '').startsWith(p))) continue;
      const del = await apiContext
        .delete(`${Services.Steamfitter.API}/api/users/${user.id}`, { headers })
        .catch(() => null);
      if (del && (del.ok() || del.status() === 404)) {
        removed++;
      } else if (del) {
        console.warn(`Cleanup: failed to delete user "${user.name}" (${user.id}): ${del.status()}`);
      }
    }
    if (removed > 0) {
      console.log(`Cleanup: removed ${removed} user(s) by name prefix`);
    }
    return removed;
  } finally {
    await apiContext.dispose();
  }
}

/**
 * Return the list of system roles ({@link Services.Steamfitter}'s `/api/system-roles`),
 * each with `id`, `name`, `allPermissions`, `immutable`, and `permissions`. Useful for
 * resolving a built-in role's id (e.g. "ContentDeveloper") when a test assigns it.
 */
export async function getSystemRoles(): Promise<
  Array<{ id: string; name: string; allPermissions: boolean; immutable: boolean; permissions: string[] }>
> {
  const apiContext = await pwRequest.newContext({ ignoreHTTPSErrors: true });
  try {
    const token = await getSteamfitterApiToken(apiContext);
    const response = await apiContext.get(`${Services.Steamfitter.API}/api/system-roles`, {
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
    });
    if (!response.ok()) {
      throw new Error(`Failed to list system roles: ${response.status()}`);
    }
    return response.json();
  } finally {
    await apiContext.dispose();
  }
}

/**
 * Create a group via the Steamfitter API. Returns the created group's id. Groups need
 * only a name.
 */
export async function seedGroup(name: string = `E2E Group ${Date.now()}`): Promise<string> {
  const apiContext = await pwRequest.newContext({ ignoreHTTPSErrors: true });
  try {
    const token = await getSteamfitterApiToken(apiContext);
    const response = await apiContext.post(`${Services.Steamfitter.API}/api/groups`, {
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      data: { name },
    });
    if (!response.ok()) {
      throw new Error(`Failed to create group: ${response.status()} ${await response.text()}`);
    }
    const group = await response.json();
    console.log(`API seed: Created group "${name}" (${group.id})`);
    return group.id;
  } finally {
    await apiContext.dispose();
  }
}

/**
 * Add a user to a group via the Steamfitter API (POST a membership). Returns the
 * created membership id (needed to remove the member).
 */
export async function seedGroupMembership(groupId: string, userId: string): Promise<string> {
  const apiContext = await pwRequest.newContext({ ignoreHTTPSErrors: true });
  try {
    const token = await getSteamfitterApiToken(apiContext);
    const response = await apiContext.post(
      `${Services.Steamfitter.API}/api/groups/${groupId}/memberships`,
      {
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        data: { groupId, userId },
      }
    );
    if (!response.ok()) {
      throw new Error(`Failed to add group membership: ${response.status()} ${await response.text()}`);
    }
    const membership = await response.json();
    console.log(`API seed: Added user ${userId} to group ${groupId} (membership ${membership.id})`);
    return membership.id;
  } finally {
    await apiContext.dispose();
  }
}

/**
 * Delete every group whose name matches one of the given prefixes, via the
 * Steamfitter API. Deleting a group cascades its memberships. Returns the number
 * removed.
 */
export async function deleteGroupsByPrefix(prefixes: string[] = ['E2E ']): Promise<number> {
  const apiContext = await pwRequest.newContext({ ignoreHTTPSErrors: true });
  try {
    const token = await getSteamfitterApiToken(apiContext);
    const headers = { Authorization: `Bearer ${token}` };
    const listResponse = await apiContext.get(`${Services.Steamfitter.API}/api/groups`, {
      headers: { ...headers, Accept: 'application/json' },
    });
    if (!listResponse.ok()) {
      return 0;
    }
    const groups: Array<{ id: string; name: string }> = await listResponse.json();
    let removed = 0;
    for (const group of groups) {
      if (!prefixes.some((p) => (group.name ?? '').startsWith(p))) continue;
      const del = await apiContext
        .delete(`${Services.Steamfitter.API}/api/groups/${group.id}`, { headers })
        .catch(() => null);
      if (del && (del.ok() || del.status() === 404)) {
        removed++;
      } else if (del) {
        console.warn(`Cleanup: failed to delete group "${group.name}" (${group.id}): ${del.status()}`);
      }
    }
    if (removed > 0) {
      console.log(`Cleanup: removed ${removed} group(s) by name prefix`);
    }
    return removed;
  } finally {
    await apiContext.dispose();
  }
}

/**
 * Create a custom system role via the Steamfitter API. Returns the created role's id.
 * Custom roles are mutable (the built-in Administrator/ContentDeveloper/Observer roles
 * are `immutable` and can't be edited or deleted). Roles need only a name on create.
 */
export async function seedSystemRole(name: string = `E2E Role ${Date.now()}`): Promise<string> {
  const apiContext = await pwRequest.newContext({ ignoreHTTPSErrors: true });
  try {
    const token = await getSteamfitterApiToken(apiContext);
    const response = await apiContext.post(`${Services.Steamfitter.API}/api/system-roles`, {
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      data: { name },
    });
    if (!response.ok()) {
      throw new Error(`Failed to create system role: ${response.status()} ${await response.text()}`);
    }
    const role = await response.json();
    console.log(`API seed: Created system role "${name}" (${role.id})`);
    return role.id;
  } finally {
    await apiContext.dispose();
  }
}

/**
 * Delete every non-immutable system role whose name matches one of the given
 * prefixes, via the Steamfitter API. The built-in roles are `immutable` and skipped
 * regardless. Returns the number removed.
 */
export async function deleteSystemRolesByPrefix(prefixes: string[] = ['E2E ']): Promise<number> {
  const apiContext = await pwRequest.newContext({ ignoreHTTPSErrors: true });
  try {
    const token = await getSteamfitterApiToken(apiContext);
    const headers = { Authorization: `Bearer ${token}` };
    const listResponse = await apiContext.get(`${Services.Steamfitter.API}/api/system-roles`, {
      headers: { ...headers, Accept: 'application/json' },
    });
    if (!listResponse.ok()) {
      return 0;
    }
    const roles: Array<{ id: string; name: string; immutable: boolean }> = await listResponse.json();
    let removed = 0;
    for (const role of roles) {
      if (role.immutable) continue;
      if (!prefixes.some((p) => (role.name ?? '').startsWith(p))) continue;
      const del = await apiContext
        .delete(`${Services.Steamfitter.API}/api/system-roles/${role.id}`, { headers })
        .catch(() => null);
      if (del && (del.ok() || del.status() === 404)) {
        removed++;
      } else if (del) {
        console.warn(`Cleanup: failed to delete system role "${role.name}" (${role.id}): ${del.status()}`);
      }
    }
    if (removed > 0) {
      console.log(`Cleanup: removed ${removed} system role(s) by name prefix`);
    }
    return removed;
  } finally {
    await apiContext.dispose();
  }
}

/**
 * Suite-wide backstop purge, called by global-teardown.ts. Removes any scenarios,
 * scenario templates, and admin RBAC objects (users, groups, custom roles) left
 * behind by name prefix so the database never accumulates leftovers across runs.
 * Scenarios are purged before templates because a scenario may reference a template.
 * This does NOT replace per-test cleanup (see CLAUDE.md "Test data hygiene") — it only
 * catches tests that crashed before their own afterEach ran.
 */
export async function purgeAllSteamfitterTestData(): Promise<void> {
  const scenarios = await deleteScenariosByPrefix();
  const templates = await deleteScenarioTemplatesByPrefix();
  const users = await deleteUsersByPrefix();
  const groups = await deleteGroupsByPrefix();
  const roles = await deleteSystemRolesByPrefix();
  console.log(
    `[steamfitter purge] Removed ${scenarios} leftover scenario(s), ${templates} scenario template(s), ` +
      `${users} user(s), ${groups} group(s), and ${roles} custom role(s).`
  );
}

/**
 * Steamfitter-specific fixtures.
 */
export type SteamfitterFixtures = {
  steamfitterAuthenticatedPage: Page;
};

/**
 * Path to the Steamfitter storageState saved by global-setup.ts. May not exist if
 * global setup failed to provision (stack down at startup) — handled below.
 */
const steamfitterStatePath = authStatePath('steamfitter');

/**
 * True when global-setup successfully wrote the Steamfitter auth state this run.
 * Evaluated once at module load. Specs that want a clean unauthenticated context
 * still override this with `test.use({ storageState: { cookies: [], origins: [] } })`.
 */
const steamfitterStateExists = fs.existsSync(steamfitterStatePath);

/**
 * Extended test with Steamfitter-specific fixtures.
 *
 * `storageState` defaults to the pre-authenticated state captured once by
 * global-setup.ts, so every spec's browser context starts with a valid OIDC token.
 * The `steamfitterAuthenticatedPage` fixture then just navigates and waits for the
 * Angular shell — no per-test Keycloak round-trip. Auth-flow specs opt out with
 * `test.use({ storageState: { cookies: [], origins: [] } })`.
 */
export const test = base.extend<SteamfitterFixtures>({
  storageState: steamfitterStateExists ? steamfitterStatePath : undefined,

  steamfitterAuthenticatedPage: async ({ page }, use) => {
    // Fast path: storageState already carries a valid token, so navigating home
    // should render the authenticated shell without redirecting to Keycloak.
    await page.goto(Services.Steamfitter.UI, { waitUntil: 'domcontentloaded' });

    // Match global-setup.ts's PROVISION entry: only app-topbar's mat-toolbar renders
    // once the OIDC client has resolved a user, so it's the reliable auth signal.
    const appShell = page.locator('app-root app-topbar mat-toolbar').first();
    const keycloakField = page.locator('input[name="username"]');

    // Race the authenticated shell against a Keycloak login form. The form appears
    // only if the saved state is missing/expired — in that case fall back to a full
    // interactive login. waitForFirstVisible is cancellation-safe (a bare
    // Promise.race would leave the losing waitFor() running to its full timeout).
    const winner = await waitForFirstVisible(
      page,
      [
        { key: 'shell', locator: appShell },
        { key: 'keycloak', locator: keycloakField },
      ],
      { timeout: 20000 }
    );

    if (winner !== 'shell') {
      await authenticateSteamfitterWithKeycloak(page);
      await appShell.waitFor({ state: 'visible', timeout: 30000 });
    }

    await use(page);
  },
});

export { expect } from '@playwright/test';
export { Services, serviceUrlPattern, oidcStorageKey, waitForFirstVisible, settleForResponse };
