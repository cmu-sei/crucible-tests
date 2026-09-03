// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: specs/blueprint-test-plan.md
// seed: tests/seed.spec.ts

import { test, expect, Services, selectMatSelectOption } from '../../fixtures';
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

      // Every selection below goes through selectMatSelectOption. Clicking a mat-select trigger
      // does not reliably leave the panel open, and an option resolved just before Material
      // tears the overlay down detaches mid-click ("element was detached from the DOM,
      // retrying") — which is exactly how this spec flaked, on the "Not Templates" step. The
      // helper reopens and reissues rather than waiting longer on a panel that is already gone.
      //
      // The trigger is located positionally and reused, never by accessible name: a
      // mat-select's name is its CURRENT selection ("All Types", then "Templates", ...), so a
      // name-based locator goes stale the moment a filter is applied. The MSEL list renders
      // exactly two comboboxes — type first, then status.
      const typeDropdown = page.getByRole('combobox').first();
      await expect(typeDropdown).toBeVisible({ timeout: 10000 });

      await selectMatSelectOption(
        page,
        typeDropdown,
        page.getByRole('option', { name: 'Templates', exact: true })
      );

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
      await selectMatSelectOption(
        page,
        typeDropdown,
        page.getByRole('option', { name: 'All Types', exact: true })
      );

      // expect: Both MSELs are now visible
      await searchBox.fill(templateName);
      await expect(page.getByRole('row').filter({ hasText: templateName })).toBeVisible({ timeout: 10000 });

      await searchBox.clear();
      await searchBox.fill(nonTemplateName);
      await expect(page.getByRole('row').filter({ hasText: nonTemplateName })).toBeVisible({ timeout: 10000 });

      // 4. Test "Not Templates" filter
      await searchBox.clear();
      await selectMatSelectOption(
        page,
        typeDropdown,
        page.getByRole('option', { name: 'Not Templates', exact: true })
      );

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
