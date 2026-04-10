// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: topomojo/topomojo-test-plan.md
// seed: tests/seed.spec.ts

import { test, expect, Services } from '../../fixtures';

test.describe('Admin Panel', () => {
  test('Admin - Workspace Browser', async ({ topomojoAuthenticatedPage: page }) => {

    // 1. Navigate to home page
    await page.goto(Services.TopoMojo.UI);
    await page.waitForLoadState('domcontentloaded');

    // 2. TopoMojo requires an additional login step after Keycloak authentication
    // Check if we need to login (identity provider button visible) or if already logged in (Admin button visible)
    const adminButton = page.getByRole('button', { name: 'Admin' });
    const loginButton = page.getByRole('button', { name: /identity provider|login/i });

    // Race between the two buttons appearing - one indicates we need to login, the other that we're already logged in
    try {
      await Promise.race([
        loginButton.waitFor({ state: 'visible', timeout: 10000 }),
        adminButton.waitFor({ state: 'visible', timeout: 10000 })
      ]);
    } catch (error) {
      throw new Error(`Neither login button nor Admin button appeared within 10 seconds. Current URL: ${page.url()}`);
    }

    // Check which button is visible
    const loginVisible = await loginButton.isVisible();

    if (loginVisible) {
      // Click the identity provider login button
      await loginButton.click();

      // Wait for redirect to Keycloak login page
      await page.waitForURL(url => url.hostname === 'localhost' && url.port === '8443', { timeout: 30000 });
      await page.waitForLoadState('domcontentloaded');

      // Fill in Keycloak credentials (the fixture may have an expired session)
      await page.getByRole('textbox', { name: /username|email/i }).fill('admin');
      await page.getByRole('textbox', { name: /password/i }).fill('admin');
      await page.getByRole('button', { name: /sign in|login/i }).click();

      // Wait for redirect back to TopoMojo
      await page.waitForURL(url => url.hostname === 'localhost' && url.port === '4201', { timeout: 30000 });
      await page.waitForLoadState('domcontentloaded');

      // Wait for the Admin button to appear after successful login
      await adminButton.waitFor({ state: 'visible', timeout: 10000 });
    }

    // 3. Click on 'Admin' button in navigation
    await adminButton.click();
    await page.waitForURL(/\/admin/, { timeout: 10000 });
    await page.waitForLoadState('domcontentloaded');

    // 4. Click on 'Workspaces' link in admin navigation
    const workspacesLink = page.getByRole('link', { name: 'Workspaces' });
    await workspacesLink.click();
    await page.waitForURL(/\/admin\/workspaces/, { timeout: 10000 });
    await page.waitForLoadState('domcontentloaded');

    // expect: Admin workspace browser loads
    // expect: All workspaces are listed in table format
    const workspaceHeader = page.locator('.workspace-header');
    await expect(workspaceHeader).toBeVisible({ timeout: 10000 });

    // expect: At least one workspace row is visible
    const workspaceRows = page.locator('.workspace-row');
    await expect(workspaceRows.first()).toBeVisible({ timeout: 10000 });
  });
});
