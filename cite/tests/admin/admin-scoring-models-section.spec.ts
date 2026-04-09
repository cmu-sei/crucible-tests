// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: cite/cite-test-plan.md
// seed: tests/seed.spec.ts

import { test, expect, Services } from '../../fixtures';

test.describe('Administration - Scoring Models', () => {
  test('Scoring Models Section', async ({ citeAuthenticatedPage: page }) => {

    // 1. Navigate to admin page with ViewScoringModels permission
    await page.goto(`${Services.Cite.UI}/admin`);
    await page.waitForLoadState('domcontentloaded');

    // 2. Click on 'Scoring Models' section in sidebar
    const scoringModelsLink = page.locator('text=Scoring Models, a:has-text("Scoring Models"), mat-list-item:has-text("Scoring Models"), button:has-text("Scoring Models")').first();
    await expect(scoringModelsLink).toBeVisible({ timeout: 10000 });
    await scoringModelsLink.click();

    // expect: Scoring models section displays
    // expect: List of scoring models is shown
    await page.waitForLoadState('domcontentloaded');
    const content = page.locator('mat-table, table, [class*="scoring-model"], [class*="list"]').first();
    await expect(content).toBeVisible({ timeout: 10000 });
  });
});
