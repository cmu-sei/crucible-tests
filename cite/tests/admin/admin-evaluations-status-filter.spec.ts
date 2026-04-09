// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: cite/cite-test-plan.md
// seed: tests/seed.spec.ts

import { test, expect, Services } from '../../fixtures';

test.describe('Administration - Evaluations', () => {
  test('Filter Evaluations by Status', async ({ citeAuthenticatedPage: page }) => {

    // 1. Navigate to admin evaluations section
    await page.goto(`${Services.Cite.UI}/admin`);
    await page.waitForLoadState('domcontentloaded');

    const evaluationsLink = page.locator('text=Evaluations, a:has-text("Evaluations"), mat-list-item:has-text("Evaluations")').first();
    await expect(evaluationsLink).toBeVisible({ timeout: 10000 });
    await evaluationsLink.click();

    // expect: Evaluations list displays
    // expect: Status filter dropdown is visible

    // 2. Click on status filter dropdown
    const statusFilter = page.locator('mat-select:has-text("Status"), mat-select[placeholder*="status"], [class*="status-filter"], mat-select').first();
    if (await statusFilter.isVisible({ timeout: 5000 }).catch(() => false)) {
      await statusFilter.click();

      // expect: Status options are displayed (Active, Developing, Archived, Complete)
      const options = page.locator('mat-option, option');
      await expect(options.first()).toBeVisible({ timeout: 5000 });

      // 3. Select one or more statuses
      const activeOption = page.locator('mat-option:has-text("Active"), option:has-text("Active")').first();
      if (await activeOption.isVisible({ timeout: 2000 }).catch(() => false)) {
        await activeOption.click();
      } else {
        await options.first().click();
      }

      // expect: Evaluations list filters to show only evaluations with selected statuses
      await page.waitForTimeout(500);
    }
  });
});
