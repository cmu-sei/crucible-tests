// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: cite/cite-test-plan.md
// seed: tests/seed.spec.ts

import { test, expect, Services } from '../../fixtures';
import { CITE_THEMES, applyCiteTheme } from '../../test-helpers';

for (const theme of CITE_THEMES) {

  test.describe(`${theme} theme › Administration - Groups`, () => {
  test('Groups Section', async ({ citeAuthenticatedPage: page }) => {
    await applyCiteTheme(page, theme);

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

    await page.waitForLoadState('domcontentloaded');
    const content = page.locator('mat-table, table, [class*="group"], [class*="list"]').first();
    await expect(content).toBeVisible({ timeout: 10000 });
  });
  });
}
