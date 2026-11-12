// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

/**
 * Lifetime management for the per-app auth state that global-setup.ts saves to
 * `.auth/<app>.json` (+ `<app>-session.json`).
 *
 * Why this exists: the dev realm's access tokens live 30 min and its SSO session
 * idles out after 30 min. A context restored from a saved state whose token is
 * still valid never contacts Keycloak, so test traffic does not keep the SSO
 * session alive; ~30 min after global-setup every saved state (and every token an
 * API helper lifted from it) dies at once. This module refreshes the saved state
 * *before* a context is created from it, and is the one place that writes it.
 *
 * Concurrency: workers share `.auth/`, so a refresh runs under a cross-process
 * lock file (`.auth/<app>.lock`, created with the atomic `wx` flag, heartbeated
 * while held, released only by its owner, reclaimed only from a dead holder). A worker that
 * finds the lock held waits for it, then sees the rewritten files and returns
 * without logging in again — one login per app per expiry, not one per worker.
 */

import { Browser, chromium, Page } from '@playwright/test';
import fs from 'fs';
import path from 'path';
import { authSessionStatePath, authStatePath } from './auth-paths';
import { jwtExp } from './api-cache';
import { authenticateWithKeycloak } from './shared-fixtures';
import { provisionTarget } from './provision-targets';

/**
 * A lock is reclaimed when its holder's pid is dead, or — as a backstop for a pid
 * reused or on another host — when it has not been touched for this long. A live
 * holder touches it every LOCK_HEARTBEAT_MS, so a slow login never looks stale.
 */
const LOCK_STALE_MS = 600_000;
const LOCK_HEARTBEAT_MS = 15_000;
/**
 * How long a waiter waits for another worker's refresh before giving up. Refreshes
 * run inside tests (120 s per-test timeout), so this stays below it: the waiter
 * reports the held lock itself instead of dying on a bare test timeout. A refresh
 * is one Keycloak login, well under this.
 */
const LOCK_WAIT_MS = 90_000;
const LOCK_POLL_MS = 250;

function lockPath(app: string): string {
  return path.resolve(path.dirname(authStatePath(app)), `${app}.lock`);
}

function readJson(file: string): any {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return null;
  }
}

/** Access tokens found in any JSON-object value that carries an `access_token`. */
function accessTokensIn(values: unknown[]): string[] {
  const tokens: string[] = [];
  for (const value of values) {
    if (typeof value !== 'string' || !value.includes('access_token')) continue;
    try {
      const parsed = JSON.parse(value);
      if (parsed && typeof parsed.access_token === 'string') tokens.push(parsed.access_token);
    } catch {
      // Not JSON — some other storage entry that merely mentions the word.
    }
  }
  return tokens;
}

/**
 * The OIDC access token saved for `app`, with its JWT `exp` (seconds since epoch).
 *
 * Looks in the sessionStorage dump first, then the storageState's localStorage
 * (which store an app uses depends on its OIDC library). When several tokens are
 * saved, the one expiring soonest is returned so a stale copy anywhere triggers a
 * refresh. Returns `null` when no parseable token is saved.
 */
export function savedAccessToken(app: string): { token: string; exp: number } | null {
  const values: unknown[] = [];
  const session = readJson(authSessionStatePath(app));
  if (Array.isArray(session)) {
    for (const entry of session) if (Array.isArray(entry)) values.push(entry[1]);
  }
  const state = readJson(authStatePath(app));
  for (const origin of state?.origins ?? []) {
    for (const item of origin.localStorage ?? []) values.push(item.value);
  }

  let best: { token: string; exp: number } | null = null;
  for (const token of accessTokensIn(values)) {
    const exp = jwtExp(token);
    if (exp !== null && (best === null || exp < best.exp)) best = { token, exp };
  }
  return best;
}

/** True when `exp` (seconds since epoch) is more than `skewSeconds` away. */
export function isFresh(exp: number | undefined | null, skewSeconds = 300): boolean {
  return typeof exp === 'number' && exp - Date.now() / 1000 > skewSeconds;
}

/**
 * Returns the last-modified timestamp (in ms) of the saved auth state for `app`,
 * or 0 if the file does not exist.
 */
export function stateMtime(app: string): number {
  try {
    return fs.statSync(authStatePath(app)).mtimeMs;
  } catch {
    return 0;
  }
}

function pidAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    // EPERM: the process exists but belongs to someone else.
    return (error as NodeJS.ErrnoException).code === 'EPERM';
  }
}

/** A held lock: its path, the token written into it, and the heartbeat timer. */
export interface AuthLock {
  file: string;
  token: string;
  heartbeat: NodeJS.Timeout;
}

function readLock(file: string): { text: string; mtimeMs: number } | null {
  try {
    return { text: fs.readFileSync(file, 'utf8'), mtimeMs: fs.statSync(file).mtimeMs };
  } catch {
    return null;
  }
}

/**
 * Reclaim an abandoned lock atomically: rename it to a name only this process uses
 * (a waiter that loses the race gets ENOENT and simply keeps waiting), then confirm
 * the file moved is the one judged stale. If a live holder's lock was moved instead
 * (it was recreated between our read and our rename), put it back with `link`,
 * which — like `wx` — fails rather than overwrite a lock created meanwhile.
 */
function reclaimStaleLock(file: string, staleText: string): void {
  const aside = `${file}.reclaim.${process.pid}`;
  try {
    fs.renameSync(file, aside);
  } catch {
    return;
  }
  try {
    if (fs.readFileSync(aside, 'utf8') !== staleText) {
      try {
        fs.linkSync(aside, file);
      } catch {
        // Someone created a fresh lock in the meantime; theirs stands.
      }
    }
  } finally {
    fs.rmSync(aside, { force: true });
  }
}

/** Take `app`'s refresh lock, waiting while a live worker holds it. */
export async function acquireAuthLock(app: string): Promise<AuthLock> {
  const file = lockPath(app);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const token = `${process.pid}:${Date.now()}:${Math.random().toString(36).slice(2)}`;
  const deadline = Date.now() + LOCK_WAIT_MS;
  for (;;) {
    try {
      // 'wx' fails if the path exists — an atomic cross-process test-and-set.
      fs.writeFileSync(file, token, { flag: 'wx' });
      const heartbeat = setInterval(() => {
        // Touch only our own lock; never revive one that was reclaimed from us.
        if (readLock(file)?.text === token) {
          const now = new Date();
          // The lock can be reclaimed and deleted between the read and the touch; an
          // uncaught throw here would crash the worker from inside a timer.
          try {
            fs.utimesSync(file, now, now);
          } catch {
            // Lost the lock; the holder's next readLock check stops touching it.
          }
        }
      }, LOCK_HEARTBEAT_MS);
      heartbeat.unref();
      return { file, token, heartbeat };
    } catch {
      const held = readLock(file);
      if (!held) continue; // Released between the failed create and the read.
      const pid = Number(held.text.split(':')[0]);
      const abandoned = !Number.isInteger(pid) || pid <= 0 || !pidAlive(pid)
        || Date.now() - held.mtimeMs > LOCK_STALE_MS;
      if (abandoned) {
        reclaimStaleLock(file, held.text);
        continue;
      }
    }
    if (Date.now() >= deadline) {
      throw new Error(`[auth-state] timed out waiting for ${file}`);
    }
    await new Promise(resolve => setTimeout(resolve, LOCK_POLL_MS));
  }
}

/** Release `lock` — only if the file still holds our token, never another holder's. */
export function releaseAuthLock(lock: AuthLock): void {
  clearInterval(lock.heartbeat);
  if (readLock(lock.file)?.text === lock.token) fs.rmSync(lock.file, { force: true });
}

function writeAtomic(file: string, contents: string): void {
  const tmp = `${file}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, contents);
  fs.renameSync(tmp, file);
}

/**
 * Persist `page`'s context state (cookies + localStorage) and its sessionStorage as
 * `app`'s saved auth state. Both files are written atomically (`.tmp` + rename), so
 * a worker reading them concurrently never sees a half-written file.
 */
export async function saveAuthState(app: string, page: Page): Promise<void> {
  fs.mkdirSync(path.dirname(authStatePath(app)), { recursive: true });
  const state = await page.context().storageState();
  const session = await page.evaluate(() => Object.entries(sessionStorage));
  writeAtomic(authSessionStatePath(app), JSON.stringify(session));
  writeAtomic(authStatePath(app), JSON.stringify(state));
}

/**
 * Re-authenticate `app` and rewrite its saved state.
 *
 * Runs under `.auth/<app>.lock`. After taking the lock it returns without doing
 * anything if another worker rewrote the state while this one waited, or (unless
 * `from` is given) if the saved token is already fresh.
 *
 * @param browser - browser to open the login context on; launches chromium if omitted
 * @param options.from - an already-authenticated page to capture instead of logging
 *   in again (the reactive path in `ensureAuthenticatedShell`, where the saved state
 *   was rejected even though its token looked fresh)
 * @param options.since - the mtime captured before the caller observed the unauthenticated
 *   signal (before `opts.login` on the reactive path); when another worker refreshed the
 *   state after that timestamp, this worker's save is redundant and is skipped
 */
export async function refreshAppAuthState(
  app: string,
  browser?: Browser,
  options: { from?: Page; reason?: 'setup' | 'proactive' | 'reactive'; since?: number } = {},
): Promise<void> {
  const target = provisionTarget(app);
  if (!target) throw new Error(`[auth-state] no PROVISION entry for ${app}`);

  const mtimeBefore = options.since ?? stateMtime(app);
  const lock = await acquireAuthLock(app);
  try {
    if (stateMtime(app) !== mtimeBefore) return; // Another worker refreshed it.
    // Setup provisions unconditionally once it decided to (e.g. a file is missing).
    if (!options.from && options.reason !== 'setup' && isFresh(savedAccessToken(app)?.exp)) return;

    if (options.from) {
      await saveAuthState(app, options.from);
    } else {
      const ownBrowser = browser ? null : await chromium.launch();
      const context = await (browser ?? ownBrowser).newContext({ ignoreHTTPSErrors: true });
      try {
        const page = await context.newPage();
        await (target.authenticate ?? ((p: Page) => authenticateWithKeycloak(p, target.homeUrl)))(page);
        await page.locator(target.appShellSelector).first().waitFor({ state: 'visible', timeout: 60000 });
        await saveAuthState(app, page);
      } finally {
        await context.close();
        await ownBrowser?.close();
      }
    }
    console.log(`[auth-state] refreshed ${app} (${options.reason ?? (options.from ? 'reactive' : 'proactive')})`);
  } finally {
    releaseAuthLock(lock);
  }
}

/**
 * The `storageState` to create `app`'s test context from: `undefined` when no state
 * was saved (the fixture then logs in interactively), otherwise the state path —
 * refreshed first when its token is within 5 minutes of expiry. A state without a
 * parseable token is returned as-is; the fixture's shell check handles rejection.
 */
export async function freshAuthStatePath(app: string, browser: Browser): Promise<string | undefined> {
  const statePath = authStatePath(app);
  if (!fs.existsSync(statePath)) return undefined;
  const saved = savedAccessToken(app);
  if (saved && !isFresh(saved.exp)) {
    try {
      await refreshAppAuthState(app, browser);
    } catch (error) {
      console.warn(`[auth-state] refresh of ${app} failed; using the saved state: ${error}`);
    }
  }
  return statePath;
}

/** The saved sessionStorage entries for `app` (empty when none were saved). */
export function savedSessionState(app: string): Array<[string, string]> {
  const session = readJson(authSessionStatePath(app));
  return Array.isArray(session) ? session : [];
}

/**
 * A token for `app` lifted from its saved state, refreshing the state first when the
 * token is stale. Pair with `cachedToken` from api-cache.ts.
 */
export async function freshSavedAccessToken(app: string): Promise<string> {
  if (!isFresh(savedAccessToken(app)?.exp)) await refreshAppAuthState(app);
  const saved = savedAccessToken(app);
  if (!saved) {
    throw new Error(
      `No saved ${app} access token in ${authSessionStatePath(app)} or ${authStatePath(app)}. ` +
      `Run global-setup.ts first to provision authentication.`,
    );
  }
  return saved.token;
}
