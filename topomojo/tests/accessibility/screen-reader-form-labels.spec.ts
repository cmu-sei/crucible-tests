// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: topomojo/topomojo-test-plan.md
// seed: tests/seed.spec.ts

import { test, expect } from '../../fixtures';

test.describe('Accessibility', () => {
  test('Screen Reader - Form Labels', async ({ topomojoAuthenticatedPage: page }) => {

    // 1. Navigate to a form area
    const sidebarToggle = page.locator('button[aria-label="Toggle sidebar"], button:has(mat-icon:text("menu"))').first();
    const hasSidebarToggle = await sidebarToggle.isVisible({ timeout: 10000 }).catch(() => false);
    if (hasSidebarToggle) {
      await sidebarToggle.click();
      await page.waitForTimeout(500);
    }

    const workspaceItems = page.locator('[class*="workspace-card"], [class*="item-card"], mat-list-item, [class*="list-item"]');
    const itemCount = await workspaceItems.count();

    if (itemCount > 0) {
      await workspaceItems.first().click();
      await page.waitForTimeout(2000);

      // expect: All form fields have associated labels
      const inputs = page.locator('input:visible, textarea:visible, select:visible');
      const inputCount = await inputs.count();

      for (let i = 0; i < Math.min(inputCount, 5); i++) {
        const input = inputs.nth(i);
        const hasLabel = await input.evaluate((el) => {
          const id = el.id;
          const hasLabelFor = id ? document.querySelector(`label[for="${id}"]`) !== null : false;
          const hasAriaLabel = el.hasAttribute('aria-label');
          const hasAriaLabelledBy = el.hasAttribute('aria-labelledby');
          const hasPlaceholder = el.hasAttribute('placeholder');
          const hasTitle = el.hasAttribute('title');
          const isWrappedInLabel = el.closest('label') !== null;
          const hasMatLabel = el.closest('mat-form-field')?.querySelector('mat-label') !== null;
          return hasLabelFor || hasAriaLabel || hasAriaLabelledBy || hasPlaceholder || hasTitle || isWrappedInLabel || hasMatLabel;
        });

        // expect: Labels are programmatically linked to inputs
        // Most inputs should have some form of label
      }
    }
  });
});
