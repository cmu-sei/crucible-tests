// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { test as base, Page } from '@playwright/test';
import fs from 'fs';
import path from 'path';
import { Services, serviceUrlPattern, oidcStorageKey, authenticateWithKeycloak, waitForFirstVisible, ensureAuthenticatedShell } from '../shared-fixtures';
import { freshAuthStatePath } from '../auth-state';
import { authStatePath } from '../auth-paths';
import { poolUsers, PoolUser } from '../user-pool';
import { getUserToken } from '../keycloak-admin';
import { Client } from 'pg';
import { gbConnect } from './db-helpers';
import {
  createGame,
  createSponsor,
  deleteGame,
  deleteGameboardUser,
  deletePlayer,
  deleteSponsor,
  enrollAdmin,
  getAdminToken,
  getAdminUserId,
  listGamesByTerm,
  listSponsors,
  setAdminSponsor,
  getGameboardUserState,
  GameboardUserState,
  provisionGameboardUser,
  restoreGameboardUser,
} from './api-helpers';
import { createWorkspace, deleteWorkspace, getTopoMojoAdminToken, listWorkspaces } from '../topomojo-helpers';

/**
 * Gameboard-specific fixtures
 * Extends shared fixtures with Gameboard authentication
 */

// Gameboard UI element locators used by both the helper and fixture.
const GAMEBOARD_LOGIN_BUTTON = 'button:has-text("Login"), button:has-text("Log in")';
const GAMEBOARD_LOGOUT_LINK = 'a:has-text("Log out"), button:has-text("Log out")';

/**
 * Gameboard-specific authentication helper.
 *
 * Unlike most Crucible apps, Gameboard's home page is PUBLIC - unauthenticated
 * users can browse games without being redirected to Keycloak. Authentication
 * is only triggered when navigating to a protected route (e.g. /admin), which
 * shows an in-app "Login — localhost:8443" button that initiates the OIDC flow.
 *
 * This helper navigates to /admin to force a login prompt, then completes the
 * Keycloak authentication form.
 *
 * @param page - Playwright Page object
 * @param username - Keycloak username (default: 'admin')
 * @param password - Keycloak password (default: 'admin')
 */
export async function authenticateGameboardWithKeycloak(
  page: Page,
  username: string = 'admin',
  password: string = 'admin'
): Promise<void> {
  // Force login by navigating to a protected route.
  await page.goto(Services.Gameboard.UI + '/admin', { waitUntil: 'domcontentloaded', timeout: 60000 });

  // Check which state we landed in: authenticated shell, login prompt, or Keycloak form.
  const winner = await waitForFirstVisible(
    page,
    [
      { key: 'authenticated', locator: page.locator(GAMEBOARD_LOGOUT_LINK).first() },
      { key: 'login', locator: page.locator(GAMEBOARD_LOGIN_BUTTON).first() },
      { key: 'keycloak', locator: page.locator('input[name="username"]') },
    ],
    { timeout: 30000 }
  );

  // If already authenticated, we're done.
  if (winner === 'authenticated') return;

  // If neither signal appeared, throw a descriptive error.
  if (winner === null) {
    throw new Error(
      `Gameboard /admin navigation did not reach authenticated shell, login prompt, or Keycloak form within 30s. URL: ${page.url()}`
    );
  }

  // If we see the login prompt, click it to initiate the Keycloak redirect and wait for it.
  if (winner === 'login') {
    await page.locator(GAMEBOARD_LOGIN_BUTTON).first().click();
    await page.waitForURL(/\/realms\/crucible/, { timeout: 30000 });
    await page.waitForSelector('input[name="username"]', { timeout: 30000 });
  }

  // Fill in Keycloak form (whether we landed on it directly or clicked through).
  await page.fill('input[name="username"]', username);
  await page.fill('input[name="password"]', password);

  // Keycloak uses either a button or an input[type=submit] depending on theme.
  try {
    await page.click('button:has-text("Sign In")', { timeout: 3000 });
  } catch {
    try {
      await page.click('input[type="submit"]', { timeout: 3000 });
    } catch {
      await page.click('button[type="submit"]');
    }
  }

  // Wait for redirect back to Gameboard.
  await page.waitForURL(serviceUrlPattern(Services.Gameboard.UI), { timeout: 30000 });
  // Confirm auth landed — "Log out" link is visible.
  await page.locator(GAMEBOARD_LOGOUT_LINK).first().waitFor({ state: 'visible', timeout: 30000 });
}

// ---------------------------------------------------------------------------
// Run-level TopoMojo workspaces (`sharedWorkspace`)
// ---------------------------------------------------------------------------

/** Name prefix of every shared workspace; global-teardown purges whatever still carries it. */
export const SHARED_WORKSPACE_PREFIX = 'E2E Shared Gameboard Workspace';

/** Ids global-setup writes to `.auth/gameboard-seed.json` for the whole run. */
export type GameboardSeed = { workspaceId: string; noAudienceWorkspaceId: string };

/**
 * Two TopoMojo workspaces for specs that only pass a workspace id to Gameboard as a
 * challenge spec's `externalId`: `id` has audience `gameboard` (Gameboard can see it),
 * `noAudienceId` has none. Gameboard keys a game's specs on (externalId, gameId), so a
 * spec that needs two distinct challenges in one game uses both.
 *
 * Read-only: no consumer may edit, re-audience or delete either workspace. A spec that
 * writes the workspace (`setWorkspaceChallenge`, `setWorkspaceAudience`) creates its own.
 */
export type SharedWorkspace = { id: string; noAudienceId: string };

/** `.auth/gameboard-seed.json` — gitignored with the rest of `.auth/`. */
export function gameboardSeedPath(): string {
  return path.resolve(__dirname, '..', '.auth', 'gameboard-seed.json');
}

function readGameboardSeed(): GameboardSeed | null {
  try {
    const seed = JSON.parse(fs.readFileSync(gameboardSeedPath(), 'utf8')) as GameboardSeed;
    return seed.workspaceId && seed.noAudienceWorkspaceId ? seed : null;
  } catch {
    return null;
  }
}

async function createSharedWorkspaces(token: string, suffix = ''): Promise<GameboardSeed> {
  const description = 'Shared read-only Gameboard test workspace; deleted after the run.';
  const visible = await createWorkspace(token, {
    name: `${SHARED_WORKSPACE_PREFIX}${suffix}`,
    description,
    audience: 'gameboard',
  });
  try {
    const hidden = await createWorkspace(token, {
      name: `${SHARED_WORKSPACE_PREFIX} (no audience)${suffix}`,
      description,
      audience: null,
    });
    return { workspaceId: visible.id, noAudienceWorkspaceId: hidden.id };
  } catch (error) {
    await deleteWorkspace(token, visible.id);
    throw error;
  }
}

/** Delete every workspace whose name starts with `SHARED_WORKSPACE_PREFIX`. */
async function deleteSharedWorkspacesByName(token: string): Promise<number> {
  const found = await listWorkspaces(token, { term: SHARED_WORKSPACE_PREFIX, take: 100 });
  const leftovers = found.filter(ws => String(ws.name ?? '').startsWith(SHARED_WORKSPACE_PREFIX));
  for (const ws of leftovers) await deleteWorkspace(token, ws.id);
  return leftovers.length;
}

/**
 * Run-level seed, called once by global-setup when the run includes Gameboard: create
 * the two shared workspaces and write their ids to `.auth/gameboard-seed.json`.
 *
 * The old file is removed first so a failed setup cannot leave ids from an earlier run
 * behind (the worker fallback in `sharedWorkspace` then takes over), and any workspace
 * still named with the shared prefix — left by a run whose teardown never ran — is
 * deleted before the new pair is created. Setup runs before any worker starts.
 */
export async function writeGameboardSeed(): Promise<GameboardSeed> {
  fs.rmSync(gameboardSeedPath(), { force: true });
  const token = await getTopoMojoAdminToken();
  await deleteSharedWorkspacesByName(token);
  const seed = await createSharedWorkspaces(token);
  const file = gameboardSeedPath();
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tmp = `${file}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(seed, null, 2));
  fs.renameSync(tmp, file);
  return seed;
}

// ---------------------------------------------------------------------------
// Worker-scoped read-only game (`readOnlyGame`)
// ---------------------------------------------------------------------------

/** Name prefixes of the per-worker shared game and its sponsor; global-teardown purges both. */
export const SHARED_GAME_PREFIX = 'E2E Shared Game [';
export const SHARED_SPONSOR_PREFIX = 'E2E Shared Sponsor [';

/**
 * A published, in-window game with the admin enrolled once, owned by one worker.
 * Read-only: consumers may view it and read its scoreboard, and may seed scoreboard
 * players with `db-helpers` only if they delete exactly what they seeded in `afterEach`
 * (`cleanupSeededScoreboard`). Nothing may register/unregister, edit, publish, clone,
 * delete it, add challenge specs, or add teams — those specs create their own game.
 */
export type ReadOnlyGame = {
  id: string;
  name: string;
  /** The worker's sponsor; the admin is on it for the worker's lifetime. */
  sponsorId: string;
  /** The admin's player row in the game. */
  playerId: string;
};

/**
 * Global-teardown purge: delete the run's shared Gameboard records — the workspaces
 * named in the seed file (and any other carrying the shared prefix), and every game or
 * sponsor named with a shared prefix that a crashed worker left behind. Removes the
 * seed file. A sponsor the admin is still on is left alone, as deleting it would leave
 * the admin row pointing at nothing.
 */
export async function purgeAllGameboardTestData(): Promise<void> {
  try {
    const tmToken = await getTopoMojoAdminToken();
    const seed = readGameboardSeed();
    if (seed) {
      await deleteWorkspace(tmToken, seed.workspaceId);
      await deleteWorkspace(tmToken, seed.noAudienceWorkspaceId);
    }
    const extra = await deleteSharedWorkspacesByName(tmToken);
    console.log(`[gameboard-purge] Deleted shared workspaces (${seed ? 2 : 0} from seed, ${extra} by name)`);
  } catch (error) {
    // Keep going: a TopoMojo failure must not skip the Gameboard purge below.
    console.warn(`[gameboard-purge] TopoMojo workspace purge skipped: ${error}`);
  } finally {
    fs.rmSync(gameboardSeedPath(), { force: true });
  }

  const token = await getAdminToken();
  const games = await listGamesByTerm(token, SHARED_GAME_PREFIX);
  for (const game of games.filter(g => String(g.name).startsWith(SHARED_GAME_PREFIX))) {
    await deleteGame(token, game.id);
    console.log(`[gameboard-purge] Deleted leftover game "${game.name}"`);
  }
  const adminSponsor = (await getGameboardUserState(token, await getAdminUserId(token))).sponsorId;
  for (const sponsor of await listSponsors(token)) {
    if (!String(sponsor.name).startsWith(SHARED_SPONSOR_PREFIX) || sponsor.id === adminSponsor) continue;
    await deleteSponsor(token, sponsor.id);
    console.log(`[gameboard-purge] Deleted leftover sponsor "${sponsor.name}"`);
  }
}

/**
 * Gameboard-specific fixtures
 */
export type GameboardFixtures = {
  gameboardAuthenticatedPage: Page;
};

/**
 * A pool user leased to this worker (see `user-pool.ts`), with its Gameboard row
 * provisioned and the sponsor/role it started with — what `resetGameboardPoolUser` puts back.
 */
export type GameboardPoolUser = PoolUser & { initial: GameboardUserState };

export type GameboardWorkerFixtures = {
  /** The worker's two pool users: a captain and a member, or two unrelated non-admins. */
  nonAdminUsers: GameboardPoolUser[];
  /** The first of `nonAdminUsers`, for specs that need one. */
  nonAdminUser: GameboardPoolUser;
  /** The run's two read-only TopoMojo workspaces (see `SharedWorkspace`). */
  sharedWorkspace: SharedWorkspace;
  /** This worker's read-only game (see `ReadOnlyGame`). */
  readOnlyGame: ReadOnlyGame;
  /** This worker's Postgres connection to the Gameboard database, closed when the worker ends. */
  gbDb: Client;
};

/**
 * Reset contract for a Gameboard pool user, for the consumer's `afterEach`: the test
 * has already deleted the players it enrolled (`deletePlayer`); this restores the
 * sponsor it moved the user onto and clears any role it granted. Must run before the
 * test deletes its own sponsor, which the user would otherwise still reference.
 */
export async function resetGameboardPoolUser(user: GameboardPoolUser): Promise<void> {
  await restoreGameboardUser(await getAdminToken(), user.userId, user.initial);
}

/**
 * Extended test with Gameboard-specific fixtures
 */
export const test = base.extend<GameboardFixtures, GameboardWorkerFixtures>({
  // Leased by `parallelIndex` — the stable worker slot — so a worker restarted after a
  // failure gets the same users and two live workers never share one. The Gameboard row
  // is created up front (as the UI's first-login POST /api/user would) so its starting
  // sponsor/role can be recorded, and deleted when the worker ends.
  nonAdminUsers: [
    async ({}, use, workerInfo) => {
      const leased: GameboardPoolUser[] = [];
      for (const user of poolUsers(workerInfo.parallelIndex, 2)) {
        const token = await getUserToken(user.username, user.password);
        const userId = await provisionGameboardUser(token, null);
        leased.push({ ...user, initial: await getGameboardUserState(token, userId) });
      }
      await use(leased);
      const adminToken = await getAdminToken();
      for (const user of leased) await deleteGameboardUser(adminToken, user.userId);
    },
    { scope: 'worker' },
  ],
  nonAdminUser: [async ({ nonAdminUsers }, use) => use(nonAdminUsers[0]), { scope: 'worker' }],

  // Read from `.auth/gameboard-seed.json`. When global-setup could not write it (or the
  // run's path filters hid Gameboard from it), the worker creates its own pair, suffixed
  // with its slot, and deletes them when it ends.
  sharedWorkspace: [
    async ({}, use, workerInfo) => {
      const seed = readGameboardSeed();
      if (seed) {
        await use({ id: seed.workspaceId, noAudienceId: seed.noAudienceWorkspaceId });
        return;
      }
      const token = await getTopoMojoAdminToken();
      const own = await createSharedWorkspaces(token, ` [w${workerInfo.parallelIndex}]`);
      try {
        await use({ id: own.workspaceId, noAudienceId: own.noAudienceWorkspaceId });
      } finally {
        const teardownToken = await getTopoMojoAdminToken();
        await deleteWorkspace(teardownToken, own.workspaceId);
        await deleteWorkspace(teardownToken, own.noAudienceWorkspaceId);
      }
    },
    { scope: 'worker' },
  ],

  // Created with the admin token once per worker slot. Enrollment needs the admin on
  // the game's sponsor, so the admin is moved onto the worker's sponsor only for the
  // enrollment and put straight back: holding it there for the worker's lifetime would
  // make every other worker's setAdminSponsor save this sponsor as the one to restore.
  readOnlyGame: [
    async ({}, use, workerInfo) => {
      const slot = `[w${workerInfo.parallelIndex}]`;
      const name = `${SHARED_GAME_PREFIX.slice(0, -1)}${slot}`;
      const token = await getAdminToken();
      // A worker restarted in this slot already tore its game down; anything still
      // carrying the name is from a crashed run.
      for (const g of await listGamesByTerm(token, name)) {
        if (g.name === name) await deleteGame(token, g.id);
      }
      const sponsor = await createSponsor(token, `${SHARED_SPONSOR_PREFIX.slice(0, -1)}${slot}`);
      let gameId: string | null = null;
      let playerId: string | null = null;
      try {
        const { previousSponsorId } = await setAdminSponsor(token, sponsor.id);
        try {
          const game = await createGame(token, { name, startOffsetDays: -1, endOffsetDays: 30 });
          gameId = game.id;
          playerId = (await enrollAdmin(token, game.id)).id;
        } finally {
          if (previousSponsorId) {
            await setAdminSponsor(token, previousSponsorId).catch(error =>
              console.warn(`[gameboard] Could not restore the admin's sponsor: ${error}`),
            );
          }
        }
        await use({ id: gameId, name, sponsorId: sponsor.id, playerId });
      } finally {
        const t = await getAdminToken();
        // Each step is independent: one failing must not skip the rest.
        const step = (label: string, run: () => Promise<unknown>) =>
          run().catch(error => console.warn(`[gameboard] readOnlyGame teardown: ${label} failed: ${error}`));
        if (playerId) await step('delete player', () => deletePlayer(t, playerId!));
        if (gameId) await step('delete game', () => deleteGame(t, gameId!));
        // Left in place (for the purge) while the admin still references it.
        const adminOnOurSponsor = await getAdminUserId(t)
          .then(id => getGameboardUserState(t, id))
          .then(state => state.sponsorId === sponsor.id, () => true);
        if (!adminOnOurSponsor) await step('delete sponsor', () => deleteSponsor(t, sponsor.id));
      }
    },
    { scope: 'worker' },
  ],

  gbDb: [
    async ({}, use) => {
      const client = await gbConnect();
      // An idle connection the server drops emits 'error'; without a listener that
      // would crash the worker. The next query on it fails loudly instead.
      client.on('error', error => console.warn(`[gameboard] Postgres connection error: ${error.message}`));
      try {
        await use(client);
      } finally {
        await client.end();
      }
    },
    { scope: 'worker' },
  ],

  // `undefined` when global-setup could not provision Gameboard; the shell check below
  // then falls back to an interactive login.
  storageState: async ({ browser }, use) => use(await freshAuthStatePath('gameboard', browser)),

  gameboardAuthenticatedPage: async ({ page, storageState }, use) => {
    // Gameboard shows a landing page with a "Login"/"Log in" button when unauthenticated
    // (no direct Keycloak redirect from home, since home is public), so pass loginPrompt.
    // The button can flash briefly even with valid auth while the JS auth check runs, but
    // ensureAuthenticatedShell's provisional 'login' winner logic re-waits to distinguish
    // the flash from genuine unauthenticated state.
    await ensureAuthenticatedShell(page, {
      app: 'gameboard',
      url: Services.Gameboard.UI + '/admin',
      shell: page.locator(GAMEBOARD_LOGOUT_LINK).first(),
      login: authenticateGameboardWithKeycloak,
      loginPrompt: page.locator(GAMEBOARD_LOGIN_BUTTON).first(),
      fromSavedState: storageState === authStatePath('gameboard'),
    });

    await use(page);
  },
});

export { expect } from '@playwright/test';
export { Services, serviceUrlPattern, oidcStorageKey };
