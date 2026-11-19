// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

/**
 * A per-run pool of non-admin Keycloak users, leased to workers two at a time.
 *
 * Specs that need "somebody who is not admin" (unauthorized-access checks, a team
 * captain and a member, a second presence session) used to create a Keycloak user per
 * test and delete it afterwards — four or five admin-API calls plus a fresh password
 * grant each time, and a new app-side user row per test that nothing deleted.
 * Instead, `global-setup.ts` ensures `e2e-pool-<checkout>-0` … `e2e-pool-<checkout>-<n-1>`
 * once per run and writes them to `.auth/user-pool.json`; `global-teardown.ts` deletes them.
 *
 * **Per checkout.** `<checkout>` is a short hash of this repository's path, so two
 * checkouts (git worktrees) running against the same Keycloak at once each get their
 * own users — otherwise one run's setup would reset, and its teardown delete, the
 * users the other run is mid-test with.
 *
 * **Leasing.** `poolUsers(slot, count)` hands slot `s` users `2s` and `2s+1`. The slot
 * is `testInfo.parallelIndex` / `workerInfo.parallelIndex` (0 … workers-1), NOT
 * `workerIndex`: `workerIndex` keeps climbing every time a worker restarts after a
 * failure, while `parallelIndex` is the stable slot the replacement worker inherits.
 * Two workers running at once never share a slot, so they never share a user.
 *
 * **Reset contract.** A pooled user outlives the test, so the test (or the app
 * fixture's worker teardown) must leave the user exactly as it found it: delete the
 * players / memberships / team seats it created and restore anything it changed on the
 * user's app row. Each app's fixture documents its own contract.
 *
 * **Not for every spec.** A test whose subject is what happens to a *new* account
 * (first-enlist user creation, first-login role assignment, email-domain matching on a
 * unique address) still creates its own user with `createKeycloakUser`.
 */

import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { Services } from './shared-fixtures';
import { getKeycloakAdminToken } from './keycloak-admin';
import { invalidateTokensForUser, sharedRequestContext } from './api-cache';

/** Two users per worker at the default 4 local workers (captain + member specs need two). */
export const POOL_SIZE = 8;

/**
 * Apps whose specs lease pool users. global-setup creates the pool, and global-teardown
 * deletes it, only when the run can include one of them.
 */
export const POOL_CONSUMER_APPS = ['gameboard', 'alloy', 'blueprint', 'cite', 'playerVm'];

/** Password for every pool user. Dev-realm only; never a real credential. */
export const POOL_PASSWORD = 'TestPassword123!';

const REALM = 'crucible';
/** Short, stable id for this checkout (see "Per checkout" in the file comment). */
const CHECKOUT_TAG = crypto.createHash('sha1').update(path.resolve(__dirname)).digest('hex').slice(0, 6);
/** This checkout's pool users, plus the untagged names older runs created. */
const POOL_USERNAME = new RegExp(`^e2e-pool-(?:${CHECKOUT_TAG}-)?\\d+$`);

export type PoolUser = {
  username: string;
  password: string;
  /** Keycloak id — also the user's id in every Crucible app (the OIDC `sub`). */
  userId: string;
  /**
   * The token's `name` claim (`firstName lastName`), which is how apps label the user
   * on screen: `E2E Pool <n>`.
   */
  displayName: string;
};

export function userPoolPath(): string {
  return path.resolve(__dirname, '.auth', 'user-pool.json');
}

export function poolUsername(n: number): string {
  return `e2e-pool-${CHECKOUT_TAG}-${n}`;
}

function keycloakAdminBase(): string {
  return `${Services.Keycloak.replace(/\/$/, '')}/admin/realms/${REALM}`;
}

async function findUserId(adminToken: string, username: string): Promise<string | undefined> {
  const ctx = await sharedRequestContext();
  const res = await ctx.fetch(
    `${keycloakAdminBase()}/users?username=${encodeURIComponent(username)}&exact=true`,
    { headers: { Authorization: `Bearer ${adminToken}` } }
  );
  if (!res.ok()) {
    throw new Error(`Keycloak user lookup for ${username} failed (${res.status()}): ${await res.text()}`);
  }
  return ((await res.json()) as Array<{ id: string }>)[0]?.id;
}

/**
 * Ensure pool user `n` exists with the pool password, no pending required actions and
 * its fixed display name. Reuses an existing account (a previous run whose teardown
 * did not complete) rather than failing on the duplicate username.
 */
async function ensurePoolUser(adminToken: string, n: number): Promise<PoolUser> {
  const username = poolUsername(n);
  const representation = {
    username,
    email: `${username}@test.local`,
    firstName: 'E2E',
    lastName: `Pool ${n}`,
    enabled: true,
    emailVerified: true,
    // The realm's default required actions would block the password grant.
    requiredActions: [],
  };
  const headers = { Authorization: `Bearer ${adminToken}`, 'Content-Type': 'application/json' };
  const credential = { type: 'password', value: POOL_PASSWORD, temporary: false };
  const ctx = await sharedRequestContext();

  let userId = await findUserId(adminToken, username);
  if (!userId) {
    const created = await ctx.post(`${keycloakAdminBase()}/users`, {
      headers,
      data: { ...representation, credentials: [credential] },
    });
    // 409: created concurrently; the lookup below picks it up either way.
    if (!created.ok() && created.status() !== 409) {
      throw new Error(`Keycloak create ${username} failed (${created.status()}): ${await created.text()}`);
    }
    userId = created.headers()['location']?.split('/').pop() || (await findUserId(adminToken, username));
    if (!userId) throw new Error(`Could not determine the id of pool user ${username}`);
  }

  // Applied to a new user too: the realm can attach default required actions on create.
  const updated = await ctx.fetch(`${keycloakAdminBase()}/users/${userId}`, {
    method: 'PUT',
    headers,
    data: representation,
  });
  if (!updated.ok()) {
    throw new Error(`Keycloak update ${username} failed (${updated.status()}): ${await updated.text()}`);
  }
  const reset = await ctx.fetch(`${keycloakAdminBase()}/users/${userId}/reset-password`, {
    method: 'PUT',
    headers,
    data: credential,
  });
  if (!reset.ok()) {
    throw new Error(`Keycloak password reset for ${username} failed (${reset.status()}): ${await reset.text()}`);
  }

  return { username, password: POOL_PASSWORD, userId, displayName: `E2E Pool ${n}` };
}

/**
 * Ensure the pool's users exist and write them to `.auth/user-pool.json`. Called once
 * from global-setup. `size` defaults to {@link POOL_SIZE}; global-setup raises it to
 * two per configured worker when a run asks for more than four.
 */
export async function createUserPool(size: number = POOL_SIZE): Promise<PoolUser[]> {
  fs.rmSync(userPoolPath(), { force: true });
  const adminToken = await getKeycloakAdminToken();
  const users: PoolUser[] = [];
  for (let n = 0; n < size; n++) {
    users.push(await ensurePoolUser(adminToken, n));
  }
  fs.mkdirSync(path.dirname(userPoolPath()), { recursive: true });
  fs.writeFileSync(userPoolPath(), JSON.stringify(users, null, 2));
  cachedPool = null;
  return users;
}

/**
 * Delete this checkout's pool users — the ones this run created and any a crashed run
 * left behind (plus any untagged `e2e-pool-<n>` from before pools were per checkout).
 * Other checkouts' pools are left alone. Called from global-teardown; best-effort per user.
 */
export async function deleteUserPool(): Promise<void> {
  const adminToken = await getKeycloakAdminToken();
  const ctx = await sharedRequestContext();
  const headers = { Authorization: `Bearer ${adminToken}` };
  const res = await ctx.fetch(`${keycloakAdminBase()}/users?search=e2e-pool-&max=1000`, { headers });
  if (!res.ok()) {
    throw new Error(`Keycloak pool lookup failed (${res.status()}): ${await res.text()}`);
  }
  const users = ((await res.json()) as Array<{ id: string; username: string }>).filter((u) =>
    POOL_USERNAME.test(u.username)
  );
  for (const user of users) {
    invalidateTokensForUser(user.username);
    const deleted = await ctx.fetch(`${keycloakAdminBase()}/users/${user.id}`, { method: 'DELETE', headers });
    if (!deleted.ok() && deleted.status() !== 404) {
      console.warn(`[user-pool] Deleting ${user.username} returned ${deleted.status()}`);
    }
  }
  // The file is left as the record of what the run used; the next run's global-setup
  // rewrites it before any worker reads it.
  cachedPool = null;
}

let cachedPool: PoolUser[] | null = null;

function readPool(): PoolUser[] {
  if (!cachedPool) {
    if (!fs.existsSync(userPoolPath())) {
      throw new Error(
        `${userPoolPath()} is missing: global-setup creates the user pool when the run includes an app ` +
          'with pool consumers, and logs why if that failed (is Keycloak reachable?).'
      );
    }
    cachedPool = JSON.parse(fs.readFileSync(userPoolPath(), 'utf8')) as PoolUser[];
  }
  return cachedPool;
}

/**
 * The pool users leased to worker slot `slot` — pass `parallelIndex`, never
 * `workerIndex` (see the file comment). Slot `s` owns users `2s` and `2s+1`.
 */
export function poolUsers(slot: number, count: 1 | 2): PoolUser[] {
  const pool = readPool();
  const first = 2 * slot;
  if (first + count > pool.length) {
    throw new Error(
      `Worker slot ${slot} needs pool users ${first}..${first + count - 1}, but the pool has ${pool.length}. ` +
        'global-setup sizes the pool at two per configured worker; was it created by a run with fewer workers?'
    );
  }
  return pool.slice(first, first + count);
}
