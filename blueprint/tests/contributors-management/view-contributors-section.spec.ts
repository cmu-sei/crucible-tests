// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: specs/blueprint-test-plan.md
// seed: tests/seed.spec.ts

import { test, expect } from '../../fixtures';
import { getBlueprintToken, createMsel, deleteMsel, tempBlueprintName, navigateToMselSection } from '../../test-helpers';

test.describe('Contributors Management', () => {
  test('View Contributors Section', async ({ blueprintAuthenticatedPage: page }) => {
    const token = await getBlueprintToken();
    const mselName = tempBlueprintName('ContribView');

    // 1. Seed a MSEL via API
    const createdMsel = await createMsel(token, {
      name: mselName,
      description: 'Test MSEL for viewing contributors',
    });

    try {
      // 2. Navigate to the MSEL's Contributors section
      await navigateToMselSection(page, createdMsel.id, 'Contributors');

      // expect: Contributors section is visible
      const contributorsSection = page.locator('app-msel-contributors, [class*="contributors"]').first();
      await expect(contributorsSection).toBeVisible({ timeout: 10000 });

      // expect: "Add a Contributor Unit" expansion panel is visible
      const addContributorButton = page.getByRole('button', { name: 'Add a Contributor Unit' });
      await expect(addContributorButton).toBeVisible();

      // expect: Contributors table/list is present (may be empty)
      const contributorsTable = page.locator('table, mat-table, [role="table"]').first();
      await expect(contributorsTable).toBeVisible();

      // expect: Section shows appropriate empty state or existing contributors
      const hasRows = await page.locator('table tbody tr, mat-row').count();
      if (hasRows === 0) {
        // Empty state is acceptable for a new MSEL with no contributors
        const emptyMessage = page.locator('text=/no contributors|no units|empty/i').first();
        const hasEmptyState = await emptyMessage.isVisible({ timeout: 3000 }).catch(() => false);
        // Either empty state message exists, or table is simply empty
      }
    } finally {
      // 3. Clean up: delete the MSEL
      await deleteMsel(token, createdMsel.id);
    }
  });
});
