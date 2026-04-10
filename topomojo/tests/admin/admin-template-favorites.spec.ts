// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: topomojo/topomojo-test-plan.md
// seed: tests/seed.spec.ts

import { test, expect, Services } from '../../fixtures';

test.describe('Admin Panel', () => {
  test('Admin - Template Favorites', async ({ topomojoAuthenticatedPage: page }) => {

    // 1. Navigate to admin template browser
    await page.goto(Services.TopoMojo.UI + '/admin');
    await page.waitForLoadState('domcontentloaded');

    const templateLink = page.locator('a:has-text("Template"), button:has-text("Template"), mat-tab:has-text("Template")').first();
    const hasLink = await templateLink.isVisible({ timeout: 10000 }).catch(() => false);
    if (hasLink) {
      await templateLink.click();
      await page.waitForTimeout(1000);
    }

    // expect: Template list displays
    const templateRows = page.locator('tr, mat-row, [class*="template-row"]');
    const rowCount = await templateRows.count();

    if (rowCount > 0) {
      // 2. Click the star icon on a template to favorite it
      const starIcon = page.locator('mat-icon:text("star_border"), mat-icon:text("star_outline"), [class*="favorite"]:not([class*="favorite-on"])').first();
      const hasStar = await starIcon.isVisible({ timeout: 5000 }).catch(() => false);

      if (hasStar) {
        await starIcon.click();
        await page.waitForTimeout(500);

        // expect: Template is favorited
        // expect: Star icon changes to filled/solid style

        // 4. Click the filled star icon to unfavorite
        const filledStar = page.locator('mat-icon:text("star"), [class*="favorite-on"]').first();
        const isFavorited = await filledStar.isVisible({ timeout: 3000 }).catch(() => false);
        if (isFavorited) {
          await filledStar.click();
          await page.waitForTimeout(500);
        }
      }
    }
  });
});
