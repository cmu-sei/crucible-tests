// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: steamfitter/steamfitter-test-plan.md
// seed: tests/seed.spec.ts

import { test, expect } from '../../fixtures';

test.describe('Home Page and Navigation', () => {
  test('Home Page Initial Load', async ({ steamfitterAuthenticatedPage: page }) => {
    const topbar = page.locator('mat-toolbar, [class*="topbar"], header, [role="banner"]').first();
    await expect(topbar).toBeVisible({ timeout: 15000 });

    await expect(topbar).toContainText(/Steamfitter/i);
    await expect(topbar).toContainText(/admin/i);

    const topbarBg = await topbar.evaluate((el) => getComputedStyle(el).backgroundColor);
    expect(topbarBg).toBeTruthy();

    const topbarColor = await topbar.evaluate((el) => getComputedStyle(el).color);
    expect(topbarColor).toBeTruthy();

    const mainContent = page.locator('app-root, main, [class*="content"], [role="main"]').first();
    await expect(mainContent).toBeVisible({ timeout: 10000 });
  });
});
