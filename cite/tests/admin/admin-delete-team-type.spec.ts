// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: cite/cite-test-plan.md
// seed: tests/seed.spec.ts

import { test, expect, Services } from '../../fixtures';

test.describe('Administration - Team Types', () => {
  test('Delete Team Type', async ({ citeAuthenticatedPage: page }) => {

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

    const deleteButton = page.locator('button:has(mat-icon:has-text("delete")), button[aria-label*="delete"]').first();
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
