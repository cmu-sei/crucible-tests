// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: cite/cite-test-plan.md
// seed: tests/seed.spec.ts

import { test, expect, Services } from '../../fixtures';

test.describe('Administration - Submissions', () => {
  test('View Submission Details', async ({ citeAuthenticatedPage: page }) => {

    await page.goto(`${Services.Cite.UI}/admin`);
    await page.waitForLoadState('domcontentloaded');

    const submissionsLink = page.locator('text=Submissions, a:has-text("Submissions"), mat-list-item:has-text("Submissions")').first();
    await expect(submissionsLink).toBeVisible({ timeout: 10000 });
    await submissionsLink.click();

    const rows = page.locator('mat-row, tbody tr').first();
    await expect(rows).toBeVisible({ timeout: 10000 });

    // Click on a submission to view details
    await rows.click();
    await page.waitForLoadState('domcontentloaded');

    // expect: Submission details are displayed
    const details = page.locator('[class*="detail"], [class*="submission"], mat-dialog-container, [role="dialog"]').first();
    await expect(details).toBeVisible({ timeout: 10000 });
  });
});
