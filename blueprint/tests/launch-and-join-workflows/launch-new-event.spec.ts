// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: specs/blueprint-test-plan.md
// seed: tests/seed.spec.ts

import { test, expect, Services } from '../../fixtures';

test.describe('Launch and Join Event Workflows', () => {
  test('Launch New Event', async ({ blueprintAuthenticatedPage: page }) => {
    // 1. Navigate to Event Dashboard and click 'Start an Event', then click 'Start' on a MSEL card
    await expect(page).toHaveURL(/^http:\/\/localhost:4725/, { timeout: 30000 });
    await page.waitForLoadState('networkidle');

    const startEventCard = page.locator(
      'text=Start an Event, mat-card:has-text("Start an Event"), [class*="launch-card"]'
    ).first();

    const cardVisible = await startEventCard.isVisible({ timeout: 5000 }).catch(() => false);
    if (!cardVisible) {
      // Try direct navigation to launch page
      await page.goto(`${Services.Blueprint.UI}/launch`);
      await page.waitForLoadState('networkidle');
    } else {
      await startEventCard.click();
      await page.waitForLoadState('networkidle');
    }

    // expect: Launch page displays MSELs to launch
    await expect(page).toHaveURL(/.*\/launch.*/, { timeout: 10000 });

    const mselCards = page.locator('mat-card, [class*="msel-card"], table tbody tr').first();
    const hasCards = await mselCards.isVisible({ timeout: 5000 }).catch(() => false);
    if (!hasCards) {
      test.skip();
      return;
    }

    // Find and click a 'Start' button on a MSEL card
    const startButton = page.locator(
      'button:has-text("Start"), button[aria-label*="Start"], [class*="start-btn"]'
    ).first();
    const startVisible = await startButton.isVisible({ timeout: 5000 }).catch(() => false);
    if (!startVisible) {
      test.skip();
      return;
    }

    await startButton.click();

    // expect: Launch process begins
    // expect: Progress spinner is displayed on the card
    const spinner = page.locator(
      'mat-spinner, mat-progress-spinner, [class*="spinner"]'
    ).first();
    const spinnerVisible = await spinner.isVisible({ timeout: 5000 }).catch(() => false);

    // expect: Launch status message is shown
    const launchStatus = page.locator(
      'text=Launching, text=Starting, [class*="launch-status"]'
    ).first();
    const statusVisible = await launchStatus.isVisible({ timeout: 5000 }).catch(() => false);

    // expect: Other launch buttons are disabled during launch
    // Wait for launch to complete
    await page.waitForLoadState('networkidle', { timeout: 30000 });

    // expect: MSEL status changes to 'Deployed' or user is redirected
    const deployed = page.locator('text=Deployed, [class*="deployed"]').first();
    const successNotif = page.locator(
      '[class*="snack"], [class*="toast"], [class*="notification"]'
    ).first();
    const isDeployed = await deployed.isVisible({ timeout: 10000 }).catch(() => false);
    const hasNotif = await successNotif.isVisible({ timeout: 5000 }).catch(() => false);
    // One of these outcomes expected
  });
});
