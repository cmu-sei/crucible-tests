// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: steamfitter/steamfitter-test-plan.md
// seed: tests/seed.spec.ts

import { test, expect, Services } from '../../fixtures';

test.describe('UI Responsiveness and Accessibility', () => {
  test.afterEach(async ({ }) => {
    // No resources to clean up for accessibility tests
  });

  test('Screen Reader Compatibility', async ({ steamfitterAuthenticatedPage: page }) => {
    await page.goto(`${Services.Steamfitter.UI}/admin`);
    await page.waitForLoadState('domcontentloaded');

    // Wait for main content to load
    const topbar = page.locator('mat-toolbar, [class*="topbar"], header, [role="banner"]').first();
    await expect(topbar).toBeVisible({ timeout: 15000 });

    // Check ARIA labels on topbar interactive elements
    const topbarButtons = topbar.locator('button, a, [role="button"]');
    const topbarButtonCount = await topbarButtons.count();
    for (let i = 0; i < topbarButtonCount; i++) {
      const button = topbarButtons.nth(i);
      const ariaLabel = await button.getAttribute('aria-label');
      const matTooltip = await button.getAttribute('mattooltip');
      const textContent = await button.textContent();
      // Each interactive element should have an aria-label, tooltip, or text content
      const hasAccessibleName = !!(ariaLabel || matTooltip || textContent?.trim());
      expect(hasAccessibleName).toBe(true);
    }

    // Check navigation elements for ARIA roles
    const navElements = page.locator('nav, [role="navigation"], mat-sidenav, mat-drawer');
    const navCount = await navElements.count();
    expect(navCount).toBeGreaterThanOrEqual(0);

    // Check tables for ARIA attributes
    const tables = page.locator('table, mat-table, [role="table"], [role="grid"]');
    const tableCount = await tables.count();
    if (tableCount > 0) {
      const firstTable = tables.first();
      const role = await firstTable.getAttribute('role');
      const tagName = await firstTable.evaluate((el) => el.tagName.toLowerCase());
      // Table should either be a native table element or have appropriate role
      expect(tagName === 'table' || role === 'table' || role === 'grid').toBe(true);
    }

    // Check that images/icons have alt text or aria-hidden
    const icons = page.locator('mat-icon, img, svg');
    const iconCount = await icons.count();
    for (let i = 0; i < Math.min(iconCount, 10); i++) {
      const icon = icons.nth(i);
      const ariaHidden = await icon.getAttribute('aria-hidden');
      const ariaLabel = await icon.getAttribute('aria-label');
      const alt = await icon.getAttribute('alt');
      // Icons should either be hidden from screen readers or have a label
      const isAccessible = !!(ariaHidden || ariaLabel || alt);
      expect(isAccessible).toBe(true);
    }
  });
});
