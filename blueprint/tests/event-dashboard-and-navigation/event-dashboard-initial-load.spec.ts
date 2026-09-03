// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: specs/blueprint-test-plan.md
// seed: tests/seed.spec.ts

import { test, expect, Services, serviceUrlPattern } from '../../fixtures';

test.describe('Event Dashboard and Navigation', () => {
  test('Event Dashboard Initial Load', async ({ blueprintAuthenticatedPage: page }) => {
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
    // expect: If user has join MSELs, a 'Join an Event' card is visible with subtitle 'Access In-Progress Events'
    // expect: If user has launch MSELs, a 'Start an Event' card is visible with subtitle 'Launch New events'
    // expect: If user has build MSELs or create permission, a 'Manage an Event' card is visible with subtitle 'Design and Plan Events'
    // expect: If no MSELs are available and no create permission, a 'Nothing to see here!' card is displayed
    // Which card appears depends on the account's MSELs and permissions, so assert on
    // the union of the four possibilities. `locator.isVisible()` cannot express this:
    // its `timeout` option is ignored, so probing each card in turn only sampled the
    // DOM at that instant and failed whenever the dashboard was still showing the
    // "Initializing Data" card. `or()` + `toBeVisible` polls until one card renders.
    const anyDashboardCard = page
      .locator('text=Join an Event')
      .or(page.locator('text=Start an Event'))
      .or(page.locator('text=Manage an Event'))
      .or(page.locator('text=Nothing to see here!'))
      .first();

    await expect(anyDashboardCard).toBeVisible({ timeout: 15000 });
  });
});
