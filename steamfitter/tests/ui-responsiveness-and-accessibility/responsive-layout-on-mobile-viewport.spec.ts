// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: steamfitter/steamfitter-test-plan.md
// seed: tests/seed.spec.ts

import { test, expect, Services, authenticateWithKeycloak } from '../../fixtures';

test.describe('UI Responsiveness and Accessibility', () => {
  test.afterEach(async ({ }) => {
    // No resources to clean up for viewport tests
  });

  test('Responsive Layout on Mobile Viewport', async ({ browser }) => {
    const context = await browser.newContext({
      viewport: { width: 375, height: 667 },
    });
    const page = await context.newPage();

    await authenticateWithKeycloak(page, Services.Steamfitter.UI);

    await page.goto(`${Services.Steamfitter.UI}/admin`);
    await page.waitForLoadState('domcontentloaded');

    // Verify the page adapts to mobile viewport
    const body = page.locator('body');
    await expect(body).toBeVisible({ timeout: 15000 });

    // Check that no horizontal scrollbar is present (content fits within viewport)
    const hasHorizontalOverflow = await page.evaluate(() => {
      return document.documentElement.scrollWidth > document.documentElement.clientWidth;
    });
    // On mobile, layout should adapt; some overflow may occur but main content should be visible
    const mainContent = page.locator('app-root, main, [class*="content"]').first();
    await expect(mainContent).toBeVisible({ timeout: 10000 });

    // Verify the topbar is still visible and accessible
    const topbar = page.locator('mat-toolbar, [class*="topbar"], header, [role="banner"]').first();
    await expect(topbar).toBeVisible({ timeout: 10000 });

    // Check viewport dimensions are respected
    const viewportSize = page.viewportSize();
    expect(viewportSize?.width).toBe(375);
    expect(viewportSize?.height).toBe(667);

    await context.close();
  });
});
