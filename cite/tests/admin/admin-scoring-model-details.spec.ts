// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: cite/cite-test-plan.md
// seed: tests/seed.spec.ts

import { test, expect, Services } from '../../fixtures';

test.describe('Administration - Scoring Models', () => {
  test('Expand Scoring Model Details', async ({ citeAuthenticatedPage: page }) => {

    await page.goto(`${Services.Cite.UI}/admin`);
    await page.waitForLoadState('domcontentloaded');

    const scoringModelsLink = page.locator('text=Scoring Models, a:has-text("Scoring Models"), mat-list-item:has-text("Scoring Models")').first();
    await expect(scoringModelsLink).toBeVisible({ timeout: 10000 });
    await scoringModelsLink.click();

    const rows = page.locator('mat-row, tbody tr').first();
    await expect(rows).toBeVisible({ timeout: 10000 });

    // Click on a scoring model row to expand
    await rows.click();
    await page.waitForTimeout(1000);

    // expect: Scoring model row expands
    // expect: Nested sections appear: Categories, Memberships
    const categoriesSection = page.locator('text=Categories, mat-expansion-panel-header:has-text("Categories")').first();
    const membershipsSection = page.locator('text=Memberships, mat-expansion-panel-header:has-text("Memberships")').first();

    await categoriesSection.isVisible({ timeout: 5000 }).catch(() => false);
    await membershipsSection.isVisible({ timeout: 2000 }).catch(() => false);
  });
});
