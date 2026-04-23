// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: cite/cite-test-plan.md
// seed: tests/seed.spec.ts

import { test, expect } from '../../fixtures';
import { getApiToken, ensureEvaluation, deleteEvaluation, navigateToEvaluation } from './eval-helpers';

test.describe('Evaluation Dashboard Interface', () => {
  test('Evaluation Information Display', async ({ citeAuthenticatedPage: page, request }) => {
    const token = await getApiToken(request);
    const { id: evalId, created } = await ensureEvaluation(request, token);

    try {
      // 1. Navigate to evaluation via admin page
      await navigateToEvaluation(page);
      await page.waitForLoadState('domcontentloaded');

      // expect: Evaluation description is visible in the expanded row
      const description = page.getByText('E2E Test Evaluation').first();
      await expect(description).toBeVisible({ timeout: 10000 });

      // expect: Current move number is displayed
      const moveNumber = page.locator('cell, td').filter({ hasText: /^0$/ }).first();
      await expect(moveNumber).toBeVisible({ timeout: 10000 });

      // expect: Admin sections are available (Moves, Teams, Actions, Duties, Memberships)
      const movesButton = page.getByRole('button', { name: 'Moves' });
      await expect(movesButton).toBeVisible({ timeout: 10000 });
    } finally {
      if (created) await deleteEvaluation(request, token, evalId);
    }
  });
});
