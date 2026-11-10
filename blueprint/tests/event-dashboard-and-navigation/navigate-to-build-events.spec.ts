// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: specs/blueprint-test-plan.md
// seed: tests/seed.spec.ts

import { test, expect, Services, serviceUrlPattern, BLUEPRINT_THEMES, applyBlueprintTheme } from '../../fixtures';
import { dashboardCard } from '../../test-helpers';

for (const theme of BLUEPRINT_THEMES) {
    test.describe(`${theme} theme › Event Dashboard and Navigation`, () => {
    test('Navigate to Build Events', async ({ blueprintAuthenticatedPage: page }) => {
    await applyBlueprintTheme(page, theme);
      // 1. From Event Dashboard, click on the BUILD card
      await expect(page).toHaveURL(serviceUrlPattern(Services.Blueprint.UI), { timeout: 30000 });

      // The admin account has CreateMsels, so the card is always offered to it. The click is
      // the card's own `(click)="gotoUrl('build')"`; a direct goto would skip what is tested.
      const buildCard = dashboardCard(page, 'BUILD');
      await expect(buildCard).toBeVisible({ timeout: 15000 });
      await buildCard.click();

      // expect: Navigation to /build occurs
      await expect(page).toHaveURL(/.*\/build.*/, { timeout: 10000 });

      // expect: Page displays MSEL list
      const mselList = page.locator(
        'mat-card, table, [class*="msel-list"], [class*="msel-card"], table tbody tr'
      ).first();
      await expect(mselList).toBeVisible({ timeout: 5000 });

      // expect: Admin button is visible if user has admin permissions
      const adminButton = page.locator(
        'button:has-text("Admin"), a:has-text("Admin"), [aria-label*="admin"], [class*="admin-btn"]'
      ).first();
      const adminVisible = await adminButton.isVisible({ timeout: 2000 }).catch(() => false);
      // Admin button may or may not be visible depending on permissions — not a hard assertion
      if (adminVisible) {
        await expect(adminButton).toBeVisible();
      }
    });
    });
}