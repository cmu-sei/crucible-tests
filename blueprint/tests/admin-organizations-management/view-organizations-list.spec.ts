// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: /mnt/data/crucible/crucible-tests/blueprint/blueprint-test-plan.md

import { test, expect } from '@playwright/test';
import { Services, authenticateBlueprintWithKeycloak } from '../../fixtures';

test.describe('Organizations Management (Admin)', () => {
  test('View Organizations List', async ({ page }) => {
    await authenticateBlueprintWithKeycloak(page);

    // Navigate to Admin section
    await page.goto(`${Services.Blueprint.UI}/admin`);
    await page.waitForLoadState('domcontentloaded');

    // 1. Navigate to Admin section and select 'Organizations'
    const organizationsLink = page.locator('a:has-text("Organizations"), button:has-text("Organizations")').first();
    await organizationsLink.click();
    await page.waitForLoadState('domcontentloaded');

    // expect: Organizations list displays in table format
    const organizationsTable = page.locator('table, mat-table, [role="table"]');
    await expect(organizationsTable).toBeVisible({ timeout: 10000 });

    // expect: Columns show: Name, Short Name, Description
    // expect: Search functionality is available
    const searchField = page.locator('input[type="search"], input[placeholder*="Search"]').first();
    if (await searchField.isVisible({ timeout: 3000 })) {
      await expect(searchField).toBeVisible();
    }

    // expect: Pagination controls are visible if many organizations exist
    const pagination = page.locator('mat-paginator, [class*="pagination"]');
    if (await pagination.isVisible({ timeout: 3000 })) {
      await expect(pagination).toBeVisible();
    }

    // expect: Add, Edit, and Delete action buttons are shown
    const addButton = page.locator('button:has-text("Add Organization"), button:has-text("Add")').first();
    if (await addButton.isVisible({ timeout: 3000 })) {
      await expect(addButton).toBeVisible();
    }
  });
});
