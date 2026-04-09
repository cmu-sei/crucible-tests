// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: cite/cite-test-plan.md
// seed: tests/seed.spec.ts

import { test, expect, Services } from '../../fixtures';

test.describe('Administration - Team Types', () => {
  test('Edit Team Type', async ({ citeAuthenticatedPage: page }) => {

    await page.goto(`${Services.Cite.UI}/admin`);
    await page.waitForLoadState('load');
    await page.waitForTimeout(3000);

    await page.waitForFunction(() => {
      const items = Array.from(document.querySelectorAll('mat-list-item'));
      return items.some(el => el.textContent?.trim() === 'Team Types');
    }, { timeout: 15000 });

    await page.evaluate(() => {
      const items = Array.from(document.querySelectorAll('mat-list-item'));
      const teamTypesItem = items.find(el => el.textContent?.trim() === 'Team Types');
      if (teamTypesItem) {
        teamTypesItem.click();
      }
    });

    const rows = page.locator('mat-row, tbody tr').first();
    await expect(rows).toBeVisible({ timeout: 10000 });

    const editButton = page.locator('button:has(mat-icon:has-text("edit")), button[aria-label*="edit"]').first();
    if (await editButton.isVisible({ timeout: 3000 }).catch(() => false)) {
      await editButton.click();
    } else {
      await rows.click();
    }

    const dialog = page.locator('mat-dialog-container, [role="dialog"]').first();
    if (await dialog.isVisible({ timeout: 5000 }).catch(() => false)) {
      const nameField = page.locator('input, mat-form-field input').first();
      const currentValue = await nameField.inputValue();
      await nameField.fill(currentValue + ' (edited)');

      const saveButton = page.locator('button:has-text("Save"), button:has-text("Update")').first();
      await saveButton.click();
      await page.waitForLoadState('domcontentloaded');
    }
  });
});
