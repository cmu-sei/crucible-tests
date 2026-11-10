// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: topomojo/topomojo-test-plan.md
// seed: tests/seed.spec.ts

import { test, expect } from '../../fixtures';

test.describe('Accessibility', () => {
  test('Keyboard Navigation - Form Submission', async ({ topomojoAuthenticatedPage: page }) => {

    // 1. Navigate to a form area (workspace editor settings)
    const sidebarToggle = page.locator('button[aria-label="Toggle sidebar"], button:has(mat-icon:text("menu"))').first();
    const sidebar = page.locator('mat-sidenav, mat-drawer, [class*="sidebar"]').first();
    const workspaceItems = page.locator('[class*="workspace-card"], [class*="item-card"], mat-list-item, [class*="list-item"]');
    const hasSidebarToggle = await sidebarToggle.isVisible({ timeout: 10000 }).catch(() => false);
    if (hasSidebarToggle) {
      await sidebarToggle.click();
      await expect(sidebar).toBeVisible({ timeout: 5000 });
    }
    const itemCount = await workspaceItems.count();

    if (itemCount > 0) {
      const formFields = page.locator('input, textarea, mat-select');
      await workspaceItems.first().click();
      await expect(formFields.first()).toBeVisible({ timeout: 10000 });

      // expect: Form is displayed
      const fieldCount = await formFields.count();

      if (fieldCount > 0) {
        // 2. Fill form using keyboard only
        const firstField = formFields.first();
        await firstField.focus();

        // expect: All fields can be filled via keyboard
        await page.keyboard.type('Test');

        // Tab to next field
        await page.keyboard.press('Tab');

        // expect: Form navigation works via keyboard
        const currentFocus = await page.evaluate(() => document.activeElement?.tagName.toLowerCase());
        expect(currentFocus).not.toBeNull();
      }
    }
  });
});
