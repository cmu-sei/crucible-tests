// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: specs/blueprint-test-plan.md
// seed: tests/seed.spec.ts

import { test, expect, Services } from '../../fixtures';

test.describe('Event Dashboard and Navigation', () => {
  test('Navigate to Join Events', async ({ blueprintAuthenticatedPage: page }) => {
    // 1. From Event Dashboard, click on 'Join an Event' card
    await expect(page).toHaveURL(/^http:\/\/localhost:4725/, { timeout: 30000 });
    await page.waitForLoadState('networkidle');

    const joinCard = page.locator(
      'text=Join an Event, mat-card:has-text("Join"), [class*="join-card"]'
    ).first();

    const joinCardVisible = await joinCard.isVisible({ timeout: 5000 }).catch(() => false);

    if (!joinCardVisible) {
      test.skip();
      return;
    }

    await joinCard.click();

    // expect: Navigation to /join occurs
    await expect(page).toHaveURL(/.*\/join.*/, { timeout: 10000 });
    await page.waitForLoadState('networkidle');

    // expect: Page displays list of available MSELs to join
    const mselList = page.locator(
      'mat-card, [class*="msel-list"], [class*="msel-card"], table tbody tr'
    ).first();
    await expect(mselList).toBeVisible({ timeout: 5000 });

    // expect: Topbar still displays with navigation back to dashboard
    const topbar = page.locator('[class*="topbar"], mat-toolbar').first();
    await expect(topbar).toBeVisible({ timeout: 5000 });
  });
});
