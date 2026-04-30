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

  test('Add Members to Group', async ({ steamfitterAuthenticatedPage: page, steamfitterApi }) => {
    // Setup: create group via authenticated API
    const gResp = await steamfitterApi.post(`${Services.Steamfitter.API}/api/groups`, {
      data: { name: 'Members Test Group' },
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
    await page.locator('text=Members Test Group').first().click();
    await page.waitForTimeout(1000);

    // The expanded view shows a "Users" panel (left) and "Group Members" panel (right).
    // Users have "Add [username]" buttons to add them to the group.
    // Click the "Add Admin User" button to add Admin User to the group.
    const addUserButton = page.getByRole('button', { name: /^Add / }).first();
    await expect(addUserButton).toBeVisible({ timeout: 10000 });
    await addUserButton.click();
    await page.waitForTimeout(1000);

    // Verify the member now appears in the Group Members section on the right.
    // The Group Members panel should no longer say "no members".
    const groupMembersSection = page.locator('text=Group Members').first();
    await expect(groupMembersSection).toBeVisible({ timeout: 10000 });

    // Verify a user row appears in the Group Members table (right side)
    // The Group Members table should now contain the user we just added
    await expect(page.locator('text=This Group currently has no members')).toHaveCount(0, { timeout: 10000 });
  });
});
