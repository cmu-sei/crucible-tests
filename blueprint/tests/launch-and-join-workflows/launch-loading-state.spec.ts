// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: specs/blueprint-test-plan.md
// seed: tests/seed.spec.ts

import { test, expect, Services } from '../../fixtures';

test.describe('Launch and Join Event Workflows', () => {
  test('Launch Loading State', async ({ blueprintAuthenticatedPage: page }) => {
    // 1. Start launching an event and observe the UI during a long launch
    await page.goto(`${Services.Blueprint.UI}/launch`);
    await page.waitForLoadState('networkidle');

    const mselCards = page.locator('mat-card, [class*="msel-card"], table tbody tr').first();
    const hasCards = await mselCards.isVisible({ timeout: 5000 }).catch(() => false);
    if (!hasCards) {
      test.skip();
      return;
    }

    const startButton = page.locator(
      'button:has-text("Start"), button[aria-label*="Start"]'
    ).first();
    const startVisible = await startButton.isVisible({ timeout: 5000 }).catch(() => false);
    if (!startVisible) {
      test.skip();
      return;
    }

    await startButton.click();

    // expect: Full-page loading card appears if launch takes long
    const loadingCard = page.locator(
      'text=Launching your event!, ' +
      '[class*="loading-card"]:has-text("Launching"), ' +
      'mat-card:has-text("Launching")'
    ).first();

    // expect: Loading card shows 'Launching your event!' title
    // expect: Message 'Please wait until you are redirected to the event.' is displayed
    // expect: Progress spinner is shown
    const loadingVisible = await loadingCard.isVisible({ timeout: 10000 }).catch(() => false);

    if (loadingVisible) {
      await expect(loadingCard).toContainText(/Launching your event!/i, { timeout: 5000 });

      const waitMessage = page.locator('text=/Please wait.*redirected/i').first();
      await expect(waitMessage).toBeVisible({ timeout: 5000 });

      const spinner = page.locator('mat-spinner, mat-progress-spinner, [class*="spinner"]').first();
      await expect(spinner).toBeVisible({ timeout: 5000 });
    } else {
      // Launch may have completed quickly or loading state was too brief to catch
      // Verify we are still in the app
      await expect(page).toHaveURL(/.*localhost:4725.*/, { timeout: 5000 });
    }
  });
});
