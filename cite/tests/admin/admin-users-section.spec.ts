// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: cite/cite-test-plan.md
// seed: tests/seed.spec.ts

import { test, expect, Services } from '../../fixtures';

test.describe('Administration - Users', () => {
  test('Users Section', async ({ citeAuthenticatedPage: page }) => {

    await page.goto(`${Services.Cite.UI}/admin`);
    await page.waitForLoadState('domcontentloaded');

    const usersLink = page.locator('text=Users, a:has-text("Users"), mat-list-item:has-text("Users")').first();
    await expect(usersLink).toBeVisible({ timeout: 10000 });
    await usersLink.click();

    await page.waitForLoadState('domcontentloaded');

    const content = page.locator('mat-table, table, [class*="user"], [class*="list"]').first();
    await expect(content).toBeVisible({ timeout: 10000 });

    // expect: Search functionality is available
    const searchField = page.locator('input[type="text"], input[placeholder*="search"], input[placeholder*="Search"]').first();
    await expect(searchField).toBeVisible({ timeout: 5000 });
  });
});
