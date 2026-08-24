// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: specs/blueprint-test-plan.md
// seed: tests/seed.spec.ts

import { test, expect } from '../../fixtures';
import { getBlueprintToken, createMsel, deleteMsel, tempBlueprintName, navigateToMsel } from '../../test-helpers';

test.describe('MSEL Management', () => {
  test('View MSEL Details', async ({ blueprintAuthenticatedPage: page }) => {
    const token = await getBlueprintToken();
    const mselName = tempBlueprintName('ViewDetails');

    // 1. Seed a MSEL via API
    const createdMsel = await createMsel(token, {
      name: mselName,
      description: 'Test MSEL for viewing details',
    });

    try {
      // 2. Navigate to the MSEL detail page
      await navigateToMsel(page, createdMsel.id);

      // expect: The MSEL detail view is displayed with sections
      const infoSection = page.locator('mat-list-item').filter({ hasText: 'Info' });
      await expect(infoSection).toBeVisible({ timeout: 10000 });

      // expect: Multiple sections are available
      const sections = ['Contributors', 'Teams', 'Organizations', 'Scenario Events'];
      for (const sectionName of sections) {
        const section = page.locator('mat-list-item').filter({ hasText: sectionName });
        await expect(section).toBeVisible();
      }

      // expect: MSEL name and description are visible in the Config tab
      const configTab = page.getByRole('tab', { name: 'Config' });
      await expect(configTab).toBeVisible();

      const nameField = page.getByRole('textbox', { name: 'Name' });
      await expect(nameField).toHaveValue(mselName);

      const descField = page.getByRole('textbox', { name: 'Description' });
      await expect(descField).toHaveValue('Test MSEL for viewing details');
    } finally {
      // 3. Clean up: delete the MSEL
      await deleteMsel(token, createdMsel.id);
    }
  });
});
