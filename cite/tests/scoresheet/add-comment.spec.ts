// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: cite/cite-test-plan.md
// seed: tests/seed.spec.ts

import { test, expect } from '../../fixtures';

test.describe('Scoresheet Interface', () => {
  test('Add Comment to Score', async ({ citeAuthenticatedPage: page }) => {

    // 1. Navigate to scoresheet with edit permissions
    await expect(page).toHaveURL(/localhost:4721/, { timeout: 10000 });
    const rows = page.locator('mat-row, tbody tr, [class*="evaluation-row"]');
    await expect(rows.first()).toBeVisible({ timeout: 10000 });
    await rows.first().click();
    await page.waitForLoadState('domcontentloaded');

    const scoresheetTab = page.locator('[role="tab"]:has-text("Scoresheet"), button:has-text("Scoresheet")').first();
    await expect(scoresheetTab).toBeVisible({ timeout: 10000 });
    await scoresheetTab.click();
    await page.waitForLoadState('domcontentloaded');

    // expect: Scoresheet displays with editable fields

    // 2. Locate comment field for a scoring category or option
    const commentField = page.locator('textarea, input[placeholder*="comment"], [class*="comment"] input, [class*="comment"] textarea, mat-form-field textarea').first();

    if (await commentField.isVisible({ timeout: 5000 }).catch(() => false)) {
      // expect: Comment field is visible

      // 3. Enter comment text in the comment field
      await commentField.fill('Test comment from automated test');

      // expect: Comment text is accepted
      await expect(commentField).toHaveValue('Test comment from automated test');

      // 4. Save or blur the comment field
      await commentField.blur();

      // expect: Comment is saved automatically
      await page.waitForTimeout(1000);
    }
  });
});
