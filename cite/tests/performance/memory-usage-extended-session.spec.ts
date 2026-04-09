// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: cite/cite-test-plan.md
// seed: tests/seed.spec.ts

import { test, expect, Services } from '../../fixtures';

test.describe('Performance', () => {
  test('Memory Usage - Extended Session', async ({ citeAuthenticatedPage: page }) => {

    // 1. Log in and navigate through various pages and sections
    await expect(page).toHaveURL(/localhost:4721/, { timeout: 10000 });

    // Get initial memory usage
    const initialMemory = await page.evaluate(() => {
      if ((performance as any).memory) {
        return (performance as any).memory.usedJSHeapSize;
      }
      return 0;
    });

    // Navigate through multiple pages
    for (let i = 0; i < 5; i++) {
      // Go to evaluation
      const rows = page.locator('mat-row, tbody tr, [class*="evaluation-row"]');
      if (await rows.first().isVisible({ timeout: 5000 }).catch(() => false)) {
        await rows.first().click();
        await page.waitForLoadState('domcontentloaded');
        await page.waitForTimeout(500);
      }

      // Go back home
      await page.goto(Services.Cite.UI);
      await page.waitForLoadState('domcontentloaded');
      await page.waitForTimeout(500);
    }

    // Get final memory usage
    const finalMemory = await page.evaluate(() => {
      if ((performance as any).memory) {
        return (performance as any).memory.usedJSHeapSize;
      }
      return 0;
    });

    // expect: Memory usage remains stable (no more than 3x growth)
    if (initialMemory > 0 && finalMemory > 0) {
      expect(finalMemory).toBeLessThan(initialMemory * 3);
    }

    // expect: Application performance does not degrade over time
  });
});
