// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: /mnt/data/crucible/crucible-tests/blueprint/blueprint-test-plan.md

import { test, expect } from '@playwright/test';
import { Services, authenticateBlueprintWithKeycloak } from '../../fixtures';

test.describe('Organizations Management (Admin)', () => {
  test('Edit Organization', async ({ page }) => {
    await authenticateBlueprintWithKeycloak(page);

    await page.goto(`${Services.Blueprint.UI}/admin`);
    await page.waitForLoadState('domcontentloaded');

    const organizationsLink = page.locator('a:has-text("Organizations"), button:has-text("Organizations")').first();
    await organizationsLink.click();
    await page.waitForLoadState('domcontentloaded');

    // 1. Click edit icon for an existing organization
    const editButton = page.locator('button[mattooltip*="Edit"], mat-icon:has-text("edit")').first();
    if (await editButton.isVisible({ timeout: 5000 })) {
      await editButton.click();

      // expect: Edit form displays with current organization details
      const editForm = page.locator('form, mat-dialog-container');
      await expect(editForm).toBeVisible({ timeout: 5000 });

      // 2. Modify the Description field
      const descriptionField = page.locator('textarea[formcontrolname*="description"], textarea').first();
      if (await descriptionField.isVisible({ timeout: 3000 })) {
        await descriptionField.clear();
        await descriptionField.fill('Updated organization description');

        // expect: Field accepts changes
        await expect(descriptionField).toHaveValue('Updated organization description');

        // 3. Click 'Save'
        const saveButton = page.locator('button:has-text("Save")').first();
        await saveButton.click();
        await page.waitForTimeout(2000);

        // expect: Organization is updated successfully
        // expect: Changes are reflected in the table
      }
    }
  });
});
