// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: specs/blueprint-test-plan.md
// seed: tests/seed.spec.ts

import { test, expect, Services } from '../../fixtures';
import { acquireAdminCatalogLock, releaseAdminCatalogLock } from '../../test-helpers';

test.describe('Admin - Inject Types and Catalogs Management', () => {
  // Serialize access to the shared admin Catalogs / Inject Types pages: they are not
  // safely concurrent because of BP-16 (one unfiltered global inject store shared by an
  // app-inject-list mounted per row). See acquireAdminCatalogLock in test-helpers.
  test.beforeEach(async () => {
    await acquireAdminCatalogLock();
  });

  test.afterEach(async () => {
    await releaseAdminCatalogLock();
  });

  test('View Inject Types List', async ({ blueprintAuthenticatedPage: page }) => {
    // 1. Navigate to Admin section and select 'Inject Types'
    await page.goto(`${Services.Blueprint.UI}/admin`);
    await expect(page).toHaveURL(/\/admin/, { timeout: 10000 });

    const injectTypesNav = page.locator(
      'mat-list-item:has-text("Inject Types"), a:has-text("Inject Types"), button:has-text("Inject Types")'
    ).first();
    await expect(injectTypesNav).toBeVisible({ timeout: 5000 });
    await injectTypesNav.click();

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
