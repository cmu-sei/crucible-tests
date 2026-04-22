// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: cite/cite-test-plan.md
// seed: tests/seed.spec.ts

import { test, expect, Services } from '../../fixtures';
import { navigateToAdminSection, deleteEvaluationByName, createEvaluation } from '../../test-helpers';

test.describe('Administration - Evaluations', () => {

  const TEST_EVAL_NAME = 'Test Evaluation For Memberships';

  test('Manage Evaluation Memberships', async ({ citeAuthenticatedPage: page }) => {

    // 1. Create an evaluation
    await createEvaluation(page, TEST_EVAL_NAME);

    // 2. Navigate to the evaluations list and wait for the evaluation to appear
    await navigateToAdminSection(page, 'Evaluations');
    await page.waitForTimeout(2000);

    const evalRow = page.locator('tbody tr').filter({ hasText: TEST_EVAL_NAME }).first();
    await expect(evalRow).toBeVisible({ timeout: 15000 });
    await evalRow.click();
    await page.waitForTimeout(2000);

    // 3. Find and expand the Memberships panel
    const membershipsPanel = page.locator('mat-expansion-panel').filter({ hasText: 'Memberships' }).first();
    await expect(membershipsPanel).toBeVisible({ timeout: 10000 });
    await membershipsPanel.locator('mat-expansion-panel-header').click();
    await page.waitForTimeout(1000);

    // 4. Verify membership management UI is displayed (two-column layout: non-members and members)
    const membershipContent = membershipsPanel.locator('.mat-expansion-panel-body, mat-expansion-panel-body').first();
    await expect(membershipContent).toBeVisible({ timeout: 5000 });

    // The membership panel shows available users and current members
    const membersList = membershipsPanel.locator('app-admin-evaluation-member-list, app-admin-evaluation-membership-list').first();
    await expect(membersList).toBeVisible({ timeout: 10000 });
  });

  test.afterEach(async ({ citeAuthenticatedPage: page }) => {
    await deleteEvaluationByName(page, TEST_EVAL_NAME);
  });
});
