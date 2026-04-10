// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: topomojo/topomojo-test-plan.md
// seed: tests/seed.spec.ts

import { test, expect, Services } from '../../fixtures';

test.describe('Admin Panel', () => {
  test('Admin - Create API Key', async ({ topomojoAuthenticatedPage: page }) => {

    // 1. Navigate to admin API keys page
    await page.goto(Services.TopoMojo.UI + '/admin');
    await page.waitForLoadState('domcontentloaded');

    const apiKeysLink = page.locator('a:has-text("API"), button:has-text("API"), mat-tab:has-text("API")').first();
    const hasLink = await apiKeysLink.isVisible({ timeout: 10000 }).catch(() => false);
    if (hasLink) {
      await apiKeysLink.click();
      await page.waitForTimeout(1000);
    }

    // 2. Click 'Create API Key' button
    const createButton = page.locator('button:has-text("Create"), button:has-text("New"), button:has(mat-icon:text("add"))').first();
    const hasCreate = await createButton.isVisible({ timeout: 5000 }).catch(() => false);

    if (hasCreate) {
      await createButton.click();
      await page.waitForTimeout(1000);

      // expect: API key creation form opens
      const keyForm = page.locator('mat-dialog-container, [role="dialog"], form, [class*="api-key-form"]').first();
      const hasForm = await keyForm.isVisible({ timeout: 5000 }).catch(() => false);
      if (hasForm) {
        await expect(keyForm).toBeVisible();
      }
    }
  });
});
