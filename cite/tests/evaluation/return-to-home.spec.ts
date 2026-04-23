// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: cite/cite-test-plan.md
// seed: tests/seed.spec.ts

import { test, expect } from '../../fixtures';
import { getApiToken, ensureEvaluation, deleteEvaluation, navigateToEvaluation } from './eval-helpers';

test.describe('Evaluation Dashboard Interface', () => {
  test('Return to Home from Evaluation', async ({ citeAuthenticatedPage: page, request }) => {
    const token = await getApiToken(request);
    const { id: evalId, created } = await ensureEvaluation(request, token);

    try {
      // 1. Navigate to evaluation via admin page
      await navigateToEvaluation(page);
      await page.waitForLoadState('domcontentloaded');

      // 2. Click on CITE logo or home link in top bar
      const homeLink = page.locator('a[href="/"], img[src*="cite"], [class*="app-logo"], mat-toolbar a, [class*="home-link"]').first();
      await homeLink.click();

      // expect: User is navigated back to home page
      await page.waitForLoadState('domcontentloaded');

      // expect: Evaluation list is displayed
      const evaluationList = page.locator('mat-table, table, [class*="evaluation"], [class*="list"]').first();
      await expect(evaluationList).toBeVisible({ timeout: 10000 });
    } finally {
      if (created) await deleteEvaluation(request, token, evalId);
    }
  });
});
