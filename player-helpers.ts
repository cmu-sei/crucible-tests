// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

/**
 * Player API helpers for tests across Crucible apps.
 *
 * Lives at the repo root because a Player *view* is the precondition for most of
 * the Player family: the Player VM UI keys everything off a view id, the Console
 * UI resolves a VM that belongs to a view's team, and Steamfitter can only start
 * a scenario that is bound to one. Tests that need a view create one here,
 * exercise the scenario, then delete it — never discover an existing view, which
 * makes a test silently dependent on whatever the environment happens to hold.
 *
 * `POST /api/views` with `createAdminTeam: true` (the default) does four things
 * in one call, which is why view creation is all the seeding most specs need:
 *   1. creates the view,
 *   2. creates an "Admin" team in it with the view-creator team role,
 *   3. adds the calling user to that team, and
 *   4. makes that membership the caller's *primary* team for the view.
 * The primary team matters: the VM UI's map page renders "View Not Found" when
 * `getPrimaryTeamId` comes back empty, so a view without one looks like a
 * missing view.
 *
 * This is the only place in the suite that POSTs or DELETEs a view.
 * `player/fixtures.ts` and `steamfitter/fixtures.ts` used to carry their own
 * copies and now call these; `steamfitter/fixtures.ts` keeps thin wrappers that
 * adapt the signatures its specs already use. Add to this file rather than
 * growing a second copy somewhere else.
 */

import { APIRequestContext, request as playwrightRequest } from '@playwright/test';
import { Services } from './shared-fixtures';

/**
 * The Keycloak client used for API-level seeding.
 *
 * `player.api` and `player.ui` are browser clients with direct access grants
 * *disabled*, so neither can do a password grant. `player.vm.api` can, and its
 * default scopes include both `player` and `player-vm` — each of which
 * contributes its own audience — so one token is accepted by the Player API and
 * the Player VM API alike. That is what lets `player-helpers` and
 * `playerVm/vm-helpers` share a token instead of fetching one each.
 */
const SEEDING_CLIENT_ID = 'player.vm.api';
const SEEDING_SCOPE = 'openid profile player player-vm';

async function newContext(): Promise<APIRequestContext> {
  return playwrightRequest.newContext({ ignoreHTTPSErrors: true });
}

/**
 * Acquire a bearer token that both the Player API and the Player VM API accept.
 * Default credentials are `admin`/`admin`, the seed Keycloak user holding the
 * `Administrator` realm role (which Player maps to a role with every system
 * permission, so the caller can create views and manage their teams).
 */
export async function getPlayerToken(
  username: string = 'admin',
  password: string = 'admin'
): Promise<string> {
  const keycloak = Services.Keycloak.replace(/\/$/, '');
  const ctx = await newContext();
  try {
    const res = await ctx.post(`${keycloak}/realms/crucible/protocol/openid-connect/token`, {
      form: {
        client_id: SEEDING_CLIENT_ID,
        grant_type: 'password',
        username,
        password,
        scope: SEEDING_SCOPE,
      },
    });
    if (!res.ok()) {
      throw new Error(`Player token request failed for ${username} (${res.status()}): ${await res.text()}`);
    }
    const data = await res.json();
    return data.access_token as string;
  } finally {
    await ctx.dispose();
  }
}

function authHeaders(token: string): Record<string, string> {
  return {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
    Accept: 'application/json',
  };
}

async function playerCall<T = any>(
  token: string,
  path: string,
  opts: { method?: 'GET' | 'POST' | 'PUT' | 'DELETE'; body?: unknown } = {}
): Promise<{ ok: boolean; status: number; data: T; text: string }> {
  const base = Services.Player.API.replace(/\/$/, '');
  const ctx = await newContext();
  try {
    const res = await ctx.fetch(`${base}${path}`, {
      method: opts.method ?? 'GET',
      headers: authHeaders(token),
      data: opts.body,
    });
    const text = await res.text();
    let data: any;
    try {
      data = text ? JSON.parse(text) : undefined;
    } catch {
      /* non-JSON body (an error page, say) — callers get `text` instead */
    }
    return { ok: res.ok(), status: res.status(), data, text };
  } finally {
    await ctx.dispose();
  }
}

export interface PlayerView {
  id: string;
  name: string;
}

export interface PlayerTeam {
  id: string;
  name: string;
}

/**
 * Create an active, non-template Player view owned by the caller.
 *
 * Names are not unique in Player, so this deliberately does *not* reuse an
 * existing view with the same name: a per-test view is what keeps assertions
 * deterministic (a freshly created view has no maps and no VMs, which several
 * specs assert on). Pair every call with {@link deleteView} in teardown.
 */
export async function createView(
  token: string,
  name: string,
  description: string = `E2E seed data — ${name}`
): Promise<PlayerView> {
  const r = await playerCall<PlayerView>(token, '/api/views', {
    method: 'POST',
    body: {
      name,
      description,
      status: 'Active',
      isTemplate: false,
      createAdminTeam: true,
    },
  });
  if (!r.ok) {
    throw new Error(`createView failed for "${name}" (${r.status}): ${r.text}`);
  }
  return r.data;
}

/**
 * Delete a view and everything Player cascades from it (teams, memberships).
 * Tolerates 404 so it is safe to call from a `finally` that may run after the
 * view is already gone. Cleanup failures are warnings, not throws: a teardown
 * that throws replaces the test's real failure with its own.
 */
export async function deleteView(token: string, viewId: string): Promise<void> {
  const r = await playerCall(token, `/api/views/${viewId}`, { method: 'DELETE' });
  if (!r.ok && r.status !== 404) {
    console.warn(`deleteView failed for ${viewId} (${r.status}): ${r.text}`);
  }
}

/**
 * The view's teams, in the order the API returns them. A view created by
 * {@link createView} has exactly one — "Admin", with the caller in it — so
 * `(await getViewTeams(token, viewId))[0]` is the team to hang seeded VMs off.
 */
export async function getViewTeams(token: string, viewId: string): Promise<PlayerTeam[]> {
  const r = await playerCall<PlayerTeam[]>(token, `/api/views/${viewId}/teams`);
  if (!r.ok) {
    throw new Error(`getViewTeams failed for ${viewId} (${r.status}): ${r.text}`);
  }
  return r.data;
}

/** Create an additional team in an existing view. */
export async function createTeam(token: string, viewId: string, name: string): Promise<PlayerTeam> {
  const r = await playerCall<PlayerTeam>(token, `/api/views/${viewId}/teams`, {
    method: 'POST',
    body: { name },
  });
  if (!r.ok) {
    throw new Error(`createTeam failed for "${name}" in view ${viewId} (${r.status}): ${r.text}`);
  }
  return r.data;
}

export interface PlayerUser {
  id: string;
  name: string;
}

/**
 * Player's own user records — not Keycloak's. A user appears here the first time
 * they present a token (`UserClaimsService.ValidateUser` provisions them), so the
 * caller is always present; other users are only listed once they have signed in.
 * `name` is the display name, e.g. "Admin User" for the seed `admin` account.
 */
export async function getUsers(token: string): Promise<PlayerUser[]> {
  const r = await playerCall<PlayerUser[]>(token, '/api/users');
  if (!r.ok) {
    throw new Error(`getUsers failed (${r.status}): ${r.text}`);
  }
  return r.data;
}

/**
 * Add a user to a team. The team must belong to a view the caller can manage, and
 * the user must already exist in Player (see {@link getUsers}).
 */
export async function addUserToTeam(token: string, teamId: string, userId: string): Promise<void> {
  const r = await playerCall(token, `/api/teams/${teamId}/users/${userId}`, { method: 'POST' });
  if (!r.ok) {
    throw new Error(`addUserToTeam failed for user ${userId} on team ${teamId} (${r.status}): ${r.text}`);
  }
}

/**
 * Return true when the Player API is reachable and accepts a seeding token.
 *
 * Player is an optional service in some deployments, so a test whose
 * precondition is "Player is up" probes with this and then hands the result to
 * `requirePrecondition` — which skips locally but fails under CI, where the full
 * stack is supposed to be running. Never throws; any failure reads as
 * "unavailable".
 */
export async function isPlayerApiAvailable(): Promise<boolean> {
  try {
    const token = await getPlayerToken();
    const r = await playerCall(token, '/api/views');
    return r.ok;
  } catch {
    return false;
  }
}
