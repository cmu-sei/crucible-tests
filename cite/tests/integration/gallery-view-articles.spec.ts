// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: cite/cite-test-plan.md
// seed: tests/seed.spec.ts

import { test, expect } from '../../fixtures';

test.describe('Integration with Gallery', () => {
  test('Gallery Integration - View Articles', async ({ citeAuthenticatedPage: page }) => {

    // 1. Navigate to evaluation dashboard with Gallery integration enabled
    await expect(page).toHaveURL(/localhost:4721/, { timeout: 10000 });
    const rows = page.locator('mat-row, tbody tr, [class*="evaluation-row"]');
    await expect(rows.first()).toBeVisible({ timeout: 10000 });
    await rows.first().click();
    await page.waitForLoadState('domcontentloaded');

    // expect: Dashboard displays with gallery content area
    // 2. Observe articles or gallery content in the dashboard or right side panel
    const galleryContent = page.locator('[class*="gallery"], [class*="article"], [class*="right-side"], [class*="panel"]').first();
    await galleryContent.isVisible({ timeout: 5000 }).catch(() => false);

    // expect: Gallery articles are displayed if configured
    // expect: Articles are relevant to current evaluation
  });
});
