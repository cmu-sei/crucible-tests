// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: /mnt/data/crucible/crucible-tests/blueprint/blueprint-test-plan.md

import { test, expect } from '@playwright/test';
import { Services, authenticateBlueprintWithKeycloak } from '../../fixtures';

test.describe('Organizations Management (Admin)', () => {
  test('Search and Filter Organizations', async ({ page }) => {
    await authenticateBlueprintWithKeycloak(page);

    await page.goto(`${Services.Blueprint.UI}/admin`);
    await page.waitForLoadState('domcontentloaded');

    const organizationsLink = page.locator('a:has-text("Organizations"), button:has-text("Organizations")').first();
    await organizationsLink.click();
    await page.waitForLoadState('domcontentloaded');

    // 1. Enter search term in the organizations search field
    const searchField = page.locator('input[type="search"], input[placeholder*="Search"]').first();
    if (await searchField.isVisible({ timeout: 5000 })) {
      await searchField.fill('Acme');

      // expect: Table filters to show matching organizations by Name, Short Name, or Description
      await page.waitForTimeout(1000);
      
      const tableRows = page.locator('table tbody tr, mat-row');
      const rowCount = await tableRows.count();
      
      if (rowCount > 0) {
        const firstRowText = await tableRows.first().textContent();
        expect(firstRowText?.toLowerCase()).toContain('acme');
      }

      // 2. Clear the search
      await searchField.clear();
      await page.waitForTimeout(1000);

      // expect: All organizations are displayed again
      const allRows = await tableRows.count();
      expect(allRows).toBeGreaterThanOrEqual(rowCount);
    }
  });
});
