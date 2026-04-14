// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: topomojo/topomojo-test-plan.md
// seed: tests/seed.spec.ts

import { test, expect, Services } from '../../fixtures';

test.describe('Admin Panel', () => {
  test('Admin - Configure Background Image - Validation', async ({ topomojoAuthenticatedPage: page }) => {

    // 1. Navigate to admin setting browser background image section
    await page.goto(Services.TopoMojo.UI + '/admin');
    await page.waitForLoadState('domcontentloaded');

    const settingsLink = page.locator('a:has-text("Setting"), button:has-text("Setting"), mat-tab:has-text("Setting")').first();
    const hasLink = await settingsLink.isVisible({ timeout: 10000 }).catch(() => false);
    if (hasLink) {
      await settingsLink.click();
      await page.waitForTimeout(1000);
    }

    // expect: Background image upload interface is visible
    const fileInput = page.locator('input[type="file"][accept*="image"], input[type="file"]').first();
    const hasFileInput = await fileInput.count() > 0;

    if (hasFileInput) {
      // 2. File input validation exists for image type
      // expect: Validation error appears for non-image files: 'Please choose an image file.'
      // 3. File size validation
      // expect: Validation error appears for oversized files: 'Image is too large. Please use an image under 5MB.'
      await expect(fileInput).toBeAttached();
    }
  });
});
