// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: specs/blueprint-test-plan.md
// seed: tests/seed.spec.ts

import { test, expect, Services } from '../../fixtures';
import { getBlueprintToken, createMsel, deleteMsel, tempBlueprintName } from '../../test-helpers';

test.describe('MSEL Management', () => {
  test('Filter MSELs by Type', async ({ blueprintAuthenticatedPage: page }) => {
    const token = await getBlueprintToken();
    const templateName = tempBlueprintName('Template');
    const nonTemplateName = tempBlueprintName('NonTemplate');

    // 1. Seed one template and one non-template MSEL via API
    const templateMsel = await createMsel(token, {
      name: templateName,
      description: 'Template MSEL',
      isTemplate: true,
    });

    const nonTemplateMsel = await createMsel(token, {
      name: nonTemplateName,
      description: 'Non-template MSEL',
      isTemplate: false,
    });

    try {
      // 2. Navigate to /build and filter by Templates
      await page.goto(`${Services.Blueprint.UI}/build`);
      await expect(page.getByRole('table')).toBeVisible({ timeout: 10000 });

      const allTypesDropdown = page.getByRole('combobox', { name: 'All Types' });
      await expect(allTypesDropdown).toBeVisible();
      await allTypesDropdown.click();

      const templateOption = page.getByRole('option', { name: 'Templates', exact: true });
      await expect(templateOption).toBeVisible();
      await templateOption.click();

      // expect: Only template MSELs appear
      // Search for our template - it should be visible
      const searchBox = page.getByRole('textbox', { name: 'Search' });
      await searchBox.fill(templateName);
      const templateRow = page.getByRole('row').filter({ hasText: templateName });
      await expect(templateRow).toBeVisible({ timeout: 10000 });

      // Search for our non-template - it should not be visible
      await searchBox.clear();
      await searchBox.fill(nonTemplateName);
      const noResults = page.locator('text=No results found');
      await expect(noResults).toBeVisible({ timeout: 10000 });

      // 3. Reset filter to 'All Types'
      await searchBox.clear();
      const typeDropdown = page.getByRole('combobox').first();
      await typeDropdown.click();
      const allTypesOption = page.getByRole('option', { name: 'All Types' });
      await expect(allTypesOption).toBeVisible();
      await allTypesOption.click();

      // expect: Both MSELs are now visible
      await searchBox.fill(templateName);
      await expect(page.getByRole('row').filter({ hasText: templateName })).toBeVisible({ timeout: 10000 });

      await searchBox.clear();
      await searchBox.fill(nonTemplateName);
      await expect(page.getByRole('row').filter({ hasText: nonTemplateName })).toBeVisible({ timeout: 10000 });

      // 4. Test "Not Templates" filter
      await searchBox.clear();
      await typeDropdown.click();
      const notTemplatesOption = page.getByRole('option', { name: 'Not Templates' });
      await expect(notTemplatesOption).toBeVisible();
      await notTemplatesOption.click();

      // expect: Only non-template MSELs appear
      await searchBox.fill(nonTemplateName);
      await expect(page.getByRole('row').filter({ hasText: nonTemplateName })).toBeVisible({ timeout: 10000 });

      await searchBox.clear();
      await searchBox.fill(templateName);
      await expect(page.locator('text=No results found')).toBeVisible({ timeout: 10000 });
    } finally {
      // 5. Clean up: delete both MSELs
      await deleteMsel(token, templateMsel.id);
      await deleteMsel(token, nonTemplateMsel.id);
    }
  });
});
