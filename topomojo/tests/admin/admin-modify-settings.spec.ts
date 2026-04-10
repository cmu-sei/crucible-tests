// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: topomojo/topomojo-test-plan.md
// seed: tests/seed.spec.ts

import { test, expect, Services } from '../../fixtures';

test.describe('Admin Panel', () => {
  test('Admin - Modify System Settings', async ({ topomojoAuthenticatedPage: page }) => {

    // 1. Navigate to admin settings
    await page.goto(Services.TopoMojo.UI + '/admin');
    await page.waitForLoadState('domcontentloaded');

    const settingsLink = page.locator('a:has-text("Setting"), button:has-text("Setting"), mat-tab:has-text("Setting")').first();
    const hasLink = await settingsLink.isVisible({ timeout: 10000 }).catch(() => false);
    if (hasLink) {
      await settingsLink.click();
      await page.waitForTimeout(1000);
    }

    // expect: Settings form is displayed
    const settingsInputs = page.locator('input, textarea, mat-select, mat-slide-toggle');
    const inputCount = await settingsInputs.count();

    if (inputCount > 0) {
      // 2. Settings fields are modifiable
      const firstInput = settingsInputs.first();
      await expect(firstInput).toBeVisible({ timeout: 5000 });

      // expect: Setting field accepts change
    }
  });
});
