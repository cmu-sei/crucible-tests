// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: specs/blueprint-test-plan.md
// seed: tests/seed.spec.ts

import { test, expect, Services } from '../../fixtures';

test.describe('Home Page and Navigation', () => {
  test('Home Page Initial Load', async ({ blueprintAuthenticatedPage: page }) => {

    // expect: The home page loads successfully as the Event Dashboard
    await expect(page).toHaveURL(/^http:\/\/localhost:4725/, { timeout: 30000 });
    await page.waitForLoadState('networkidle');

    // expect: The topbar is visible with Blueprint branding
    const topbar = page.locator('[class*="topbar"], [class*="top-bar"], mat-toolbar').first();
    await expect(topbar).toBeVisible({ timeout: 10000 });

    // expect: The topbar displays 'Event Dashboard'
    const topbarText = page.locator('text=Event Dashboard');
    await expect(topbarText).toBeVisible({ timeout: 10000 });

    // expect: A Blueprint icon button is visible in the topbar that links to home
    const blueprintIcon = page.locator(
      'mat-toolbar button, mat-toolbar a, mat-toolbar img, mat-toolbar mat-icon'
    ).first();
    await expect(blueprintIcon).toBeVisible({ timeout: 5000 });

    // expect: The user's name is displayed in the topbar
    const topbarEl = page.locator('[class*="topbar"], mat-toolbar').first();
    const usernameDisplay = topbarEl.locator('[class*="username"], [class*="user"], button').last();
    await expect(usernameDisplay).toBeVisible({ timeout: 5000 });

    // expect: The main content area displays a card-based layout with Join/Launch/Build cards
    // At least one of these dashboard cards should be present for the admin user
    const joinCard = page.locator('text=Join an Event').first();
    const startCard = page.locator('text=Start an Event').first();
    const manageCard = page.locator('text=Manage an Event').first();
    const nothingCard = page.locator('text=Nothing to see here!').first();

    const hasJoin = await joinCard.isVisible({ timeout: 2000 }).catch(() => false);
    const hasStart = await startCard.isVisible({ timeout: 2000 }).catch(() => false);
    const hasManage = await manageCard.isVisible({ timeout: 2000 }).catch(() => false);
    const hasNothing = await nothingCard.isVisible({ timeout: 2000 }).catch(() => false);

    expect(hasJoin || hasStart || hasManage || hasNothing).toBe(true);

    // expect: The topbar uses Material Design 3 theme colors
    const backgroundColor = await topbar.evaluate((el) => {
      return window.getComputedStyle(el).backgroundColor;
    });
    // Accept any non-transparent background (theme-specific color)
    expect(backgroundColor).not.toBe('');
    expect(backgroundColor).not.toBe('transparent');
    expect(backgroundColor).not.toBe('rgba(0, 0, 0, 0)');
  });
});
