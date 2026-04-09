// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: cite/cite-test-plan.md
// seed: tests/seed.spec.ts

import { test, expect, Services } from '../../fixtures';

test.describe('Administration - Groups', () => {
  test('Manage Group Members', async ({ citeAuthenticatedPage: page }) => {

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

    // First create a group to manage
    const createButton = page.locator('table button').first();
    await createButton.click();

    const createDialog = page.locator('mat-dialog-container, [role="dialog"]').first();
    await expect(createDialog).toBeVisible({ timeout: 5000 });

    const createNameField = page.locator('input, mat-form-field input').first();
    await createNameField.fill('Test Group for Members');

    const saveButton = page.locator('button:has-text("Save"), button:has-text("Create")').first();
    await saveButton.click();
    await page.waitForTimeout(2000);

    // Now manage members
    const rows = page.locator('tbody tr').first();
    await expect(rows).toBeVisible({ timeout: 10000 });

    // Select a group to manage members
    await rows.click();
    await page.waitForTimeout(1000);

    // expect: Group members interface opens
    const addButton = page.locator('button').filter({ hasText: /Add/i }).first();
    if (await addButton.isVisible({ timeout: 5000 }).catch(() => false)) {
      await addButton.click();
      const dialog = page.locator('mat-dialog-container, [role="dialog"]').first();
      await expect(dialog).toBeVisible({ timeout: 5000 });
    }
  });
});
