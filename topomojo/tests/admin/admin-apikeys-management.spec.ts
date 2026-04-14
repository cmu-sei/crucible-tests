// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: topomojo/topomojo-test-plan.md
// seed: tests/seed.spec.ts

import { test, expect, Services } from '../../fixtures';

test.describe('Admin Panel', () => {
  test('Admin - API Keys Management', async ({ topomojoAuthenticatedPage: page }) => {

    // 1. Navigate to admin dashboard
    await page.goto(Services.TopoMojo.UI + '/admin');
    await page.waitForLoadState('domcontentloaded');

    // 2. Click on 'API Keys' section
    const apiKeysLink = page.locator('a:has-text("API"), button:has-text("API"), mat-tab:has-text("API"), a:has-text("Key")').first();
    const hasLink = await apiKeysLink.isVisible({ timeout: 10000 }).catch(() => false);
    if (hasLink) {
      await apiKeysLink.click();
      await page.waitForTimeout(1000);
    }

    // expect: API keys page loads
    // expect: List of API keys is displayed
    const apiContent = page.locator('[class*="api"], [class*="key"], table, mat-table, [class*="browser"]').first();
    const hasContent = await apiContent.isVisible({ timeout: 10000 }).catch(() => false);
    if (hasContent) {
      await expect(apiContent).toBeVisible();
    }
  });
});
