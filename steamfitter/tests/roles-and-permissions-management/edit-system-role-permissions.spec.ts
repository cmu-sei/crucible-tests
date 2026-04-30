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

  test('Edit System Role Permissions', async ({ steamfitterAuthenticatedPage: page, steamfitterApi }) => {
    // Setup: create custom role via API
    const rResp = await steamfitterApi.post(`${Services.Steamfitter.API}/api/system-roles`, {
      data: { name: 'Edit Perms Role' },
    });
    expect(rResp.ok()).toBeTruthy();
    const role = await rResp.json();
    roleId = role.id;

    await page.goto(`${Services.Steamfitter.UI}/admin`);
    const sidebar = page.locator('mat-sidenav, mat-drawer, [class*="sidebar"]').first();
    await expect(sidebar).toBeVisible({ timeout: 15000 });

    await sidebar.locator('text=Roles').first().click();
    await page.waitForTimeout(1000);

    // The roles are displayed as columns; find the column for our role
    const roleHeader = page.locator('th').filter({ hasText: 'Edit Perms Role' });
    await expect(roleHeader).toBeVisible({ timeout: 10000 });

    // Determine the column index of our role by finding its position among all th elements
    const allHeaders = page.locator('thead th, tr th');
    const headerCount = await allHeaders.count();
    let colIndex = -1;
    for (let i = 0; i < headerCount; i++) {
      const text = await allHeaders.nth(i).textContent();
      if (text && text.includes('Edit Perms Role')) {
        colIndex = i;
        break;
      }
    }
    expect(colIndex).toBeGreaterThan(0);

    // Each row is a permission with checkboxes per role column.
    // Toggle the ViewScenarioTemplates permission for our role.
    const viewTemplatesRow = page.locator('tr').filter({ hasText: 'ViewScenarioTemplates' });
    await expect(viewTemplatesRow).toBeVisible({ timeout: 10000 });

    // Get all cells in the row. Both the header (th) and body (td) rows have the
    // same number of columns in 1:1 correspondence, so colIndex maps directly.
    const cells = viewTemplatesRow.locator('td');
    const targetCell = cells.nth(colIndex);

    // Click the checkbox wrapper in this cell to toggle the permission
    const checkbox = targetCell.locator('input[type="checkbox"]');
    const checkboxWrapper = targetCell.locator('[class*="mat-mdc-checkbox"], mat-checkbox').first();
    const hasWrapper = await checkboxWrapper.isVisible({ timeout: 3000 }).catch(() => false);
    if (hasWrapper) {
      await checkboxWrapper.click();
    } else {
      await checkbox.first().click();
    }

    // Verify the checkbox is now checked (auto-retrying assertion)
    await expect(checkbox.first()).toBeChecked({ timeout: 10000 });
  });
});
