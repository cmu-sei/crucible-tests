// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: cite/cite-test-plan.md
// seed: tests/seed.spec.ts

import { test, expect, Services } from '../../fixtures';

test.describe('Administration - Users', () => {
  test('View User Details', async ({ citeAuthenticatedPage: page }) => {

    await page.goto(`${Services.Cite.UI}/admin`);
    await page.waitForLoadState('domcontentloaded');

    const usersLink = page.locator('text=Users, a:has-text("Users"), mat-list-item:has-text("Users")').first();
    await expect(usersLink).toBeVisible({ timeout: 10000 });
    await usersLink.click();

    const rows = page.locator('mat-row, tbody tr').first();
    await expect(rows).toBeVisible({ timeout: 10000 });

    await rows.click();
    await page.waitForLoadState('domcontentloaded');

    // expect: User details page or dialog opens
    const details = page.locator('[class*="detail"], [class*="user-detail"], mat-dialog-container, [role="dialog"], mat-expansion-panel').first();
    await expect(details).toBeVisible({ timeout: 10000 });
  });
});
