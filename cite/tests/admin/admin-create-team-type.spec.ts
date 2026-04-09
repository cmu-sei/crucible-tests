// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: cite/cite-test-plan.md
// seed: tests/seed.spec.ts

import { test, expect, Services } from '../../fixtures';

test.describe('Administration - Team Types', () => {
  test('Create Team Type', async ({ citeAuthenticatedPage: page }) => {

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

    await page.waitForTimeout(1000);

    const createButton = page.locator('button').filter({ hasText: /Add|Create/i }).first();
    await expect(createButton).toBeVisible({ timeout: 10000 });
    await createButton.click();

    const dialog = page.locator('mat-dialog-container, [role="dialog"]').first();
    await expect(dialog).toBeVisible({ timeout: 5000 });

    const nameField = page.locator('input, mat-form-field input').first();
    await nameField.fill('Test Team Type');

    const saveButton = page.locator('button:has-text("Save"), button:has-text("Create")').first();
    await saveButton.click();
    await page.waitForLoadState('domcontentloaded');
  });
});
