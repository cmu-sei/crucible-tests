// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: steamfitter/steamfitter-test-plan.md
// seed: tests/seed.spec.ts

import { test, expect } from '@playwright/test';
import { Services } from '../../fixtures';

test.describe('Authentication and Authorization', () => {
  test('Unauthorized Access Redirect', async ({ page }) => {
    // Fresh browser context has no cookies or localStorage, so no clearing is needed.
    // Navigate directly to a protected route; the app should redirect to Keycloak.
    await page.goto(`${Services.Steamfitter.UI}/admin`, { waitUntil: 'domcontentloaded' });

    const keycloakHost = new URL(Services.Keycloak).host;
    await page.waitForURL(
      (url) => url.host === keycloakHost || url.toString().includes('/realms/crucible'),
      { timeout: 180000 }
    );

    await expect(page.locator('input[name="username"]')).toBeVisible({ timeout: 30000 });
  });
});
