// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: steamfitter/steamfitter-test-plan.md
// seed: tests/seed.spec.ts

import { test, expect, Services } from '../../fixtures';

test.describe('Roles and Permissions Management', () => {
  let roleId: string | null = null;

  test.afterEach(async ({ steamfitterApi }) => {
    if (roleId) {
      try { await steamfitterApi.delete(`${Services.Steamfitter.API}/api/system-roles/${roleId}`); } catch {}
    }
  });

  test('Create Custom System Role', async ({ steamfitterAuthenticatedPage: page, steamfitterApi }) => {
    await page.goto(`${Services.Steamfitter.UI}/admin`);
    const sidebar = page.locator('mat-sidenav, mat-drawer, [class*="sidebar"]').first();
    await expect(sidebar).toBeVisible({ timeout: 15000 });

    await sidebar.locator('text=Roles').first().click();
    await page.waitForTimeout(1000);

    // Click the add role button (plus icon in the Permissions column header)
    const addRoleButton = page.locator('th').filter({ hasText: 'Permissions' }).locator('button').first();
    await expect(addRoleButton).toBeVisible({ timeout: 10000 });
    await addRoleButton.click();

    // Wait for the "Create New Role?" dialog to appear
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible({ timeout: 10000 });

    // Fill in the role name
    const nameInput = dialog.getByRole('textbox', { name: 'Name' });
    await expect(nameInput).toBeVisible();
    await nameInput.fill('Custom Viewer');

    // Click Save in the dialog
    await dialog.getByRole('button', { name: 'Save' }).click();
    await page.waitForTimeout(1000);

    // Verify role created - it should appear as a column header in the table
    await expect(page.locator('th').filter({ hasText: 'Custom Viewer' })).toBeVisible({ timeout: 10000 });

    // Get role ID for cleanup
    const resp = await steamfitterApi.get(`${Services.Steamfitter.API}/api/system-roles`);
    if (resp.ok()) {
      const roles = await resp.json();
      const created = roles.find((r: any) => r.name === 'Custom Viewer');
      if (created) roleId = created.id;
    }
  });
});
