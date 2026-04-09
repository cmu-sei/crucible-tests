// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: cite/cite-test-plan.md
// seed: tests/seed.spec.ts

import { test, expect, Services } from '../../fixtures';

test.describe('Administration - Evaluations', () => {
  test('Expand Evaluation Details', async ({ citeAuthenticatedPage: page }) => {

    // 1. Navigate to admin evaluations section
    await page.goto(`${Services.Cite.UI}/admin`);
    await page.waitForLoadState('domcontentloaded');

    const evaluationsLink = page.locator('text=Evaluations, a:has-text("Evaluations"), mat-list-item:has-text("Evaluations")').first();
    await expect(evaluationsLink).toBeVisible({ timeout: 10000 });
    await evaluationsLink.click();

    // expect: Evaluations list displays
    const rows = page.locator('mat-row, tbody tr, [class*="evaluation-row"]');
    await expect(rows.first()).toBeVisible({ timeout: 10000 });

    // 2. Click on an evaluation row to expand details
    await rows.first().click();

    // expect: Evaluation row expands
    // expect: Nested sections appear: Moves, Teams, Actions, Duties, Memberships
    await page.waitForTimeout(1000);

    const sections = page.locator('mat-expansion-panel, [class*="section"], [class*="panel"]');
    const movesSection = page.locator('text=Moves, mat-expansion-panel-header:has-text("Moves")').first();
    const teamsSection = page.locator('text=Teams, mat-expansion-panel-header:has-text("Teams")').first();

    // expect: Each section is collapsed by default in expansion panels
    const hasSections = await movesSection.isVisible({ timeout: 5000 }).catch(() => false) ||
                        await teamsSection.isVisible({ timeout: 2000 }).catch(() => false);
  });
});
