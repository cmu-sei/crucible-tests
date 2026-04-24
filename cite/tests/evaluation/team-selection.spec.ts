// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: cite/cite-test-plan.md
// seed: tests/seed.spec.ts

import { test, expect } from '../../fixtures';
import { getApiToken, ensureEvaluation, deleteEvaluation, navigateToEvaluation } from './eval-helpers';

test.describe('Evaluation Dashboard Interface', () => {
  test('Team Selection', async ({ citeAuthenticatedPage: page, request }) => {
    const token = await getApiToken(request);
    const { id: evalId, created } = await ensureEvaluation(request, token);

    try {
      // 1. Navigate to evaluation via admin page
      await navigateToEvaluation(page);
      await page.waitForLoadState('domcontentloaded');

      // expect: Evaluation dashboard loads with team selector
      const teamSelector = page.locator('mat-select, [class*="team-select"], select').first();
      await expect(teamSelector).toBeVisible({ timeout: 10000 });

      // 2. Click on team selector dropdown
      await teamSelector.click();

      // expect: Team dropdown menu opens
      const options = page.locator('mat-option, option, [role="option"]');
      await expect(options.first()).toBeVisible({ timeout: 5000 });

      // 3. Select a different team from the dropdown
      const optionCount = await options.count();
      if (optionCount > 1) {
        await options.nth(1).click();
      } else {
        await options.first().click();
      }

      // expect: Dashboard refreshes to show team-specific data
      await page.waitForLoadState('domcontentloaded');
    } finally {
      if (created) await deleteEvaluation(request, token, evalId);
    }
  });
});
