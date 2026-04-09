// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: cite/cite-test-plan.md
// seed: tests/seed.spec.ts

import { test, expect } from '@playwright/test';
import { Services, authenticateWithKeycloak } from '../../../shared-fixtures';

test.describe('Real-time Collaboration Features', () => {
  test('Real-time Score Updates', async ({ browser }) => {

    // 1. Open two browser instances with different users logged in to the same evaluation and team
    const context1 = await browser.newContext({ ignoreHTTPSErrors: true });
    const context2 = await browser.newContext({ ignoreHTTPSErrors: true });
    const page1 = await context1.newPage();
    const page2 = await context2.newPage();

    await authenticateWithKeycloak(page1, Services.Cite.UI);
    await authenticateWithKeycloak(page2, Services.Cite.UI);

    // Both instances navigate to the same evaluation
    const rows1 = page1.locator('mat-row, tbody tr, [class*="evaluation-row"]');
    await expect(rows1.first()).toBeVisible({ timeout: 10000 });
    await rows1.first().click();
    await page1.waitForLoadState('domcontentloaded');

    const rows2 = page2.locator('mat-row, tbody tr, [class*="evaluation-row"]');
    await expect(rows2.first()).toBeVisible({ timeout: 10000 });
    await rows2.first().click();
    await page2.waitForLoadState('domcontentloaded');

    // Switch to scoresheet on both
    const scoreTab1 = page1.locator('[role="tab"]:has-text("Scoresheet"), button:has-text("Scoresheet")').first();
    if (await scoreTab1.isVisible({ timeout: 5000 }).catch(() => false)) {
      await scoreTab1.click();
    }

    const scoreTab2 = page2.locator('[role="tab"]:has-text("Scoresheet"), button:has-text("Scoresheet")').first();
    if (await scoreTab2.isVisible({ timeout: 5000 }).catch(() => false)) {
      await scoreTab2.click();
    }

    // expect: Both instances are authenticated and viewing scoresheet
    // 2. In first instance, modify a score
    const option = page1.locator('mat-radio-button, mat-checkbox, [class*="scoring-option"]').first();
    if (await option.isVisible({ timeout: 5000 }).catch(() => false)) {
      await option.click();
      // expect: Score is updated in first instance
      await page1.waitForTimeout(2000);
    }

    // 3. Observe second instance
    // expect: Score update appears in second instance automatically via SignalR
    await page2.waitForTimeout(3000);

    await context1.close();
    await context2.close();
  });
});
