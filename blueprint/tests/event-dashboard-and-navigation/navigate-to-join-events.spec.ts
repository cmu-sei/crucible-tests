// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: specs/blueprint-test-plan.md
// seed: tests/seed.spec.ts
//
// Test: Navigate to Join Events (plan item 2.2)
//
// Rewritten. The previous version asserted nothing at all:
//
//   1. Its locator was `page.locator('text=Join an Event, mat-card:has-text("Join"), ...')`.
//      Playwright's `text=` engine CANNOT be comma-combined, so that selector matched ZERO
//      elements no matter what the page contained.
//   2. On the resulting miss it ran a bare `test.skip(); return;`, reporting green while
//      covering nothing — every run took that branch.
//
// The dashboard's JOIN card is always shown, but it only opens /join when the user has a
// joinable MSEL: it is `disabled-card` and its click is `joinMselList.length > 0 &&
// gotoUrl('join')` (dashboard.component.html). That list is `GET /api/my-join-msels` →
// `MselService.GetMyJoinInvitationMselsAsync`, which requires ALL THREE of:
//   - `msel.Status == Deployed`,
//   - `msel.PlayerViewId != null`, and
//   - the current user being on one of that MSEL's teams.
// `seedJoinableMsel` satisfies all three, so the card is live and the navigation the plan
// item describes becomes assertable end to end.
//
// With the MSEL seeded, `my-join-msels` returns it, the JOIN card counts it and is enabled,
// clicking it routes to /join, and /join lists the MSEL by name with a "Join" link.

import { test, expect, Services, BLUEPRINT_THEMES, applyBlueprintTheme } from '../../fixtures';
import {
  getBlueprintToken,
  getCurrentBlueprintUserId,
  seedJoinableMsel,
  listMyJoinMsels,
  deleteMsel,
  tempBlueprintName,
  dashboardCard,
  joinPageCard,
} from '../../test-helpers';

for (const theme of BLUEPRINT_THEMES) {
    test.describe(`${theme} theme › Event Dashboard and Navigation`, () => {
    let token: string;
    let mselId: string;
    let mselName: string;

    test.beforeEach(async () => {
      token = await getBlueprintToken();
      const userId = await getCurrentBlueprintUserId(token);
      const seeded = await seedJoinableMsel(token, userId, {
        name: tempBlueprintName('TestBP-NavJoin'),
      });
      mselId = seeded.mselId;
      mselName = seeded.mselName;

      // Precondition, asserted rather than assumed: the join surface really is populated.
      // If this list were empty the Join card would legitimately be absent and every
      // assertion below would be testing the wrong thing.
      const joinList = await listMyJoinMsels(token);
      expect(
        joinList.map((m: any) => m.id),
        "seeded MSEL must be on the current user's join list"
      ).toContain(mselId);
    });

    test.afterEach(async () => {
      // `deleteMsel` cascades the MSEL's teams, which takes the TeamUser row with them.
      if (mselId) await deleteMsel(token, mselId);
    });

    test('Navigate to Join Events', async ({ blueprintAuthenticatedPage: page }) => {
    await applyBlueprintTheme(page, theme);
      // 1. From Event Dashboard, click on the JOIN card.
      //
      // The fixture already navigated to the dashboard, but it may have done so before the
      // MSEL was seeded in a retried run, so reload to guarantee the card list is current.
      await page.goto(Services.Blueprint.UI, { waitUntil: 'domcontentloaded' });

      const joinCard = dashboardCard(page, 'JOIN');
      await expect(joinCard).toBeVisible({ timeout: 30000 });
      await expect(joinCard).toContainText('Active Exercises');
      // expect: the card is live — its Join Event button is enabled and it is not greyed out,
      // which it is when there is nothing to join.
      await expect(joinCard.getByRole('button', { name: 'Join Event' })).toBeEnabled();
      await expect(joinCard).not.toHaveClass(/disabled-card/);

      await joinCard.click();

      // expect: Navigation to /join occurs.
      await expect(page).toHaveURL(/\/join(?:[/?#]|$)/, { timeout: 20000 });

      // expect: Page displays list of available MSELs to join.
      //
      // Asserted by the seeded MSEL's UNIQUE name, not by "some card exists" — the old
      // spec's `mat-card, [class*="msel-list"], ... table tbody tr` would have matched the
      // topbar's own chrome or an unrelated row and passed without the MSEL being listed.
      await expect(page.getByRole('heading', { name: 'Join an Event', level: 1 })).toBeVisible();
      const mselCard = joinPageCard(page, mselName);
      await expect(mselCard).toBeVisible({ timeout: 30000 });
      await expect(mselCard).toHaveCount(1);

      // The card's join affordance is present and identifies the MSEL.
      //
      // Located by `title="Join {{ msel.name }}"`, NOT by accessible name: this link has
      // visible text ("Join"), and visible text wins over `title` when the accessible name is
      // computed. So `getByRole('link', { name: 'Join <mselName>' })` matches nothing here.
      const joinLink = mselCard.getByTitle(`Join ${mselName}`);
      await expect(joinLink).toBeVisible();
      await expect(joinLink).toHaveText('Join');

      // expect: Topbar still displays with navigation back to dashboard.
      const topbar = page.locator('app-topbar mat-toolbar');
      await expect(topbar).toBeVisible();
      await expect(page.locator('app-topbar .view-text')).toHaveText('Join Event');

      // "navigation back to dashboard" is a real affordance, so exercise it rather than just
      // asserting a toolbar exists: the topbar's Blueprint icon is a `routerLink="/"` anchor.
      const homeLink = page.locator('app-topbar a[mat-icon-button]').first();
      await expect(homeLink).toHaveAttribute('href', '/');
      await homeLink.click();

      await expect(page).toHaveURL(
        new RegExp(`^${Services.Blueprint.UI.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}/?$`),
        { timeout: 20000 }
      );
      // Back on the dashboard, the Join card is showing again — proving the round trip.
      await expect(dashboardCard(page, 'JOIN')).toBeVisible({ timeout: 30000 });
    });
    });
}