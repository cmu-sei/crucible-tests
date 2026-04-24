// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: cite/cite-test-plan.md
// seed: tests/seed.spec.ts

import { test, expect } from '../../fixtures';
import { getApiToken, ensureEvaluation, deleteEvaluation, navigateToEvaluation } from './eval-helpers';

test.describe('Evaluation Dashboard Interface', () => {
  test('Move Navigation - Boundary Conditions', async ({ citeAuthenticatedPage: page, request }) => {
    const token = await getApiToken(request);
    const { id: evalId, created } = await ensureEvaluation(request, token);

    try {
      // 1. Navigate to evaluation via admin page
      await navigateToEvaluation(page);
      await page.waitForLoadState('domcontentloaded');

      // expect: Move controls are visible
      const decrementButton = page.getByRole('button', { name: 'Decrement Move' }).first();
      const incrementButton = page.getByRole('button', { name: 'Increment Move' }).first();

      await expect(decrementButton).toBeVisible({ timeout: 10000 });
      await expect(incrementButton).toBeVisible({ timeout: 10000 });

      // At move 0, decrement should be disabled
      await expect(decrementButton).toBeDisabled({ timeout: 5000 });
    } finally {
      if (created) await deleteEvaluation(request, token, evalId);
    }
  });
});
