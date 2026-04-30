// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: steamfitter/steamfitter-test-plan.md
// seed: tests/seed.spec.ts

import { test, expect, Services } from '../../fixtures';

test.describe('Group Management in Admin', () => {
  let groupId: string | null = null;

  test.afterEach(async ({ steamfitterApi }) => {
    if (groupId) {
      try { await steamfitterApi.delete(`${Services.Steamfitter.API}/api/groups/${groupId}`); } catch {}
    }
  });

  test('Remove Member from Group', async ({ steamfitterAuthenticatedPage: page, steamfitterApi }) => {
    // Setup: create group via authenticated API
    const gResp = await steamfitterApi.post(`${Services.Steamfitter.API}/api/groups`, {
      data: { name: 'Remove Member Group' },
    });
    expect(gResp.ok()).toBeTruthy();
    const group = await gResp.json();
    groupId = group.id;

    await page.goto(`${Services.Steamfitter.UI}/admin`);
    const sidebar = page.locator('mat-sidenav, mat-drawer, [class*="sidebar"]').first();
    await expect(sidebar).toBeVisible({ timeout: 15000 });

    await sidebar.locator('text=Groups').first().click();
    await page.waitForTimeout(1000);

    // Select the group to expand it
    await page.locator('text=Remove Member Group').first().click();
    await page.waitForTimeout(1000);

    // First, add a member via the UI (click "Add [username]" button in Users panel)
    const addUserButton = page.getByRole('button', { name: /^Add / }).first();
    await expect(addUserButton).toBeVisible({ timeout: 10000 });
    await addUserButton.click();
    await page.waitForTimeout(1000);

    // Verify member was added - "no members" message should disappear
    await expect(page.locator('text=This Group currently has no members')).toHaveCount(0, { timeout: 10000 });

    // Now remove the member using the "Remove [username]" button in the Group Members section
    const removeButton = page.getByRole('button', { name: /^Remove / }).first();
    await expect(removeButton).toBeVisible({ timeout: 10000 });
    await removeButton.click();
    await page.waitForTimeout(1000);

    // Verify member was removed - "This Group currently has no members" should reappear
    await expect(page.locator('text=This Group currently has no members')).toBeVisible({ timeout: 10000 });
  });
});
