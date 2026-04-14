// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: topomojo/topomojo-test-plan.md
// seed: tests/seed.spec.ts

import { test, expect, Services } from '../../fixtures';

test.describe('Admin Panel', () => {
  test('Admin Dashboard Access', async ({ topomojoAuthenticatedPage: page }) => {

    // 1. Navigate to home page
    await page.goto(Services.TopoMojo.UI);
    await page.waitForLoadState('domcontentloaded');

    // 2. Wait for Admin button to confirm authentication (fixture already authenticated)
    // The Admin button only appears after auth state is set - wait generously to avoid race conditions
    const adminButton = page.getByRole('button', { name: 'Admin' });

    try {
      await adminButton.waitFor({ state: 'visible', timeout: 30000 });
    } catch (error) {
      throw new Error(`Admin button did not appear within 30 seconds. Current URL: ${page.url()}`);
    }

    // 3. Click on 'Admin' button in navigation
    await adminButton.click();
    await page.waitForURL(/\/admin/, { timeout: 10000 });
    await page.waitForLoadState('domcontentloaded');

    // expect: Admin dashboard loads
    await expect(page).toHaveURL(/\/admin/, { timeout: 10000 });

    // expect: Admin dashboard heading is visible
    const adminHeading = page.getByRole('heading', { name: 'Admin Dashboard' });
    await expect(adminHeading).toBeVisible({ timeout: 15000 });

    // expect: Dashboard shows admin navigation sections (Dashboard, Gamespaces, Workspaces, Templates, Machines, Users, Settings, Log)
    const dashboardLink = page.getByRole('link', { name: 'Dashboard' });
    const gamespacesLink = page.getByRole('link', { name: 'Gamespaces' });
    const workspacesLink = page.getByRole('link', { name: 'Workspaces' });
    const templatesLink = page.getByRole('link', { name: 'Templates' });
    const machinesLink = page.getByRole('link', { name: 'Machines' });
    const usersLink = page.getByRole('link', { name: 'Users' });
    const settingsLink = page.getByRole('link', { name: 'Settings' });
    const logLink = page.getByRole('link', { name: 'Log' });

    // Verify all admin navigation links are visible
    await expect(dashboardLink).toBeVisible();
    await expect(gamespacesLink).toBeVisible();
    await expect(workspacesLink).toBeVisible();
    await expect(templatesLink).toBeVisible();
    await expect(machinesLink).toBeVisible();
    await expect(usersLink).toBeVisible();
    await expect(settingsLink).toBeVisible();
    await expect(logLink).toBeVisible();
  });
});
