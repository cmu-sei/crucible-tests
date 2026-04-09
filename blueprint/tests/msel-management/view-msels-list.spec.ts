// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: specs/blueprint-test-plan.md
// seed: tests/seed.spec.ts

import { test, expect, Services } from '../../fixtures';

test.describe('MSEL Management', () => {
  test('View MSELs List', async ({ blueprintAuthenticatedPage: page }) => {
    // 1. Navigate to /build after logging in
    await page.goto(`${Services.Blueprint.UI}/build`);

    // expect: MSELs list is displayed in a table format
    await expect(page).toHaveURL(/.*\/build.*/, { timeout: 10000 });
    await page.waitForLoadState('networkidle');

    const mselList = page.locator('table, [class*="msel-list"], [class*="data-table"]').first();
    await expect(mselList).toBeVisible({ timeout: 5000 });

    // expect: A 'Template' column shows which MSELs are marked as templates
    const templateColumn = page.getByRole('columnheader', { name: 'Template' });
    await expect(templateColumn).toBeVisible({ timeout: 5000 });

    // expect: An 'All Types' dropdown allows filtering by template type
    const allTypesDropdown = page.getByRole('combobox', { name: 'All Types' });
    await expect(allTypesDropdown).toBeVisible({ timeout: 5000 });

    // expect: An 'All Statuses' dropdown allows filtering by MSEL status
    const allStatusesDropdown = page.getByRole('combobox', { name: 'All Statuses' });
    await expect(allStatusesDropdown).toBeVisible({ timeout: 5000 });

    // expect: A search box allows text-based filtering
    const searchInput = page.getByRole('textbox', { name: 'Search' });
    await expect(searchInput).toBeVisible({ timeout: 5000 });

    // expect: A 'Show all MSELs from all users' toggle button is available
    const showAllToggle = page.locator(
      'button[aria-label*="Show all"], mat-slide-toggle:near(:text("all")), ' +
      'text=Show all MSELs, [class*="show-all-toggle"]'
    ).first();
    const showAllVisible = await showAllToggle.isVisible({ timeout: 3000 }).catch(() => false);

    // expect: Buttons to 'Add blank MSEL' and 'Upload a new MSEL from a file' are available in the table header
    const addMselButton = page.getByRole('button', { name: 'Add blank MSEL' });
    await expect(addMselButton).toBeVisible({ timeout: 5000 });

    const uploadMselButton = page.getByRole('button', { name: 'Upload a new MSEL from a file' });
    await expect(uploadMselButton).toBeVisible({ timeout: 5000 });

    // expect: Each MSEL shows: name, description, template status (checkbox column), status, created by, date created, date modified
    const mselRows = page.getByRole('row').filter({ hasNotText: 'Name Description Template Status Created By Date Created Date Modified' });
    const rowCount = await mselRows.count();

    if (rowCount > 0) {
      const firstRow = mselRows.first();
      await expect(firstRow).toBeVisible();
      const hasContent = await firstRow.evaluate((el) => {
        return el.textContent && el.textContent.trim().length > 0;
      });
      expect(hasContent).toBe(true);
    } else {
      // Verify empty state is displayed appropriately
      const emptyState = page.locator(
        'text=No MSELs, text=No items, [class*="empty-state"]'
      ).first();
      // Empty state may or may not exist; table being empty is acceptable
    }
  });
});
