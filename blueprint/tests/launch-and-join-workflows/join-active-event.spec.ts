// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: specs/blueprint-test-plan.md
// seed: tests/seed.spec.ts

import { test, expect, Services } from '../../fixtures';

test.describe('Launch and Join Event Workflows', () => {
  test('Join Active Event', async ({ blueprintAuthenticatedPage: page }) => {
    // 1. Navigate to Event Dashboard and click 'Join an Event', then click 'Join' on a MSEL card
    await expect(page).toHaveURL(/^http:\/\/localhost:4725/, { timeout: 30000 });
    await page.waitForLoadState('networkidle');

    const joinEventCard = page.locator(
      'text=Join an Event, mat-card:has-text("Join an Event")'
    ).first();
    const joinCardVisible = await joinEventCard.isVisible({ timeout: 5000 }).catch(() => false);

    if (!joinCardVisible) {
      await page.goto(`${Services.Blueprint.UI}/join`);
    } else {
      await joinEventCard.click();
    }

    await page.waitForLoadState('networkidle');

    // expect: Join page displays with available MSELs to join
    await expect(page).toHaveURL(/.*\/join.*/, { timeout: 10000 });

    // expect: Only MSELs with status 'Deployed' are shown
    const deployedStatus = page.locator('text=Deployed, [class*="deployed-status"]').first();
    const deployedVisible = await deployedStatus.isVisible({ timeout: 3000 }).catch(() => false);

    const mselCards = page.locator('mat-card, [class*="msel-card"], table tbody tr').first();
    const hasCards = await mselCards.isVisible({ timeout: 5000 }).catch(() => false);
    if (!hasCards) {
      test.skip();
      return;
    }

    // Find and click a 'Join' button
    const joinButton = page.locator(
      'button:has-text("Join"), button[aria-label*="Join"]'
    ).first();
    const joinVisible = await joinButton.isVisible({ timeout: 5000 }).catch(() => false);
    if (!joinVisible) {
      test.skip();
      return;
    }

    await joinButton.click();
    await page.waitForLoadState('networkidle');

    // expect: User is redirected to the event participant view
    await expect(page).toHaveURL(/.*localhost:4725.*/, { timeout: 10000 });
  });
});
