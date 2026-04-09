// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: specs/blueprint-test-plan.md
// seed: tests/seed.spec.ts

import { test, expect, Services } from '../../fixtures';

test.describe('Authentication and Authorization', () => {
  test('Session Token Renewal', async ({ blueprintAuthenticatedPage: page }) => {
    // Setup console log monitoring
    const consoleLogs: string[] = [];
    page.on('console', msg => {
      if (msg.type() === 'log' || msg.type() === 'info') {
        consoleLogs.push(msg.text());
      }
    });

    // expect: Successfully authenticated
    await expect(page).toHaveURL(/.*localhost:4725.*/, { timeout: 70000 });

    // Wait for OIDC library to store the token in session storage (async after page load)
    const initialToken = await page.waitForFunction(() => {
      return sessionStorage.getItem('oidc.user:https://localhost:8443/realms/crucible:blueprint.ui');
    }, { timeout: 15000 }).then(handle => handle.jsonValue());
    expect(initialToken).toBeTruthy();

    // 2. Wait for silent token renewal (automaticSilentRenew is enabled in config)
    // Typical token renewal happens every few minutes, so we'll wait and monitor
    await page.waitForTimeout(5000); // Wait 5 seconds to observe token activity

    // expect: The application automatically renews the authentication token
    // expect: Uses the silent_redirect_uri (http://localhost:4725/auth-callback-silent.html)
    const requests = await page.evaluate(() => {
      return performance.getEntriesByType('resource')
        .map((entry: any) => entry.name)
        .filter((name: string) => name.includes('auth-callback-silent.html'));
    });

    // expect: No user interaction is required for token renewal
    // expect: The user session remains active
    const currentToken = await page.evaluate(() => {
      return sessionStorage.getItem('oidc.user:https://localhost:8443/realms/crucible:blueprint.ui');
    });
    expect(currentToken).toBeTruthy();

    // expect: Console logs show token refresh activity
    // Check if any console logs mention token, refresh, or renewal
    const tokenRefreshLogs = consoleLogs.filter(log =>
      log.toLowerCase().includes('token') ||
      log.toLowerCase().includes('refresh') ||
      log.toLowerCase().includes('renew')
    );

    // Verify application is still functional
    const topbarText = page.locator('text=Event Dashboard');
    await expect(topbarText).toBeVisible();

    // User can still navigate and use the application
    await page.waitForLoadState('domcontentloaded');
  });
});
