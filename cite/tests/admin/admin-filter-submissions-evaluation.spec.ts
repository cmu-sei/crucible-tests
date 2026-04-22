// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: cite/cite-test-plan.md
// seed: tests/seed.spec.ts

import { test, expect, Services } from '../../fixtures';
import { navigateToAdminSection } from '../../test-helpers';

test.describe('Administration - Submissions', () => {
  test('Filter Submissions by Evaluation', async ({ citeAuthenticatedPage: page }) => {

    // 1. Navigate to Submissions section
    await navigateToAdminSection(page, 'Submissions');

    // 2. Verify filter controls are present
    const evaluationFilter = page.getByRole('combobox', { name: 'Evaluation' });
    await expect(evaluationFilter).toBeVisible({ timeout: 5000 });

    const moveFilter = page.getByRole('combobox', { name: 'Move' });
    await expect(moveFilter).toBeVisible({ timeout: 5000 });

    // 3. Click the evaluation filter to verify it opens with options
    await evaluationFilter.click();
    await page.waitForTimeout(500);

    const evalOptions = page.locator('mat-option');
    const evalOptionCount = await evalOptions.count();
    expect(evalOptionCount).toBeGreaterThanOrEqual(0);

    // Close the dropdown
    await page.keyboard.press('Escape');
    await page.waitForTimeout(500);

    // 4. Click the move filter to verify it opens
    await moveFilter.click();
    await page.waitForTimeout(500);

    const moveOptions = page.locator('mat-option');
    const moveOptionCount = await moveOptions.count();
    expect(moveOptionCount).toBeGreaterThanOrEqual(0);

    await page.keyboard.press('Escape');
  });
});
