// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: cite/cite-test-plan.md
// seed: tests/seed.spec.ts

import { test, expect, Services } from '../../fixtures';

test.describe('Administration - Submissions', () => {
  test('Submissions Section', async ({ citeAuthenticatedPage: page }) => {

    await page.goto(`${Services.Cite.UI}/admin`);
    await page.waitForLoadState('domcontentloaded');

    const submissionsLink = page.locator('text=Submissions, a:has-text("Submissions"), mat-list-item:has-text("Submissions")').first();
    await expect(submissionsLink).toBeVisible({ timeout: 10000 });
    await submissionsLink.click();

    await page.waitForLoadState('domcontentloaded');
    const content = page.locator('mat-table, table, [class*="submission"], [class*="list"]').first();
    await expect(content).toBeVisible({ timeout: 10000 });
  });
});
