// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: cite/cite-test-plan.md
// seed: tests/seed.spec.ts

import { test, expect, Services } from '../../fixtures';

test.describe('Administration - Submissions', () => {
  test('Filter Submissions by Evaluation', async ({ citeAuthenticatedPage: page }) => {

    await page.goto(`${Services.Cite.UI}/admin`);
    await page.waitForLoadState('domcontentloaded');

    const submissionsLink = page.locator('text=Submissions, a:has-text("Submissions"), mat-list-item:has-text("Submissions")').first();
    await expect(submissionsLink).toBeVisible({ timeout: 10000 });
    await submissionsLink.click();
    await page.waitForLoadState('domcontentloaded');

    // Select an evaluation from filter dropdown
    const evalFilter = page.locator('mat-select, select, [class*="evaluation-filter"]').first();
    if (await evalFilter.isVisible({ timeout: 5000 }).catch(() => false)) {
      await evalFilter.click();
      const option = page.locator('mat-option, option').first();
      await option.click();
      await page.waitForTimeout(500);
    }
  });
});
