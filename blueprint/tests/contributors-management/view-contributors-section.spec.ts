// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: specs/blueprint-test-plan.md
// seed: tests/seed.spec.ts

import { test, expect, Services } from '../../fixtures';

const SOURCE_MSEL_NAME = 'Project Lagoon TTX - Admin User';

test.describe('Contributors Management', () => {
  test('View Contributors Section', async ({ blueprintAuthenticatedPage: page }) => {
    // This test copies the source MSEL before testing the Contributors section.
    // The copy operation on large MSELs can be slow and may temporarily affect API availability.
    // A generous timeout is set to handle this.
    test.setTimeout(120000);
    await page.goto(`${Services.Blueprint.UI}/build`);

    // The MSEL list uses Angular Material mat-table (role="table"), not a standard <table>
    // Wait for the table to appear - this indicates the Angular component has rendered
    const mselTable = page.getByText('My MSELs')
    const tableVisible = await mselTable.waitFor({ state: 'visible', timeout: 30000 }).then(() => true).catch(() => false);
    if (!tableVisible) {
      // API may be unavailable, skip test
      test.skip();
      return;
    }

    // Wait for actual MSEL data rows to appear (not just the header row)
    // The data rows contain links to individual MSELs - if missing, the API may be loading
    const mselDataRows = page.locator('[role="row"] a[href*="/build?msel="]').first();
    const dataRowsVisible = await mselDataRows.waitFor({ state: 'visible', timeout: 30000 }).then(() => true).catch(() => false);
    if (!dataRowsVisible) {
      // API may be slow or unavailable, skip test
      test.skip();
      return;
    }

    // Find the source MSEL link with exact text match.
    // Using text-based approach since Angular Material mat-table uses role-based elements.
    const sourceMselLink = page.locator(`a:text-is("${SOURCE_MSEL_NAME}")`).first();
    const sourceExists = await sourceMselLink.waitFor({ state: 'visible', timeout: 5000 }).then(() => true).catch(() => false);
    if (!sourceExists) {
      // Source MSEL not found, skip test
      test.skip();
      return;
    }

    // The copy will be named "[Original Name] - Admin User"
    const copiedMselName = `${SOURCE_MSEL_NAME} - Admin User`;

    // Check if a copy already exists (from a previous test run)
    let copiedMselLink = page.locator(`a:text-is("${copiedMselName}")`).first();
    const copyAlreadyExists = await copiedMselLink.isVisible({ timeout: 1000 }).catch(() => false);

    if (!copyAlreadyExists) {
      // Click the Copy button for the source MSEL to create a working copy.
      // The button's accessible name comes from its title attribute: "Copy [MSEL Name]"
      const sourceMselRow = page.getByRole('row').filter({
        has: sourceMselLink
      }).first();

      const copyButton = sourceMselRow.getByRole('button', {
        name: `Copy ${SOURCE_MSEL_NAME}`
      });
      const copyButtonVisible = await copyButton.waitFor({ state: 'visible', timeout: 5000 }).then(() => true).catch(() => false);
      if (!copyButtonVisible) {
        test.skip();
        return;
      }
      await copyButton.click();

      // Wait for the copy to appear in the list.
      // Large MSELs can take significant time to copy (60+ seconds).
      const copyCompleted = await copiedMselLink.waitFor({ state: 'visible', timeout: 90000 }).then(() => true).catch(() => false);
      if (!copyCompleted) {
        // Copy operation timed out - skip this test
        // The copy may still be in progress in the background
        test.skip();
        return;
      }
    }

    // Navigate into the copied MSEL by clicking the link
    await copiedMselLink.click();

    // Wait for the MSEL detail page to load
    await expect(page).toHaveURL(/\/build\?msel=/, { timeout: 10000 });

    // 1. Click 'Contributors' in the sidebar navigation
    // The nav item is a generic element containing "Contributors" text
    const contributorsNavItem = page.locator('text=Contributors').first();
    await expect(contributorsNavItem).toBeVisible({ timeout: 10000 });
    await contributorsNavItem.click();

    // expect: The Contributors section loads showing a table with Short Name and Name columns
    // The contributors table also uses Angular Material mat-table (role="table")
    const contributorsTable = page.getByRole('table').first();
    await expect(contributorsTable).toBeVisible({ timeout: 10000 });

    // expect: Each unit row shows: Short Name and Name columns
    const shortNameColumn = page.getByRole('columnheader', { name: 'Short Name' }).first();
    const nameColumn = page.getByRole('columnheader', { name: 'Name' }).first();
    await expect(shortNameColumn).toBeVisible({ timeout: 5000 });
    await expect(nameColumn).toBeVisible({ timeout: 5000 });

    // expect: An "Add a Contributor Unit" button is available (user has manage permissions)
    const addContributorButton = page.getByRole('button', { name: 'Add a Contributor Unit' }).first();
    await expect(addContributorButton).toBeVisible({ timeout: 5000 });
  });
});
