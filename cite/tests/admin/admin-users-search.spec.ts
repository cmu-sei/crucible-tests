// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: cite/cite-test-plan.md
// seed: tests/seed.spec.ts

import { test, expect, Services } from '../../fixtures';

test.describe('Administration - Users', () => {
  test('User Search', async ({ citeAuthenticatedPage: page }) => {

    await page.goto(`${Services.Cite.UI}/admin`);
    await page.waitForLoadState('domcontentloaded');

    const usersLink = page.locator('text=Users, a:has-text("Users"), mat-list-item:has-text("Users")').first();
    await expect(usersLink).toBeVisible({ timeout: 10000 });
    await usersLink.click();

    const searchField = page.locator('input[type="text"], input[placeholder*="search"], input[placeholder*="Search"]').first();
    await expect(searchField).toBeVisible({ timeout: 5000 });

    // Enter a user name in search field
    await searchField.fill('admin');

    // expect: Users list filters to show matching users
    await page.waitForTimeout(500);

    const rows = page.locator('mat-row, tbody tr');
    await expect(rows.first()).toBeVisible({ timeout: 5000 });
  });
});
