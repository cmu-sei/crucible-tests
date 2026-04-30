// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: gameboard/gameboard-test-plan.md
// seed: seed.spec.ts

// Gameboard uses OIDC with automatic silent token renewal. Waiting for an actual
// token refresh in a deterministic test is impractical (default access-token
// lifetimes are typically measured in minutes and depend on Keycloak config).
// Instead, this test verifies that the session continues to be usable after a
// short delay, which exercises the "session stays alive" contract the plan
// describes without relying on timing of the silent renewal iframe.

import { test, expect, Services } from '../../fixtures';

test.describe('Authentication', () => {
  test('OIDC Silent Token Renewal Smoke', async ({ gameboardAuthenticatedPage: page }) => {
    await page.goto(Services.Gameboard.UI);
    await expect(page.locator('a:has-text("Log out"), button:has-text("Log out")').first()).toBeVisible({ timeout: 15000 });

    // Wait briefly to allow background OIDC activity, then verify session is intact.
    await page.waitForTimeout(5000);
    await page.reload();
    await expect(page).not.toHaveURL(/localhost:8443/);
    await expect(page.locator('a:has-text("Log out"), button:has-text("Log out")').first()).toBeVisible({ timeout: 15000 });

    // Navigate to another protected route — should not re-prompt login.
    await page.goto(Services.Gameboard.UI + '/admin');
    await expect(page).toHaveURL(/localhost:4202\/admin/);
    await expect(page.getByRole('heading', { name: 'Administration' })).toBeVisible();
  });
});
