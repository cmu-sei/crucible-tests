// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: specs/blueprint-test-plan.md
// seed: tests/seed.spec.ts

import { test, expect, Services } from '../../fixtures';
import { getBlueprintToken, createMsel, deleteMsel, tempBlueprintName } from '../../test-helpers';

test.describe('MSEL Management', () => {
  test('View MSELs List', async ({ blueprintAuthenticatedPage: page }) => {
    const token = await getBlueprintToken();
    const mselName = tempBlueprintName('ListView');

    // 1. Seed a MSEL via API
    const createdMsel = await createMsel(token, {
      name: mselName,
      description: 'Test MSEL for list view',
    });

    try {
      // 2. Navigate to MSELs list
      await page.goto(`${Services.Blueprint.UI}/build`);

      // expect: MSELs list is visible with a table
      const mselTable = page.getByRole('table');
      await expect(mselTable).toBeVisible({ timeout: 10000 });

      // expect: Column headers are visible
      const expectedHeaders = ['Name', 'Description', 'Template', 'Status', 'Created', 'Modified'];
      for (const header of expectedHeaders) {
        const columnHeader = page.getByRole('columnheader', { name: header });
        await expect(columnHeader).toBeVisible();
      }

      // expect: Search box is available
      const searchBox = page.getByRole('textbox', { name: 'Search' });
      await expect(searchBox).toBeVisible();

      // expect: Type and Status filters are available
      const typeFilter = page.getByRole('combobox', { name: 'All Types' });
      await expect(typeFilter).toBeVisible();

      const statusFilter = page.getByRole('combobox', { name: 'All Statuses' });
      await expect(statusFilter).toBeVisible();

      // expect: Action buttons are visible (Add blank MSEL, Upload)
      const addButton = page.getByRole('button', { name: 'Add blank MSEL' });
      await expect(addButton).toBeVisible();

      const uploadButton = page.getByRole('button', { name: 'Upload a new MSEL from a file' });
      await expect(uploadButton).toBeVisible();

      // expect: Our seeded MSEL is findable via search
      await searchBox.fill(mselName);
      const mselRow = page.getByRole('row').filter({ hasText: mselName });
      await expect(mselRow).toBeVisible({ timeout: 10000 });

      // expect: MSEL row shows name, description, and status
      await expect(mselRow).toContainText(mselName);
      await expect(mselRow).toContainText('Test MSEL for list view');
      await expect(mselRow).toContainText('Pending');
    } finally {
      // 3. Clean up: delete the MSEL
      await deleteMsel(token, createdMsel.id);
    }
  });
});
