// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

/**
 * Gameboard API helpers for self-contained tests.
 *
 * Tests that require resources (games, sponsors, players) create them here,
 * exercise the UI, then clean up in a test.afterEach / finally block.
 *
 * These helpers use Playwright's built-in APIRequestContext, which honors
 * `ignoreHTTPSErrors: true` from playwright.config.ts — necessary because
 * Keycloak presents a self-signed cert on https://localhost:8443.
 */

import { APIRequestContext, request as playwrightRequest } from '@playwright/test';
import { Services } from './fixtures';

// The Gameboard API listens on a dynamic Aspire-assigned port (currently 5002).
// The .env file's GAMEBOARD_API_URL may point at a legacy port (4203) that
// isn't actually served. We check connectivity at startup and pick the first
// reachable URL from a known list.
export const GAMEBOARD_API_CANDIDATES = [
  process.env.GAMEBOARD_API_URL?.replace(/\/$/, ''),
  'http://localhost:5002',
  'http://localhost:4203',
].filter((x): x is string => !!x);

let _resolvedApiBase: string | null = null;
async function resolveApiBase(): Promise<string> {
  if (_resolvedApiBase) return _resolvedApiBase;
  const ctx = await playwrightRequest.newContext({ ignoreHTTPSErrors: true });
  try {
    for (const candidate of GAMEBOARD_API_CANDIDATES) {
      try {
        const res = await ctx.fetch(`${candidate}/api/games`, { timeout: 3000 });
        if (res.ok()) {
          _resolvedApiBase = candidate;
          return candidate;
        }
      } catch { /* try next */ }
    }
  } finally {
    await ctx.dispose();
  }
  throw new Error(
    `Could not reach Gameboard API at any of: ${GAMEBOARD_API_CANDIDATES.join(', ')}`
  );
}

export const GAMEBOARD_API = 'http://localhost:5002'; // legacy export (prefer resolveApiBase)

async function newRequestContext(): Promise<APIRequestContext> {
  return playwrightRequest.newContext({ ignoreHTTPSErrors: true });
}

export async function getAdminToken(
  username: string = 'admin',
  password: string = 'admin'
): Promise<string> {
  const ctx = await newRequestContext();
  let token: string;
  try {
    const keycloak = Services.Keycloak.replace(/\/$/, '');
    const res = await ctx.post(
      `${keycloak}/realms/crucible/protocol/openid-connect/token`,
      {
        form: {
          client_id: 'gameboard.ui',
          grant_type: 'password',
          username,
          password,
          scope: 'openid profile gameboard',
        },
      }
    );
    if (!res.ok()) {
      throw new Error(`Keycloak token request failed (${res.status()}): ${await res.text()}`);
    }
    const data = await res.json();
    token = data.access_token as string;
  } finally {
    await ctx.dispose();
  }
  // Ensure the Gameboard Users row for admin exists. Gameboard JIT-provisions
  // users on first UI login (Angular calls POST /api/user after Keycloak),
  // so tests that only hit the API before any UI navigation race against
  // that — /api/users returns an empty list and enrollment calls throw
  // InvalidOperation from EF's SingleAsync. Hitting POST /api/user here is
  // idempotent and guarantees the row exists for downstream helpers.
  await ensureAdminProvisioned(token);
  return token;
}

function decodeJwtSub(token: string): string {
  const payload = JSON.parse(
    Buffer.from(token.split('.')[1], 'base64url').toString('utf8')
  );
  return payload.sub as string;
}

let _adminProvisioned = false;
async function ensureAdminProvisioned(token: string): Promise<void> {
  if (_adminProvisioned) return;
  const userId = decodeJwtSub(token);
  const res = await apiCall(token, '/api/user', {
    method: 'POST',
    body: { id: userId },
  });
  // 200 OK (new or existing), 409 Conflict, or 400 "AlreadyExists"/similar all
  // indicate the row now exists. Only fail on real errors.
  if (!res.ok && res.status !== 409) {
    // Re-check by id; if Retrieve works, we're fine.
    const check = await apiCall(token, `/api/user/${userId}`);
    if (!check.ok) {
      throw new Error(
        `Could not provision admin Gameboard user (POST ${res.status}: ${res.text}; GET ${check.status}: ${check.text})`
      );
    }
  }
  _adminProvisioned = true;
}

interface ApiCallOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  body?: any;
}

async function apiCall<T = any>(
  token: string,
  path: string,
  opts: ApiCallOptions = {}
): Promise<{ ok: boolean; status: number; data: T; text: string }> {
  const base = await resolveApiBase();
  const ctx = await newRequestContext();
  try {
    const res = await ctx.fetch(`${base}${path}`, {
      method: opts.method ?? 'GET',
      headers: { Authorization: `Bearer ${token}` },
      data: opts.body,
    });
    const text = await res.text();
    let data: any = undefined;
    try { data = text ? JSON.parse(text) : undefined; } catch { /* non-JSON */ }
    return { ok: res.ok(), status: res.status(), data, text };
  } finally {
    await ctx.dispose();
  }
}

export interface CreatedGame {
  id: string;
  name: string;
}

export interface CreateGameOptions {
  name?: string;
  playerMode?: 'competition' | 'practice';
  openRegistration?: boolean;
  maxTeamSize?: number;
  isPublished?: boolean;
  startOffsetDays?: number;
  endOffsetDays?: number;
  competition?: string;
  season?: string;
  track?: string;
  division?: string;
}

export async function createGame(
  token: string,
  opts: CreateGameOptions = {}
): Promise<CreatedGame> {
  const name = opts.name ?? `TestGame-${Date.now()}-${Math.floor(Math.random() * 1_000_000)}`;
  const start = new Date(Date.now() + (opts.startOffsetDays ?? -1) * 86_400_000);
  const end = new Date(Date.now() + (opts.endOffsetDays ?? 30) * 86_400_000);
  const regOpen = new Date(Date.now() - 7 * 86_400_000);
  const regClose = new Date(Date.now() + 30 * 86_400_000);

  const body = {
    name,
    competition: opts.competition ?? 'Automated Test Competition',
    season: opts.season ?? 'Test Season',
    track: opts.track ?? 'Test Track',
    division: opts.division ?? 'Open',
    gameMarkdown: 'Automated test game. Will be deleted after the test.',
    registrationMarkdown: 'Automated test game registration.',
    gameStart: start.toISOString(),
    gameEnd: end.toISOString(),
    registrationOpen: regOpen.toISOString(),
    registrationClose: regClose.toISOString(),
    registrationType: opts.openRegistration === false ? 'none' : 'open',
    maxAttempts: 3,
    minTeamSize: 1,
    maxTeamSize: opts.maxTeamSize ?? 1,
    sessionMinutes: 60,
    sessionLimit: 0,
    gamespaceLimitPerSession: 2,
    isPublished: opts.isPublished ?? true,
    allowPreview: true,
    allowReset: true,
    allowLateStart: true,
    allowPublicScoreboardAccess: true,
    mode: 'vm',
    playerMode: opts.playerMode === 'practice' ? 1 : 0,
    cardText1: 'Test',
    cardText2: 'Auto',
    cardText3: '',
    showOnHomePageInPracticeMode: opts.playerMode === 'practice',
  };

  const r = await apiCall<any>(token, '/api/game', { method: 'POST', body });
  if (!r.ok) throw new Error(`Failed to create game (${r.status}): ${r.text}`);
  return { id: r.data.id, name: r.data.name };
}

export async function deleteGame(token: string, gameId: string): Promise<void> {
  const r = await apiCall(token, `/api/game/${gameId}`, {
    method: 'DELETE',
    body: { allowPlayerDeletion: true },
  });
  if (!r.ok && r.status !== 404) {
    console.warn(`deleteGame(${gameId}) returned ${r.status}`);
  }
}

export interface CreatedSponsor {
  id: string;
  name: string;
}

export async function createSponsor(
  token: string,
  name?: string
): Promise<CreatedSponsor> {
  const r = await apiCall<any>(token, '/api/sponsor', {
    method: 'POST',
    body: { name: name ?? `TestSponsor-${Date.now()}`, parentSponsorId: null },
  });
  if (!r.ok) throw new Error(`Failed to create sponsor (${r.status}): ${r.text}`);
  return { id: r.data.id, name: r.data.name };
}

export async function deleteSponsor(token: string, sponsorId: string): Promise<void> {
  const r = await apiCall(token, `/api/sponsor/${sponsorId}`, { method: 'DELETE' });
  if (!r.ok && r.status !== 404) {
    console.warn(`deleteSponsor(${sponsorId}) returned ${r.status}`);
  }
}

export interface CreatedPlayer {
  id: string;
  gameId: string;
  userId: string;
  teamId: string;
  approvedName: string;
  role: string;
}

export async function getAdminUserId(token: string): Promise<string> {
  // Admin's Gameboard id matches the Keycloak `sub` claim — it's the OIDC
  // subject, not a row id assigned at JIT time. Reading the token is faster
  // than paging /api/users (which can grow to hundreds of rows in a shared
  // dev DB) and avoids the race where admin hasn't JIT-provisioned yet.
  return decodeJwtSub(token);
}

export async function enrollAdmin(
  token: string,
  gameId: string
): Promise<CreatedPlayer> {
  const userId = await getAdminUserId(token);
  const r = await apiCall<any>(token, '/api/player', {
    method: 'POST',
    body: { userId, gameId },
  });
  if (!r.ok) throw new Error(`Failed to enroll admin (${r.status}): ${r.text}`);
  return {
    id: r.data.id,
    gameId: r.data.gameId,
    userId: r.data.userId,
    teamId: r.data.teamId,
    approvedName: r.data.approvedName,
    role: r.data.role,
  };
}

export async function deletePlayer(token: string, playerId: string): Promise<void> {
  const r = await apiCall(token, `/api/player/${playerId}`, { method: 'DELETE' });
  if (!r.ok && r.status !== 404) {
    console.warn(`deletePlayer(${playerId}) returned ${r.status}`);
  }
}

/**
 * Set the admin user's sponsor. Returns the previous sponsor id so the caller
 * can restore it in a teardown block.
 */
export async function setAdminSponsor(
  token: string,
  sponsorId: string
): Promise<{ userId: string; previousSponsorId: string }> {
  const userId = decodeJwtSub(token);
  // Retrieve the current sponsor via /api/user/{id} — lighter than paging
  // /api/users and works even when the user was just JIT-provisioned.
  const current = await apiCall<any>(token, `/api/user/${userId}`);
  if (!current.ok) throw new Error(`Failed to retrieve admin user (${current.status}): ${current.text}`);
  const prev = current.data?.sponsor?.id ?? 'other';
  const r = await apiCall(token, '/api/user', {
    method: 'PUT',
    body: { id: userId, sponsorId },
  });
  if (!r.ok) throw new Error(`Failed to set admin sponsor (${r.status}): ${r.text}`);
  return { userId, previousSponsorId: prev };
}

// -----------------------------------------------------------------------------
// Sponsor avatar, sub-sponsor, image-upload, challenge-spec helpers.
// All helpers below use Playwright's APIRequestContext so multipart uploads
// honor the same ignoreHTTPSErrors setting as the browser.
// -----------------------------------------------------------------------------

/**
 * Create a sponsor with a specified parent sponsor id. Useful for testing the
 * parent/child sponsor hierarchy (e.g. "Department of Defense" → "Navy").
 */
export async function createSubSponsor(
  token: string,
  parentSponsorId: string,
  name?: string
): Promise<CreatedSponsor> {
  const r = await apiCall<any>(token, '/api/sponsor', {
    method: 'POST',
    body: {
      name: name ?? `TestSubSponsor-${Date.now()}`,
      parentSponsorId,
    },
  });
  if (!r.ok) throw new Error(`createSubSponsor failed (${r.status}): ${r.text}`);
  return { id: r.data.id, name: r.data.name };
}

/**
 * Upload an avatar image for a sponsor (PUT /api/sponsor/{id}/avatar with
 * multipart form data). Accepts raw bytes plus a filename — Gameboard
 * preserves the file extension so callers should provide e.g. `.svg` / `.png`.
 */
export async function uploadSponsorAvatar(
  token: string,
  sponsorId: string,
  fileBytes: Buffer,
  filename: string,
  mimeType: string = filename.endsWith('.svg') ? 'image/svg+xml' : 'image/png'
): Promise<void> {
  const base = await resolveApiBase();
  const ctx = await newRequestContext();
  try {
    const res = await ctx.fetch(`${base}/api/sponsor/${sponsorId}/avatar`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${token}` },
      multipart: {
        avatarFile: {
          name: filename,
          mimeType,
          buffer: fileBytes,
        },
      },
    });
    if (!res.ok()) {
      throw new Error(`uploadSponsorAvatar failed (${res.status()}): ${await res.text()}`);
    }
  } finally {
    await ctx.dispose();
  }
}

/**
 * Upload the card (logo) image for a game via POST /api/game/{id}/image/card.
 */
export async function uploadGameCardImage(
  token: string,
  gameId: string,
  fileBytes: Buffer,
  filename: string,
  mimeType: string = filename.endsWith('.svg') ? 'image/svg+xml' : 'image/png'
): Promise<void> {
  const base = await resolveApiBase();
  const ctx = await newRequestContext();
  try {
    const res = await ctx.fetch(`${base}/api/game/${gameId}/image/card`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      multipart: {
        file: { name: filename, mimeType, buffer: fileBytes },
      },
    });
    if (!res.ok()) {
      throw new Error(`uploadGameCardImage failed (${res.status()}): ${await res.text()}`);
    }
  } finally {
    await ctx.dispose();
  }
}

/**
 * Upload the map (background) image for a game via POST /api/game/{id}/image/map.
 */
export async function uploadGameMapImage(
  token: string,
  gameId: string,
  fileBytes: Buffer,
  filename: string,
  mimeType: string = filename.endsWith('.svg') ? 'image/svg+xml' : 'image/png'
): Promise<void> {
  const base = await resolveApiBase();
  const ctx = await newRequestContext();
  try {
    const res = await ctx.fetch(`${base}/api/game/${gameId}/image/map`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      multipart: {
        file: { name: filename, mimeType, buffer: fileBytes },
      },
    });
    if (!res.ok()) {
      throw new Error(`uploadGameMapImage failed (${res.status()}): ${await res.text()}`);
    }
  } finally {
    await ctx.dispose();
  }
}

export interface CreatedChallengeSpec {
  id: string;
  gameId: string;
  externalId: string;
  name: string;
}

export interface CreateChallengeSpecOptions {
  /** TopoMojo workspace id (the `externalId` Gameboard stores). */
  externalId: string;
  /** Display name shown to participants. */
  name: string;
  /** Optional short description / text. */
  description?: string;
  /** Points awarded. Default 100. */
  points?: number;
  /** Hide the challenge from players (admin-only deploy). Default false. */
  isHidden?: boolean;
  /** Disable the challenge. Default false. */
  disabled?: boolean;
  /** Map x coordinate (0..1). */
  x?: number;
  /** Map y coordinate (0..1). */
  y?: number;
  /** Map hotspot radius (0..1). */
  r?: number;
}

/**
 * Add a challenge spec to a game, pointing at a TopoMojo workspace by id.
 * Returns the newly-created ChallengeSpec.
 */
export async function addChallengeSpecToGame(
  token: string,
  gameId: string,
  opts: CreateChallengeSpecOptions
): Promise<CreatedChallengeSpec> {
  const body = {
    gameId,
    externalId: opts.externalId,
    name: opts.name,
    description: opts.description ?? '',
    text: opts.description ?? '',
    gameEngineType: 'topoMojo',
    solutionGuideUrl: '',
    showSolutionGuideInCompetitiveMode: false,
    tags: '',
    tag: '',
    disabled: opts.disabled ?? false,
    averageDeploySeconds: 0,
    isHidden: opts.isHidden ?? false,
    points: opts.points ?? 100,
    x: opts.x ?? 0.5,
    y: opts.y ?? 0.5,
    r: opts.r ?? 0.03,
  };
  const r = await apiCall<any>(token, '/api/challengespec', {
    method: 'POST',
    body,
  });
  if (!r.ok) {
    throw new Error(`addChallengeSpecToGame failed (${r.status}): ${r.text}`);
  }
  return {
    id: r.data.id,
    gameId: r.data.gameId,
    externalId: r.data.externalId,
    name: r.data.name,
  };
}

export async function deleteChallengeSpec(token: string, specId: string): Promise<void> {
  const r = await apiCall(token, `/api/challengespec/${specId}`, { method: 'DELETE' });
  if (!r.ok && r.status !== 404) {
    console.warn(`deleteChallengeSpec(${specId}) returned ${r.status}`);
  }
}

export async function listGameChallengeSpecs(token: string, gameId: string): Promise<any[]> {
  const r = await apiCall<any>(token, `/api/game/${gameId}/specs`);
  if (!r.ok) throw new Error(`listGameChallengeSpecs failed (${r.status}): ${r.text}`);
  return Array.isArray(r.data) ? r.data : [];
}

// -----------------------------------------------------------------------------
// Multi-user team helpers
// -----------------------------------------------------------------------------

/**
 * Provision a Gameboard user record for a Keycloak-token holder. Calls
 * POST /api/user to JIT-register the user and update their sponsor. Returns
 * the Gameboard user id (same as Keycloak user id).
 */
export async function provisionGameboardUser(
  userToken: string,
  sponsorId: string
): Promise<string> {
  // Decode JWT `sub` claim to get user id.
  const payload = JSON.parse(
    Buffer.from(userToken.split('.')[1], 'base64url').toString('utf8')
  );
  const userId = payload.sub as string;

  // POST /api/user (JIT register)
  const createRes = await apiCall(userToken, '/api/user', {
    method: 'POST',
    body: { id: userId },
  });
  if (!createRes.ok && createRes.status !== 409) {
    throw new Error(`provisionGameboardUser (POST) failed (${createRes.status}): ${createRes.text}`);
  }

  // PUT /api/user to set sponsor (needed before enrolling)
  const updateRes = await apiCall(userToken, '/api/user', {
    method: 'PUT',
    body: { id: userId, sponsorId },
  });
  if (!updateRes.ok) {
    throw new Error(`provisionGameboardUser (PUT sponsor) failed (${updateRes.status}): ${updateRes.text}`);
  }
  return userId;
}

/**
 * Enroll an arbitrary user (identified by their own bearer token + user id)
 * in a game. Unlike `enrollAdmin`, this lets a user enroll themselves by
 * passing their own token. Returns the newly created Player record.
 */
export async function enrollUser(
  userToken: string,
  userId: string,
  gameId: string
): Promise<CreatedPlayer> {
  const r = await apiCall<any>(userToken, '/api/player', {
    method: 'POST',
    body: { userId, gameId },
  });
  if (!r.ok) {
    throw new Error(`enrollUser failed (${r.status}): ${r.text}`);
  }
  return {
    id: r.data.id,
    gameId: r.data.gameId,
    userId: r.data.userId,
    teamId: r.data.teamId,
    approvedName: r.data.approvedName,
    role: r.data.role,
  };
}

/**
 * Generate an invitation code for a team. The caller must be the captain of
 * the player record OR have the Teams_Enroll permission. Returns the code.
 */
export async function generateTeamInvite(
  token: string,
  captainPlayerId: string
): Promise<string> {
  const r = await apiCall<any>(token, `/api/player/${captainPlayerId}/invite`, {
    method: 'POST',
  });
  if (!r.ok) throw new Error(`generateTeamInvite failed (${r.status}): ${r.text}`);
  return r.data.code as string;
}

/**
 * Enlist a player on an existing team by redeeming an invite code. Caller
 * provides the new player's record id (from their initial enrollment) and
 * the captain's invite code. Returns the updated player record.
 */
export async function redeemTeamInvite(
  userToken: string,
  playerId: string,
  code: string
): Promise<CreatedPlayer> {
  const r = await apiCall<any>(userToken, '/api/player/enlist', {
    method: 'POST',
    body: { playerId, code },
  });
  if (!r.ok) throw new Error(`redeemTeamInvite failed (${r.status}): ${r.text}`);
  return {
    id: r.data.id,
    gameId: r.data.gameId,
    userId: r.data.userId,
    teamId: r.data.teamId,
    approvedName: r.data.approvedName,
    role: r.data.role,
  };
}

/**
 * Promote a player to team captain (manager). The caller must currently be
 * the captain of the team OR have the Teams_Enroll permission.
 */
export async function promoteToCaptain(
  token: string,
  teamId: string,
  newCaptainPlayerId: string,
  currentCaptainPlayerId: string
): Promise<void> {
  const r = await apiCall(token, `/api/team/${teamId}/manager/${newCaptainPlayerId}`, {
    method: 'PUT',
    body: { currentCaptainId: currentCaptainPlayerId },
  });
  if (!r.ok) throw new Error(`promoteToCaptain failed (${r.status}): ${r.text}`);
}

/**
 * Update a player's display name ("ChangedPlayer" model).
 */
export async function updatePlayer(
  token: string,
  playerId: string,
  fields: { name?: string; approvedName?: string }
): Promise<any> {
  const r = await apiCall<any>(token, '/api/player', {
    method: 'PUT',
    body: { id: playerId, ...fields },
  });
  if (!r.ok) throw new Error(`updatePlayer failed (${r.status}): ${r.text}`);
  return r.data;
}

export async function getPlayer(token: string, playerId: string): Promise<any> {
  const r = await apiCall<any>(token, `/api/player/${playerId}`);
  if (!r.ok) throw new Error(`getPlayer failed (${r.status}): ${r.text}`);
  return r.data;
}

/**
 * Get all players in a game. Optionally filter to a specific team by id.
 */
export async function listGamePlayers(
  token: string,
  gameId: string,
  teamId?: string
): Promise<any[]> {
  const query = `?gid=${gameId}` + (teamId ? `&tid=${teamId}` : '');
  const r = await apiCall<any>(token, `/api/players${query}`);
  if (!r.ok) throw new Error(`listGamePlayers failed (${r.status}): ${r.text}`);
  return Array.isArray(r.data) ? r.data : [];
}
