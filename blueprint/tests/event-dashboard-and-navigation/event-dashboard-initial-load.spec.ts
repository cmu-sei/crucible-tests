// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: specs/blueprint-test-plan.md
// seed: tests/seed.spec.ts

import { test, expect, Services, serviceUrlPattern, BLUEPRINT_THEMES, applyBlueprintTheme } from '../../fixtures';
import { dashboardCard } from '../../test-helpers';

for (const theme of BLUEPRINT_THEMES) {
    test.describe(`${theme} theme › Event Dashboard and Navigation`, () => {
    test('Event Dashboard Initial Load', async ({ blueprintAuthenticatedPage: page }) => {
    await applyBlueprintTheme(page, theme);
      // expect: The Event Dashboard loads successfully
      await expect(page).toHaveURL(serviceUrlPattern(Services.Blueprint.UI), { timeout: 30000 });

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
      // The name comes from the OIDC profile, which the topbar renders only after the
      // user observable emits, so this needs a retrying assertion rather than a
      // point-in-time visibility probe.
      const topbarEl = page.locator('[class*="topbar"], mat-toolbar').first();
      await expect(topbarEl).toContainText(/admin/i, { timeout: 10000 });

      // 2. Check for available dashboard cards
      // expect: A JOIN card is always shown, subtitled 'Active Exercises', with the count of
      //   joinable events — disabled when there are none
      // expect: A BUILD card, subtitled 'Design & Planning', is shown to a user with build
      //   MSELs or the CreateMsels permission, which the admin account has
      // The cards render only once the dashboard's data has loaded (it shows an
      // "Initializing Data" card until then), so these assertions are also the wait for that.
      const joinCard = dashboardCard(page, 'JOIN');
      await expect(joinCard).toBeVisible({ timeout: 15000 });
      await expect(joinCard).toContainText('Active Exercises');
      await expect(joinCard).toContainText('Events Ready');

      const buildCard = dashboardCard(page, 'BUILD');
      await expect(buildCard).toBeVisible();
      await expect(buildCard).toContainText('Design & Planning');
      await expect(buildCard.getByRole('button', { name: 'Manage Events' })).toBeVisible();

      // expect: The empty states are not shown to a user with something to do
      await expect(dashboardCard(page, 'NO ACCESS')).toHaveCount(0);
      await expect(dashboardCard(page, 'NOT LOADED')).toHaveCount(0);
    });
    });
}