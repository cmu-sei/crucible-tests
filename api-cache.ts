// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { APIRequestContext, request as playwrightRequest } from '@playwright/test';

/**
 * Process-local caches for API credentials used by helpers that call app REST APIs
 * directly (outside a browser page).
 *
 * The bad shape this replaces is `let _cachedToken = ...; if (_cachedToken) return
 * _cachedToken;` — a token cached with no expiry check keeps being served after it
 * dies, so every later API call in that worker 401s. `cachedToken` re-checks the
 * JWT `exp` on every call and re-fetches unless the token outlives a whole test.
 */

const tokens = new Map<string, string>();

/**
 * Cache key for a password-grant token: `${realm}:${clientId}:${username}:${scope}`.
 * Every helper that caches a Keycloak token builds its key here so two helpers asking
 * for the same grant share one entry.
 */
export function tokenKey(realm: string, clientId: string, username: string, scope: string): string {
  return `${realm}:${clientId}:${username}:${scope}`;
}

/**
 * Decode the `exp` claim (seconds since epoch) of a JWT, or `null` when the token is
 * not a parseable JWT. Signature is not verified — this only drives client-side
 * cache freshness.
 */
export function jwtExp(token: string): number | null {
  const segment = token.split('.')[1];
  if (!segment) return null;
  try {
    const claims = JSON.parse(Buffer.from(segment, 'base64url').toString('utf8'));
    return typeof claims.exp === 'number' ? claims.exp : null;
  } catch {
    return null;
  }
}

/**
 * The `sub` claim of a JWT: the Keycloak user id, which the Crucible APIs use as the
 * user's id. Throws when the token has no `sub`. Signature is not verified.
 */
export function jwtSub(token: string): string {
  const segment = token.split('.')[1] ?? '';
  const claims = JSON.parse(Buffer.from(segment, 'base64url').toString('utf8'));
  if (typeof claims.sub !== 'string') throw new Error('Token has no sub claim');
  return claims.sub;
}

// Tests capture a token in beforeEach and reuse it in afterEach, so a served token must
// outlive a whole test, including a test.slow() one: 3 x the 120 000 ms per-test
// timeout (playwright.config.ts).
const TOKEN_MIN_REMAINING_MS = 360_000;

/**
 * True while `token` is a JWT with more than `TOKEN_MIN_REMAINING_MS` of life left —
 * the freshness rule `cachedToken` applies, for callers that cache a token alongside
 * other data. A token whose whole lifetime is shorter (the Keycloak master realm's
 * 60 s admin-cli token) is never fresh, so it is fetched on every call.
 */
export function tokenIsFresh(token: string): boolean {
  const exp = jwtExp(token);
  return exp !== null && exp * 1000 - Date.now() > TOKEN_MIN_REMAINING_MS;
}

/**
 * Return the cached token for `key` while it is fresh ({@link tokenIsFresh});
 * otherwise call `fetch`, cache its result and return it. A token without a
 * parseable `exp` is never cached, so it is re-fetched on every call.
 */
export async function cachedToken(key: string, fetch: () => Promise<string>): Promise<string> {
  const cached = tokens.get(key);
  if (cached) {
    if (tokenIsFresh(cached)) {
      return cached;
    }
    tokens.delete(key);
  }
  const token = await fetch();
  if (jwtExp(token) !== null) tokens.set(key, token);
  return token;
}

/** Drop the cached token for `key` (e.g. after the API answered 401). */
export function invalidateToken(key: string): void {
  tokens.delete(key);
}

/**
 * Drop every cached token issued to `username` (any realm, client or scope) — for a
 * user that has just been deleted, whose tokens would otherwise outlive the account.
 */
export function invalidateTokensForUser(username: string): void {
  for (const key of [...tokens.keys()]) {
    if (key.split(':')[2] === username) tokens.delete(key);
  }
}

/**
 * Users a test created for itself (`createKeycloakUser`, `tempUsername()` names).
 * Their tokens are not cached: the account is deleted within the test, so a cached
 * token would only ever be served to a user that no longer exists.
 */
const temporaryUsers = new Set<string>();
/** `tempUsername()` shape: `<prefix>-<epoch ms>-<random>`. */
const TEMP_USERNAME = /-\d{13}-\d+$/;

export function markTemporaryUser(username: string): void {
  temporaryUsers.add(username);
}

export function isTemporaryUser(username: string): boolean {
  return temporaryUsers.has(username) || TEMP_USERNAME.test(username);
}

/**
 * `cachedToken` for a password grant as `username`, except that a temporary user's
 * token is always fetched fresh (see {@link isTemporaryUser}).
 */
export async function cachedUserToken(
  realm: string,
  clientId: string,
  username: string,
  scope: string,
  fetch: () => Promise<string>
): Promise<string> {
  if (isTemporaryUser(username)) return fetch();
  return cachedToken(tokenKey(realm, clientId, username, scope), fetch);
}

let sharedContext: Promise<APIRequestContext> | null = null;

/**
 * One `APIRequestContext` per worker for helpers that call REST APIs outside a page.
 * Opening and disposing a context per call costs more than the call itself on a
 * short request. Callers must not dispose it, and must pass credentials per request
 * (an `Authorization` header) — the context carries no auth state of its own.
 *
 * The context still records `Set-Cookie` responses (Keycloak's SSO cookies after a
 * password grant, Gameboard's and TopoMojo's `*.mks` console cookies after
 * `POST /api/user`), and every app here shares the `localhost` cookie domain, so a
 * jar shared across users would replay one user's cookies on another's requests.
 * The default empty `cookie` header stops Playwright attaching the jar to a request
 * (it only does so when the request has no `cookie` header of its own). Playwright
 * drops that header on a redirect hop, so a redirected request would still carry the
 * jar — keep these helpers on endpoints that answer directly.
 */
export function sharedRequestContext(): Promise<APIRequestContext> {
  if (!sharedContext) {
    sharedContext = playwrightRequest.newContext({
      ignoreHTTPSErrors: true,
      extraHTTPHeaders: { cookie: '' },
    });
    sharedContext.catch(() => {
      sharedContext = null;
    });
  }
  return sharedContext;
}
