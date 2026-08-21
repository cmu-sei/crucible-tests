// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: specs/blueprint-test-plan.md
// seed: tests/seed.spec.ts

import { test, expect, Services, serviceUrlPattern } from '../../fixtures';

/**
 * Logout is RP-initiated OIDC logout, and this spec asserts that contract rather than a
 * particular resting URL.
 *
 * The previous version asserted `toHaveURL(Keycloak)` after clicking Logout and was recorded as
 * an app defect. It is not one. `ComnAuthService.logout()` calls `signoutRedirect()`, which
 * navigates to Keycloak's end-session endpoint with an `id_token_hint` and the registered
 * `post_logout_redirect_uri`. Given a valid hint Keycloak skips its "Do you want to log out?"
 * prompt, ends the session, and immediately redirects back to the app — so the browser is never
 * observably parked on a Keycloak URL. Waiting longer cannot help.
 *
 * Two further notes on why this spec is shaped the way it is:
 *
 *   - It opts out of the shared pre-authenticated `storageState`. The `blueprintAuthenticatedPage`
 *     fixture replays the captured OIDC `sessionStorage` through `page.addInitScript`, which runs
 *     on *every* navigation — including the post-logout redirect back to the app. With that in
 *     place the app is handed a token again the instant it reloads, so a logged-out state cannot
 *     be observed at all. Opting out costs one interactive Keycloak login.
 *   - It does not read `sessionStorage` directly. Storage is per-origin and the app leaves its
 *     own origin as soon as logout completes, so a post-logout read would either race the
 *     navigation or inspect Keycloak's storage instead. The final assertion — that returning to
 *     Blueprint requires a fresh login — is a strictly stronger check: it fails if either the
 *     local token or the Keycloak SSO session survived.
 */
test.describe('Authentication and Authorization', () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test('User Logout Flow', async ({ blueprintAuthenticatedPage: page }) => {
    // expect: Successfully authenticated and viewing the home page
    await expect(page).toHaveURL(serviceUrlPattern(Services.Blueprint.UI), { timeout: 10000 });
    const topbarText = page.locator('text=Event Dashboard');
    await expect(topbarText).toBeVisible();

    // Capture the end-session call as it is issued. This is the observable evidence that the
    // app really signed out, and it has to be armed before the click because the request and
    // the redirect back both happen faster than any polling could catch them.
    const endSessionRequest = page.waitForRequest(
      (request) => request.url().includes('/protocol/openid-connect/logout'),
      { timeout: 30000 }
    );

    // 2. Click on the user menu in the topbar
    const userMenu = page.getByRole('button', { name: /Admin User/i });
    await userMenu.click();

    // expect: A dropdown menu appears with logout option
    const logoutOption = page.getByRole('menuitem', { name: 'Logout' });
    await expect(logoutOption).toBeVisible({ timeout: 3000 });

    // 3. Click 'Logout' option
    await logoutOption.click();

    // expect: the app called Keycloak's end-session endpoint, identifying the session to end
    // and naming where to come back to.
    const logoutUrl = new URL((await endSessionRequest).url());
    expect(logoutUrl.href).toMatch(serviceUrlPattern(Services.Keycloak));
    expect(logoutUrl.searchParams.get('id_token_hint')).toBeTruthy();
    expect(logoutUrl.searchParams.get('post_logout_redirect_uri')).toContain(
      Services.Blueprint.UI
    );

    // expect: the session is gone — reaching Blueprint again requires re-authenticating, which
    // means neither the browser's copy of the token nor Keycloak's SSO session survived.
    await page.goto(Services.Blueprint.UI);
    await expect(page.locator('input[name="username"]')).toBeVisible({ timeout: 30000 });
    await expect(page).toHaveURL(serviceUrlPattern(Services.Keycloak), { timeout: 30000 });
  });
});
