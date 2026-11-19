// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: cite/cite-test-plan.md
// seed: tests/seed.spec.ts

import { test, expect, Services, serviceUrlPattern, CITE_THEMES, setCiteTheme, citeMoveLabel } from '../../fixtures';

for (const theme of CITE_THEMES) {
  test.describe(`${theme} theme › Performance`, () => {
    test('Memory Usage - Extended Session', async ({ citeAuthenticatedPage: page }) => {
      await setCiteTheme(page, theme);

      // 1. Log in and navigate through various pages and sections
      await expect(page).toHaveURL(serviceUrlPattern(Services.Cite.UI), { timeout: 10000 });

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
        const rowVisible = await rows.first().waitFor({ state: 'visible', timeout: 5000 }).then(() => true, () => false);
        if (rowVisible) {
          await rows.first().getByRole('link').click();
          await page.waitForLoadState('domcontentloaded');
          // Wait for evaluation detail page to load (anchor on evaluation-specific content)
          await expect(citeMoveLabel(page)).toBeVisible({ timeout: 5000 });
        }

        // Go back home
        await page.goto(Services.Cite.UI);
        await page.waitForLoadState('domcontentloaded');
        // Wait for home page to load
        await expect(page.getByText('My Evaluations')).toBeVisible({ timeout: 5000 });
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
}
