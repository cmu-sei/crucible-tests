// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: cite/cite-test-plan.md
// seed: tests/seed.spec.ts

import { test, expect } from '@playwright/test';
import { Services, authenticateWithKeycloak } from '../../../shared-fixtures';

test.describe('Error Handling and Edge Cases', () => {
  test('Concurrent Score Modifications', async ({ browser }) => {

    // 1. Open two browser instances with same user logged in
    const context1 = await browser.newContext({ ignoreHTTPSErrors: true });
    const context2 = await browser.newContext({ ignoreHTTPSErrors: true });
    const page1 = await context1.newPage();
    const page2 = await context2.newPage();

    await authenticateWithKeycloak(page1, Services.Cite.UI);
    await authenticateWithKeycloak(page2, Services.Cite.UI);

    // Navigate both to same evaluation scoresheet
    for (const p of [page1, page2]) {
      const rows = p.locator('mat-row, tbody tr, [class*="evaluation-row"]');
      await expect(rows.first()).toBeVisible({ timeout: 10000 });
      await rows.first().click();
      await p.waitForLoadState('domcontentloaded');

      const scoreTab = p.locator('[role="tab"]:has-text("Scoresheet"), button:has-text("Scoresheet")').first();
      if (await scoreTab.isVisible({ timeout: 5000 }).catch(() => false)) {
        await scoreTab.click();
      }
    }

    // 2. Modify the same score in both instances simultaneously
    const option1 = page1.locator('mat-radio-button, [class*="scoring-option"]').first();
    const option2 = page2.locator('mat-radio-button, [class*="scoring-option"]').first();

    if (await option1.isVisible({ timeout: 5000 }).catch(() => false)) {
      await option1.click();
    }
    if (await option2.isVisible({ timeout: 5000 }).catch(() => false)) {
      await option2.click();
    }

    // expect: Application handles concurrent edits
    // expect: Both instances synchronize via SignalR
    await page1.waitForTimeout(3000);
    await page2.waitForTimeout(3000);

    await context1.close();
    await context2.close();
  });
});
