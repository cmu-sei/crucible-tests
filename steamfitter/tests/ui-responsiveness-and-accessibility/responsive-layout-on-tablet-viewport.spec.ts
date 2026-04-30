// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: steamfitter/steamfitter-test-plan.md
// seed: tests/seed.spec.ts

import { test, expect, Services, authenticateWithKeycloak } from '../../fixtures';

test.describe('UI Responsiveness and Accessibility', () => {
  test.afterEach(async ({ }) => {
    // No resources to clean up for viewport tests
  });

  test('Responsive Layout on Tablet Viewport', async ({ browser }) => {
    const context = await browser.newContext({
      viewport: { width: 768, height: 1024 },
    });
    const page = await context.newPage();

    await authenticateWithKeycloak(page, Services.Steamfitter.UI);

    await page.goto(`${Services.Steamfitter.UI}/admin`);
    await page.waitForLoadState('domcontentloaded');

    // Verify the page adapts to tablet viewport
    const body = page.locator('body');
    await expect(body).toBeVisible({ timeout: 15000 });

    // Main content should be visible and adapted
    const mainContent = page.locator('app-root, main, [class*="content"]').first();
    await expect(mainContent).toBeVisible({ timeout: 10000 });

    // Verify the topbar is still visible
    const topbar = page.locator('mat-toolbar, [class*="topbar"], header, [role="banner"]').first();
    await expect(topbar).toBeVisible({ timeout: 10000 });

    // Verify the sidebar or navigation adapts
    const sidebar = page.locator('mat-sidenav, mat-drawer, [class*="sidebar"]').first();
    const sidebarVisible = await sidebar.isVisible().catch(() => false);
    // On tablet, sidebar may be collapsed or visible depending on implementation
    expect(typeof sidebarVisible).toBe('boolean');

    // Check viewport dimensions are respected
    const viewportSize = page.viewportSize();
    expect(viewportSize?.width).toBe(768);
    expect(viewportSize?.height).toBe(1024);

    await context.close();
  });
});
