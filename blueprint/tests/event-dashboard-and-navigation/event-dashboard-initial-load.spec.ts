// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: specs/blueprint-test-plan.md
// seed: tests/seed.spec.ts

import { test, expect, Services } from '../../fixtures';

test.describe('Event Dashboard and Navigation', () => {
  test('Event Dashboard Initial Load', async ({ blueprintAuthenticatedPage: page }) => {

    // expect: The Event Dashboard loads successfully
    await expect(page).toHaveURL(/^http:\/\/localhost:4725/, { timeout: 30000 });
    await page.waitForLoadState('networkidle');

    // expect: The topbar is visible with Blueprint branding
    const topbar = page.locator(
      '[class*="topbar"], [class*="top-bar"], mat-toolbar, [class*="toolbar"]'
    ).first();
    await expect(topbar).toBeVisible({ timeout: 10000 });

    // expect: The topbar displays 'Event Dashboard'
    await expect(page.locator('text=Event Dashboard')).toBeVisible({ timeout: 10000 });

    // expect: A Blueprint icon button is displayed in the topbar
    const blueprintIcon = page.locator(
      'mat-toolbar button, mat-toolbar a, mat-toolbar img, mat-toolbar mat-icon'
    ).first();
    await expect(blueprintIcon).toBeVisible({ timeout: 5000 });

    // expect: The user's name is displayed in the topbar
    const topbarEl = page.locator('[class*="topbar"], mat-toolbar').first();
    const topbarHasUser = await topbarEl.locator('[class*="username"], [class*="user"]').first()
      .isVisible({ timeout: 3000 }).catch(() => false);
    if (!topbarHasUser) {
      await expect(topbarEl).toContainText(/admin/i, { timeout: 5000 });
    }

    // 2. Check for available dashboard cards
    // expect: If user has join MSELs, a 'Join an Event' card is visible with subtitle 'Access In-Progress Events'
    // expect: If user has launch MSELs, a 'Start an Event' card is visible with subtitle 'Launch New events'
    // expect: If user has build MSELs or create permission, a 'Manage an Event' card is visible with subtitle 'Design and Plan Events'
    // expect: If no MSELs are available and no create permission, a 'Nothing to see here!' card is displayed
    const joinCard = page.locator('text=Join an Event').first();
    const launchCard = page.locator('text=Start an Event').first();
    const buildCard = page.locator('text=Manage an Event').first();
    const emptyCard = page.locator('text=Nothing to see here!').first();

    const hasJoin = await joinCard.isVisible({ timeout: 2000 }).catch(() => false);
    const hasLaunch = await launchCard.isVisible({ timeout: 2000 }).catch(() => false);
    const hasBuild = await buildCard.isVisible({ timeout: 2000 }).catch(() => false);
    const hasEmpty = await emptyCard.isVisible({ timeout: 2000 }).catch(() => false);

    expect(hasJoin || hasLaunch || hasBuild || hasEmpty).toBe(true);
  });
});
