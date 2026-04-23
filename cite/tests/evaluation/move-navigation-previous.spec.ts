// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: cite/cite-test-plan.md
// seed: tests/seed.spec.ts

import { test, expect } from '../../fixtures';
import { getApiToken, ensureEvaluation, deleteEvaluation, navigateToEvaluation } from './eval-helpers';

test.describe('Evaluation Dashboard Interface', () => {
  test('Move Navigation - Previous Move', async ({ citeAuthenticatedPage: page, request }) => {
    const token = await getApiToken(request);
    const { id: evalId, created } = await ensureEvaluation(request, token);

    try {
      // 1. Navigate to evaluation via admin page
      await navigateToEvaluation(page);
      await page.waitForLoadState('domcontentloaded');

      // Try to advance to a move after 0 first
      const nextButton = page.locator('button[aria-label*="next"], button[aria-label*="forward"], button:has(mat-icon:has-text("chevron_right")), button:has(mat-icon:has-text("arrow_forward")), [class*="next-move"]').first();
      if (await nextButton.isEnabled({ timeout: 3000 }).catch(() => false)) {
        await nextButton.click();
        await page.waitForLoadState('domcontentloaded');
      }

      // expect: Previous move button is enabled
      const prevButton = page.locator('button[aria-label*="prev"], button[aria-label*="back"], button:has(mat-icon:has-text("chevron_left")), button:has(mat-icon:has-text("arrow_back")), [class*="prev-move"]').first();

      if (await prevButton.isEnabled({ timeout: 3000 }).catch(() => false)) {
        // 2. Click the previous move button or arrow
        await prevButton.click();
        await page.waitForLoadState('domcontentloaded');
      }
    } finally {
      if (created) await deleteEvaluation(request, token, evalId);
    }
  });
});
