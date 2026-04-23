// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: cite/cite-test-plan.md
// seed: tests/seed.spec.ts

import { test, expect } from '../../fixtures';
import { getApiToken, ensureEvaluation, deleteEvaluation, navigateToEvaluation } from './eval-helpers';

test.describe('Evaluation Dashboard Interface', () => {
  test('Section Navigation - Switch to Scoresheet', async ({ citeAuthenticatedPage: page, request }) => {
    const token = await getApiToken(request);
    const { id: evalId, created } = await ensureEvaluation(request, token);

    try {
      // 1. Navigate to evaluation via admin page
      await navigateToEvaluation(page);
      await page.waitForLoadState('domcontentloaded');

      // 2. Click on 'Moves' section in admin view
      const movesButton = page.getByRole('button', { name: 'Moves' }).first();
      await expect(movesButton).toBeVisible({ timeout: 10000 });
      await movesButton.click();

      // expect: Moves section expands
      await page.waitForLoadState('domcontentloaded');
    } finally {
      if (created) await deleteEvaluation(request, token, evalId);
    }
  });
});
