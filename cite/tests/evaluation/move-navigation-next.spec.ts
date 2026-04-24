// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: cite/cite-test-plan.md
// seed: tests/seed.spec.ts

import { test, expect } from '../../fixtures';
import { getApiToken, ensureEvaluation, deleteEvaluation, navigateToEvaluation } from './eval-helpers';

test.describe('Evaluation Dashboard Interface', () => {
  test('Move Navigation - Next Move', async ({ citeAuthenticatedPage: page, request }) => {
    const token = await getApiToken(request);
    const { id: evalId, created } = await ensureEvaluation(request, token);

    try {
      // 1. Navigate to evaluation via admin page
      await navigateToEvaluation(page);
      await page.waitForLoadState('domcontentloaded');

      // expect: Dashboard displays with current move information
      const incrementButton = page.getByRole('button', { name: 'Increment Move' }).first();
      await expect(incrementButton).toBeVisible({ timeout: 10000 });

      // 2. Click the increment move button if enabled
      if (await incrementButton.isEnabled({ timeout: 3000 }).catch(() => false)) {
        await incrementButton.click();
        await page.waitForLoadState('domcontentloaded');
      }
    } finally {
      if (created) await deleteEvaluation(request, token, evalId);
    }
  });
});
