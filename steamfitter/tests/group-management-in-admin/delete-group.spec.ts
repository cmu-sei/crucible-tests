// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: steamfitter/steamfitter-test-plan.md
// seed: tests/seed.spec.ts

import { test, expect, Services } from '../../fixtures';

test.describe('Group Management in Admin', () => {
  let groupId: string | null = null;

  test.afterEach(async ({ steamfitterApi }) => {
    // Cleanup in case UI delete failed
    if (groupId) {
      try { await steamfitterApi.delete(`${Services.Steamfitter.API}/api/groups/${groupId}`); } catch {}
    }
  });

  test('Delete Group', async ({ steamfitterAuthenticatedPage: page, steamfitterApi }) => {
    // Setup: create group via authenticated API
    const gResp = await steamfitterApi.post(`${Services.Steamfitter.API}/api/groups`, {
      data: { name: 'Delete Me Group' },
    });
    expect(gResp.ok()).toBeTruthy();
    const group = await gResp.json();
    groupId = group.id;

    await page.goto(`${Services.Steamfitter.UI}/admin`);
    const sidebar = page.locator('mat-sidenav, mat-drawer, [class*="sidebar"]').first();
    await expect(sidebar).toBeVisible({ timeout: 15000 });

    await sidebar.locator('text=Groups').first().click();
    await page.waitForTimeout(1000);

    // Wait for the group to appear in the list
    const groupRow = page.locator('tr', { hasText: 'Delete Me Group' }).first();
    await expect(groupRow).toBeVisible({ timeout: 10000 });

    // Click the group row to expand it
    await groupRow.click();
    await page.waitForTimeout(1000);

    // Click the delete (trash) icon button in the group row
    // The row has two icon buttons: delete (trash) and edit. Delete is the first one.
    const deleteButton = groupRow.locator('button').first();
    await expect(deleteButton).toBeVisible({ timeout: 10000 });
    await deleteButton.click();
    await page.waitForTimeout(500);

    // Confirm deletion in the dialog
    const confirmButton = page.locator('button:has-text("Confirm"), button:has-text("Yes"), button:has-text("Delete"), button:has-text("OK")').last();
    await expect(confirmButton).toBeVisible({ timeout: 5000 });
    await confirmButton.click();
    await page.waitForTimeout(1000);

    // Verify group is removed from list
    await expect(page.locator('text=Delete Me Group')).toHaveCount(0, { timeout: 10000 });

    // Mark as cleaned up
    groupId = null;
  });
});
