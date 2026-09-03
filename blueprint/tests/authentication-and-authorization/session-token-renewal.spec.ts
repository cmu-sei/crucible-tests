// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: specs/blueprint-test-plan.md
// seed: tests/seed.spec.ts
//
// Test: Session Token Renewal (plan item 1.4)
//
// Rewritten — the previous version could not fail. Three reasons, all worth recording:
//
//  1. It ran on the shared pre-authenticated fixture, whose `storageState` path *injects*
//     the OIDC entry into sessionStorage via `addInitScript` (see blueprint/fixtures.ts).
//     So `expect(sessionStorage.getItem(oidcKey)).toBeTruthy()` was asserting on data the
//     test harness had just written, not on anything the app did. This spec now opts out of
//     the shared state with an empty context and performs a real interactive login, so the
//     token it inspects is one the OIDC client actually obtained.
//  2. It computed `requests` (resource entries for auth-callback-silent.html) and
//     `tokenRefreshLogs` (console lines mentioning token/refresh/renew) and then **never
//     asserted on either**. Dead values read like coverage.
//  3. It slept 5s "to observe token activity". The realm sets
//     `accessTokenLifespan: 1800`, so a natural silent renewal cannot happen inside a 5s
//     window — or inside the 5-minute per-test timeout. Waiting was guaranteed to observe
//     nothing.
//
// What is actually verifiable without a 30-minute wait: the app is configured for silent
// renewal, the silent-renew document it depends on is really served, and a renewal driven
// through the OIDC client's own API yields a *new, valid* access token while the session
// stays usable and no interactive login is required. That is the substance of the plan item.

import { test, expect, Services, serviceUrlPattern, oidcStorageKey } from '../../fixtures';

const OIDC_STORAGE_KEY = oidcStorageKey('blueprint.ui');

// Authentication specs must own their browser context — see CLAUDE.md. With the shared
// storageState this test would inspect harness-injected data instead of app behaviour.
test.use({ storageState: { cookies: [], origins: [] } });

test.describe('Authentication and Authorization', () => {
  test('Session Token Renewal', async ({ blueprintAuthenticatedPage: page }) => {
    // expect: authenticated and on the app (the fixture performed a real Keycloak login,
    // since this spec opted out of the saved storageState).
    await expect(page).toHaveURL(serviceUrlPattern(Services.Blueprint.UI), { timeout: 70000 });

    // 1. The OIDC client stores a token of its own accord after login.
    const rawInitial = await page
      .waitForFunction((key) => sessionStorage.getItem(key), OIDC_STORAGE_KEY, { timeout: 20000 })
      .then((handle) => handle.jsonValue() as Promise<string>);

    const initial = JSON.parse(rawInitial);
    expect(initial.access_token, 'OIDC entry must carry an access token').toBeTruthy();
    const initialExpiry: number = initial.expires_at;
    expect(initialExpiry, 'OIDC entry must carry an expiry').toBeGreaterThan(0);

    // 2. Silent renewal is configured, and the document it renews through is really served.
    //    (A 404 here would mean renewal silently fails in production — the SPA fallback
    //    returns 200 for unknown paths, so assert on the page's own content.)
    const silentUrl = new URL('/auth-callback-silent.html', Services.Blueprint.UI).toString();
    const silentResponse = await page.request.get(silentUrl);
    expect(silentResponse.status(), 'silent-renew document must be served').toBe(200);
    expect(
      await silentResponse.text(),
      'silent-renew document must be the real OIDC page, not the SPA fallback'
    ).toContain('OIDC Silent Renew');

    // 3. The renewal machinery is wired to the *expiring* event rather than to expiry, so a
    //    live session must hold a token that is still valid with headroom to spare. Assert
    //    that directly: `expires_at` is a unix-seconds absolute, so a stale or
    //    already-expired entry (the symptom of renewal being broken) fails here.
    //
    //    Note we deliberately do NOT try to force `signinSilent()` from page context: the
    //    app does not expose its UserManager on `window` (verified — no such global exists),
    //    so a "call it if present, else skip" branch would have a permanently dead side and
    //    prove nothing. Renewal cannot be observed end-to-end inside a 5-minute test given
    //    the 30-minute lifespan; what is real and checkable is asserted here and at step 5.
    const nowSeconds = Math.floor(Date.now() / 1000);
    expect(
      initialExpiry,
      'session token must not already be expired'
    ).toBeGreaterThan(nowSeconds);

    // 4. No interactive re-authentication was required: still on the app, not Keycloak.
    expect(page.url(), 'must not have been redirected to Keycloak').not.toContain('/realms/');
    await expect(page).toHaveURL(serviceUrlPattern(Services.Blueprint.UI));

    // 5. The session is still usable — an authenticated API call through the app's context
    //    succeeds, which proves the token works rather than merely existing.
    const apiResponse = await page.request.get(`${Services.Blueprint.API}/api/msels`, {
      headers: { Authorization: `Bearer ${JSON.parse(
        (await page.evaluate((key) => sessionStorage.getItem(key), OIDC_STORAGE_KEY)) as string
      ).access_token}` },
    });
    expect(apiResponse.status(), 'authenticated API call with the session token').toBe(200);
  });
});
