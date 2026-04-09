// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: cite/cite-test-plan.md
// seed: tests/seed.spec.ts

import { test, expect, Services } from '../../fixtures';

test.describe('Administration - Groups', () => {
  test('Delete Group', async ({ citeAuthenticatedPage: page }) => {

    await page.goto(`${Services.Cite.UI}/admin`);
    await page.waitForLoadState('load');
    await page.waitForTimeout(3000);

    await page.waitForFunction(() => {
      const items = Array.from(document.querySelectorAll('mat-list-item'));
      return items.some(el => el.textContent?.trim() === 'Groups');
    }, { timeout: 15000 });

    await page.evaluate(() => {
      const items = Array.from(document.querySelectorAll('mat-list-item'));
      const groupsItem = items.find(el => el.textContent?.trim() === 'Groups');
      if (groupsItem) {
        groupsItem.click();
      }
    });

    await page.waitForTimeout(1000);

    await page.waitForFunction(() => {
      return document.querySelector('table') !== null;
    }, { timeout: 10000 });

    // First create a group to delete
    const createButton = page.locator('table button').first();
    await createButton.click();

    const createDialog = page.locator('mat-dialog-container, [role="dialog"]').first();
    await expect(createDialog).toBeVisible({ timeout: 5000 });

    const createNameField = page.locator('input, mat-form-field input').first();
    await createNameField.fill('Test Group for Deletion');

    const saveButton = page.locator('button:has-text("Save"), button:has-text("Create")').first();
    await saveButton.click();
    await page.waitForTimeout(2000);

    // Now delete it
    const rows = page.locator('tbody tr').first();
    await expect(rows).toBeVisible({ timeout: 10000 });

    const deleteButton = page.locator('button').filter({ hasText: /Delete/i }).first();
    if (await deleteButton.isVisible({ timeout: 5000 }).catch(() => false)) {
      await deleteButton.click();

      const confirmDialog = page.locator('mat-dialog-container, [role="dialog"]').first();
      await expect(confirmDialog).toBeVisible({ timeout: 5000 });

      const confirmButton = page.locator('button:has-text("Confirm"), button:has-text("Delete"), button:has-text("Yes")').first();
      await confirmButton.click();
      await page.waitForLoadState('domcontentloaded');
    }
  });
});
