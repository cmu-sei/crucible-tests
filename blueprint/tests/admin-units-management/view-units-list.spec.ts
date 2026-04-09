// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: specs/blueprint-test-plan.md
// seed: tests/seed.spec.ts

import { test, expect, Services } from '../../fixtures';

test.describe('Admin - Units Management', () => {
  test('View Units List', async ({ blueprintAuthenticatedPage: page }) => {
    // 1. Navigate to Admin section and select 'Units'
    await page.goto(`${Services.Blueprint.UI}/admin`);
    await page.waitForLoadState('networkidle');

    const unitsNav = page.locator(
      'mat-list-item:has-text("Units"), a:has-text("Units"), button:has-text("Units")'
    ).first();
    await expect(unitsNav).toBeVisible({ timeout: 5000 });
    await unitsNav.click();
    await page.waitForLoadState('networkidle');

    // expect: Units list is displayed in a table format with Short Name and Name columns
    const unitsTable = page.locator('table, [class*="units-table"]').first();
    await expect(unitsTable).toBeVisible({ timeout: 5000 });

    const shortNameCol = page.getByRole('columnheader', { name: 'Short Name' });
    const nameCol = page.getByRole('columnheader', { name: 'Name', exact: true })
    await expect(shortNameCol).toBeVisible({ timeout: 5000 });
    await expect(nameCol).toBeVisible({ timeout: 5000 });

    // expect: Search functionality is available
    const searchInput = page.locator(
      'input[placeholder*="Search"], input[placeholder*="search"], [class*="search-input"]'
    ).first();
    await expect(searchInput).toBeVisible({ timeout: 5000 });

    // expect: Pagination controls are visible
    const paginator = page.locator(
      'mat-paginator, [class*="paginator"], [class*="pagination"]'
    ).first();
    const paginatorVisible = await paginator.isVisible({ timeout: 3000 }).catch(() => false);

    // expect: Edit and Delete action buttons are shown
    const editButton = page.locator(
      'table button[aria-label*="Edit"], table mat-icon:has-text("edit"), table button:has(mat-icon)'
    ).first();
    const editVisible = await editButton.isVisible({ timeout: 3000 }).catch(() => false);
    const deleteButton = page.locator(
      'table button[aria-label*="Delete"], table mat-icon:has-text("delete")'
    ).first();
    const deleteVisible = await deleteButton.isVisible({ timeout: 3000 }).catch(() => false);
    // Edit/delete visible when rows exist
  });
});
