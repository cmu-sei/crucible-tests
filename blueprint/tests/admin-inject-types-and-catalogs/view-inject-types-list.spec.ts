// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: specs/blueprint-test-plan.md
// seed: tests/seed.spec.ts

import { test, expect, Services } from '../../fixtures';

test.describe('Admin - Inject Types and Catalogs Management', () => {
  test('View Inject Types List', async ({ blueprintAuthenticatedPage: page }) => {
    // 1. Navigate to Admin section and select 'Inject Types'
    await page.goto(`${Services.Blueprint.UI}/admin`);
    await page.waitForLoadState('networkidle');

    const injectTypesNav = page.locator(
      'mat-list-item:has-text("Inject Types"), a:has-text("Inject Types"), button:has-text("Inject Types")'
    ).first();
    await expect(injectTypesNav).toBeVisible({ timeout: 5000 });
    await injectTypesNav.click();
    await page.waitForLoadState('networkidle');

    // expect: Inject Types list is displayed with Name and Description columns
    const injectTypesTable = page.locator('table, [class*="inject-types-table"]').first();
    await expect(injectTypesTable).toBeVisible({ timeout: 5000 });

    const nameCol = page.getByRole('columnheader', { name: 'Name' });
    await expect(nameCol).toBeVisible({ timeout: 5000 });

    const descCol = page.getByRole('columnheader', { name: 'Description' });
    await expect(descCol).toBeVisible({ timeout: 5000 });

    // expect: Search functionality is available
    const searchInput = page.locator(
      'input[placeholder*="Search"], input[placeholder*="search"], [class*="search-input"]'
    ).first();
    await expect(searchInput).toBeVisible({ timeout: 5000 });

    // expect: Add, Edit, and Delete buttons are available
    const addButton = page.getByRole('button', { name: 'Add new inject type' });
    await expect(addButton).toBeVisible({ timeout: 5000 });
  });
});
