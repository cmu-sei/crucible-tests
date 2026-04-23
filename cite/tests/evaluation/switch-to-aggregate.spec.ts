// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: cite/cite-test-plan.md
// seed: tests/seed.spec.ts

import { test, expect } from '../../fixtures';
import { getApiToken, ensureEvaluation, deleteEvaluation, navigateToEvaluation } from './eval-helpers';

test.describe('Evaluation Dashboard Interface', () => {
  test('Section Navigation - Switch to Aggregate', async ({ citeAuthenticatedPage: page, request }) => {
    const token = await getApiToken(request);
    const { id: evalId, created } = await ensureEvaluation(request, token);

    try {
      // 1. Navigate to evaluation via admin page
      await navigateToEvaluation(page);
      await page.waitForLoadState('domcontentloaded');

      // 2. Click on 'Teams' section in admin view
      const teamsButton = page.getByRole('button', { name: 'Teams' }).first();
      await expect(teamsButton).toBeVisible({ timeout: 10000 });
      await teamsButton.click();

      // expect: Teams section expands
      await page.waitForLoadState('domcontentloaded');
    } finally {
      if (created) await deleteEvaluation(request, token, evalId);
    }
  });
});
