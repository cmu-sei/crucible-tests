// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: specs/blueprint-test-plan.md
// seed: tests/seed.spec.ts

import { test, expect, Services } from '../../fixtures';
import { getBlueprintToken, deleteMsel } from '../../test-helpers';

test.describe('MSEL Management', () => {
  test('Create New MSEL', async ({ blueprintAuthenticatedPage: page }) => {
    const token = await getBlueprintToken();
    let createdMselId: string | null = null;

    try {
      // 1. Navigate to MSELs list
      await page.goto(`${Services.Blueprint.UI}/build`);
      await expect(page.getByRole('table')).toBeVisible({ timeout: 10000 });

      // 2. Click 'Add blank MSEL' button
      const createButton = page.getByRole('button', { name: 'Add blank MSEL' });
      await expect(createButton).toBeVisible();
      await createButton.click();

      // expect: Blueprint creates a "New MSEL" and redirects to its detail page
      await expect(page).toHaveURL(/.*\/build\?msel=.*/, { timeout: 10000 });

      // Extract the MSEL ID from the URL for cleanup
      const url = page.url();
      const match = url.match(/msel=([a-f0-9-]+)/);
      if (match) {
        createdMselId = match[1];
      }

      // expect: The MSEL detail page loads showing the Info section
      const infoSection = page.locator('mat-list-item').filter({ hasText: 'Info' });
      await expect(infoSection).toBeVisible({ timeout: 10000 });

      // expect: Default MSEL name "New MSEL" is visible in the title or name field
      const nameField = page.getByRole('textbox', { name: /Name/i }).first();
      await expect(nameField).toBeVisible();
      await expect(nameField).toHaveValue(/New MSEL/);
    } finally {
      // 3. Clean up: delete the created MSEL
      if (createdMselId) {
        await deleteMsel(token, createdMselId);
      }
    }
  });
});
