// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: cite/cite-test-plan.md
// seed: tests/seed.spec.ts

import { test, expect } from '../../fixtures';
import { getApiToken, ensureEvaluation, deleteEvaluation, navigateToEvaluation } from './eval-helpers';

test.describe('Evaluation Dashboard Interface', () => {
  test('Dashboard Initial Load', async ({ citeAuthenticatedPage: page, request }) => {
    const token = await getApiToken(request);
    const { id: evalId, created } = await ensureEvaluation(request, token);

    try {
      // 1. Navigate to evaluation via admin page
      await navigateToEvaluation(page);

      // expect: Dashboard page loads
      await page.waitForLoadState('domcontentloaded');

      // expect: Evaluation information header is displayed
      const header = page.locator('[class*="evaluation"], [class*="header"], mat-toolbar, [class*="title"]').first();
      await expect(header).toBeVisible({ timeout: 10000 });

      // expect: Main content area displays dashboard view
      const content = page.locator('[class*="dashboard"], [class*="content"], mat-tab-group').first();
      await expect(content).toBeVisible({ timeout: 10000 });
    } finally {
      if (created) await deleteEvaluation(request, token, evalId);
    }
  });
});
