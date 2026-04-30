// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: steamfitter/steamfitter-test-plan.md
// seed: tests/seed.spec.ts

import { test, expect, Services } from '../../fixtures';

test.describe('Roles and Permissions Management', () => {
  let roleId: string | null = null;

  test.afterEach(async ({ steamfitterApi }) => {
    // Cleanup in case UI delete failed
    if (roleId) {
      try { await steamfitterApi.delete(`${Services.Steamfitter.API}/api/system-roles/${roleId}`); } catch {}
    }
  });

  test('Delete Custom System Role', async ({ steamfitterAuthenticatedPage: page, steamfitterApi }) => {
    // Setup: create custom role via API
    const rResp = await steamfitterApi.post(`${Services.Steamfitter.API}/api/system-roles`, {
      data: { name: 'Delete Me Role' },
    });
    expect(rResp.ok()).toBeTruthy();
    const role = await rResp.json();
    roleId = role.id;

    await page.goto(`${Services.Steamfitter.UI}/admin`);
    const sidebar = page.locator('mat-sidenav, mat-drawer, [class*="sidebar"]').first();
    await expect(sidebar).toBeVisible({ timeout: 15000 });

    await sidebar.locator('text=Roles').first().click();
    await page.waitForTimeout(1000);

    // The role appears as a column header in the roles table
    const roleHeader = page.locator('th').filter({ hasText: 'Delete Me Role' });
    await expect(roleHeader).toBeVisible({ timeout: 10000 });

    // Click the "Delete Role" button within the column header
    const deleteButton = roleHeader.getByRole('button', { name: 'Delete Role' });
    await expect(deleteButton).toBeVisible({ timeout: 10000 });
    await deleteButton.click();

    // Confirm deletion in the dialog
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible({ timeout: 5000 });
    // Click the confirm/yes button in the dialog
    const confirmButton = dialog.getByRole('button').filter({ hasText: /Yes|Confirm|Delete|OK/ }).first();
    await expect(confirmButton).toBeVisible({ timeout: 5000 });
    await confirmButton.click();
    await page.waitForTimeout(1000);

    // Verify role is removed from the table
    await expect(page.locator('th').filter({ hasText: 'Delete Me Role' })).toBeHidden({ timeout: 10000 });

    // Mark as cleaned up
    roleId = null;
  });
});
