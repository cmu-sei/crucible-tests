// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: specs/blueprint-test-plan.md
// seed: tests/seed.spec.ts
//
// Test: Navigate to Launch Events (plan item 2.3)
//
// Rewritten. The previous version located the card with `text=Start an Event, mat-card:...`
// — a comma-combined `text=` selector, which matches ZERO elements (Playwright's text engine
// cannot be comma-joined) — and then self-skipped with a bare `test.skip()` when it wasn't
// found. So it never navigated and never asserted anything, silently, on every run.
//
// The card genuinely cannot appear. Two gates, both traced to source:
//
//   dashboard.component.html        @if (launchMselList.length > 0) { ...LAUNCH card... }
//   dashboard.component.ts          launchMselList <- mselDataService.getMyLaunchMsels()
//   MselService.cs:2203             GetMyLaunchInvitationMselsAsync returns
//                                     new List<ViewModels.Msel>()  // unconditionally
//                                     // "DISABLED: Auto-discovery based on email domain
//                                     //  matching / Users must now use invitation links"
//
// Verified live: `GET /api/my-launch-msels` -> `[]` (200). So `launchMselList` is always
// empty, the LAUNCH card never renders, and /launch is reachable only by direct URL
// or an invitation link. Deliberate product behaviour, not an app bug.
//
// This spec now asserts that contract strictly. If auto-discovery is re-enabled the first
// assertion fails, prompting a rewrite that covers the real card-click navigation.

import { test, expect, Services, BLUEPRINT_THEMES, applyBlueprintTheme } from '../../fixtures';
import { getBlueprintToken, dashboardCard } from '../../test-helpers';

for (const theme of BLUEPRINT_THEMES) {
    test.describe(`${theme} theme › Event Dashboard and Navigation`, () => {
    test('Navigate to Launch Events', async ({ blueprintAuthenticatedPage: page }) => {
    await applyBlueprintTheme(page, theme);
      const token = await getBlueprintToken();

      // 1. The list that gates the LAUNCH card is empty by design.
      const launchList = await page.request.get(`${Services.Blueprint.API}/api/my-launch-msels`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      expect(launchList.status(), 'my-launch-msels must be reachable').toBe(200);
      expect(
        await launchList.json(),
        'launch auto-discovery is disabled in MselService.GetMyLaunchInvitationMselsAsync — if ' +
          'this is no longer empty, restore card-click coverage in this spec'
      ).toEqual([]);

      // 2. The dashboard renders, and therefore omits the launch card.
      await page.goto(Services.Blueprint.UI, { waitUntil: 'domcontentloaded' });
      // The dashboard is genuinely populated first — this is not an empty page that trivially
      // lacks the card. The JOIN card always renders, and BUILD renders for a user who can
      // create MSELs, so their presence proves the grid rendered its cards at all.
      await expect(dashboardCard(page, 'JOIN')).toBeVisible({ timeout: 20000 });
      await expect(dashboardCard(page, 'BUILD')).toBeVisible({ timeout: 20000 });

      await expect(
        dashboardCard(page, 'LAUNCH'),
        'the LAUNCH card cannot render while launchMselList is empty'
      ).toHaveCount(0);
      await expect(page.getByRole('button', { name: 'Start Event' })).toHaveCount(0);

      // 3. The /launch route itself still resolves when reached directly.
      await page.goto(`${Services.Blueprint.UI}/launch`, { waitUntil: 'domcontentloaded' });
      await expect(page).toHaveURL(/\/launch/, { timeout: 15000 });
      await expect(page.locator('app-topbar').first()).toBeVisible({ timeout: 15000 });
    });
    });
}