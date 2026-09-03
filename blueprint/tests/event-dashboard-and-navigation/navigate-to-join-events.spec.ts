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
// The card was genuinely absent as well, because nothing seeded a joinable MSEL. The
// dashboard renders the Join card behind `@if (joinMselList.length > 0)`
// (dashboard.component.html), fed by `GET /api/my-join-msels` →
// `MselService.GetMyJoinInvitationMselsAsync`, which requires ALL THREE of:
//   - `msel.Status == Deployed`,
//   - `msel.PlayerViewId != null`, and
//   - the current user being on one of that MSEL's teams.
// `seedJoinableMsel` satisfies all three, so the card renders and the navigation the plan
// item describes becomes assertable end to end.
//
// Verified live against this stack: with the MSEL seeded, `my-join-msels` returns exactly
// it, the dashboard shows "Join an Event" / "Access In-Progress Events", clicking it routes
// to /join, and /join lists the MSEL by name with a "Join <name>" button.

import { test, expect, Services } from '../../fixtures';
import {
  getBlueprintToken,
  getCurrentBlueprintUserId,
  seedJoinableMsel,
  listMyJoinMsels,
  deleteMsel,
  tempBlueprintName,
} from '../../test-helpers';

test.describe('Event Dashboard and Navigation', () => {
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
    // 1. From Event Dashboard, click on 'Join an Event' card.
    //
    // The fixture already navigated to the dashboard, but it may have done so before the
    // MSEL was seeded in a retried run, so reload to guarantee the card list is current.
    await page.goto(Services.Blueprint.UI, { waitUntil: 'domcontentloaded' });

    // `.card-container` wraps the dashboard cards; the Join card carries
    // role="button" + (click)="gotoUrl('join')".
    const joinCard = page
      .locator('.card-container mat-card')
      .filter({ hasText: 'Join an Event' });
    await expect(joinCard).toBeVisible({ timeout: 30000 });
    await expect(joinCard).toHaveCount(1);
    await expect(joinCard.locator('mat-card-subtitle')).toHaveText(
      'Access In-Progress Events'
    );

    await joinCard.click();

    // expect: Navigation to /join occurs.
    await expect(page).toHaveURL(/\/join(?:[/?#]|$)/, { timeout: 20000 });

    // expect: Page displays list of available MSELs to join.
    //
    // Asserted by the seeded MSEL's UNIQUE name, not by "some mat-card exists" — the old
    // spec's `mat-card, [class*="msel-list"], ... table tbody tr` would have matched the
    // topbar's own chrome or an unrelated row and passed without the MSEL being listed.
    const mselCard = page.locator('.card-container mat-card').filter({ hasText: mselName });
    await expect(mselCard).toBeVisible({ timeout: 30000 });
    await expect(mselCard).toHaveCount(1);
    await expect(mselCard.locator('mat-card-title')).toHaveText(mselName);

    // The card's join affordance is present and identifies the MSEL.
    //
    // Located by `title="Join {{ msel.name }}"`, NOT by accessible name: this button has
    // visible text ("Join"), and visible text wins over `title` when the accessible name is
    // computed. So `getByRole('button', { name: 'Join <mselName>' })` matches nothing here —
    // the "icon buttons carry title, and getByRole still finds them" rule only holds for
    // buttons with no text content of their own.
    const joinButton = mselCard.getByTitle(`Join ${mselName}`);
    await expect(joinButton).toBeVisible();
    await expect(joinButton).toHaveText('Join');

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
    await expect(
      page.locator('.card-container mat-card').filter({ hasText: 'Join an Event' })
    ).toBeVisible({ timeout: 30000 });
  });
});
