// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: cite/cite-test-plan.md
// seed: tests/seed.spec.ts

import { test, expect } from '../../fixtures';
import { createEvaluation, deleteEvaluationByName, navigateToAdminSection } from '../../test-helpers';

const TEST_EVAL_NAME = 'E2E Filter Test Evaluation';

test.describe('Home Page and Evaluation List', () => {

  test('Evaluation List Search/Filter', async ({ citeAuthenticatedPage: page }) => {

    // 1. Create an evaluation via admin UI
    await createEvaluation(page, TEST_EVAL_NAME);

    // 2. Navigate to admin evaluations page to test the search/filter functionality
    await navigateToAdminSection(page, 'Evaluations');
    await page.waitForTimeout(2000);

    // 3. Verify the test evaluation exists in the list
    const evalRow = page.locator('tbody tr').filter({ hasText: TEST_EVAL_NAME }).first();
    await expect(evalRow).toBeVisible({ timeout: 15000 });

    // 4. Locate the search/filter input
    const searchField = page.getByRole('textbox', { name: 'Search' });
    await expect(searchField).toBeVisible({ timeout: 5000 });

    // 5. Get count of all evaluation rows before filtering
    const allRows = page.locator('tbody tr').filter({ hasNot: page.locator('[colspan]') });
    const initialCount = await allRows.count();
    expect(initialCount).toBeGreaterThan(0);

    // 6. Test filtering - search for test evaluation
    await searchField.fill(TEST_EVAL_NAME);
    await page.waitForTimeout(1000);

    // Verify filtered results
    const filteredRow = page.locator('tbody tr').filter({ hasText: TEST_EVAL_NAME }).first();
    await expect(filteredRow).toBeVisible({ timeout: 10000 });

    const filteredRows = page.locator('tbody tr').filter({ hasNot: page.locator('[colspan]') });
    const filteredCount = await filteredRows.count();
    expect(filteredCount).toBeGreaterThan(0);
    expect(filteredCount).toBeLessThanOrEqual(initialCount);

    // 7. Clear search and verify all evaluations are restored
    await searchField.clear();
    await page.waitForTimeout(1000);

    const restoredRows = page.locator('tbody tr').filter({ hasNot: page.locator('[colspan]') });
    const restoredCount = await restoredRows.count();
    expect(restoredCount).toBe(initialCount);
  });

  test.afterEach(async ({ citeAuthenticatedPage: page }) => {
    await deleteEvaluationByName(page, TEST_EVAL_NAME);
  });
});
