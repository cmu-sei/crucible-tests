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

  test('Create New Group', async ({ steamfitterAuthenticatedPage: page, steamfitterApi }) => {
    await page.goto(`${Services.Steamfitter.UI}/admin`);
    const sidebar = page.locator('mat-sidenav, mat-drawer, [class*="sidebar"]').first();
    await expect(sidebar).toBeVisible({ timeout: 15000 });

    await sidebar.locator('text=Groups').first().click();
    await page.waitForTimeout(1000);

    // Click the add (+) button in the table header
    const table = page.locator('table').first();
    await expect(table).toBeVisible({ timeout: 10000 });
    const addButton = table.locator('button:not([disabled])').first();
    await addButton.click();
    await page.waitForTimeout(500);

    // Fill in name 'Test Group'
    const nameInput = page.locator('input[placeholder*="ame"], input[formcontrolname*="name"], input[type="text"]').first();
    await expect(nameInput).toBeVisible({ timeout: 10000 });
    await nameInput.fill('Test Group');

    // Save
    const saveButton = page.locator('button:has-text("Save"), button:has-text("Create"), button:has-text("Submit"), button[type="submit"]').first();
    await saveButton.click();
    await page.waitForTimeout(1000);

    // Verify group appears in list
    await expect(page.locator('text=Test Group').first()).toBeVisible({ timeout: 10000 });

    // Get group ID for cleanup
    const resp = await steamfitterApi.get(`${Services.Steamfitter.API}/api/groups`);
    if (resp.ok()) {
      const groups = await resp.json();
      const created = groups.find((g: any) => g.name === 'Test Group');
      if (created) groupId = created.id;
    }
  });
});
