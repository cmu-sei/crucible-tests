// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: specs/blueprint-test-plan.md
// seed: tests/seed.spec.ts
//
// Test: Join Active Event (plan item 8.3)
//
// Rewritten. The previous version could not fail:
//
//   1. `page.locator('text=Join an Event, mat-card:has-text("Join an Event")')` and
//      `page.locator('text=Deployed, [class*="deployed-status"]')` match ZERO elements —
//      Playwright's `text=` engine cannot be comma-combined.
//   2. Two bare `test.skip(); return;` bail-outs fired on the resulting misses, so it
//      reported green while asserting nothing.
//   3. Its `deployedVisible` result was computed into a variable that was never read, and
//      its final "user is redirected to the event participant view" assertion checked for
//      the **Blueprint** URL — which is where the user already was — so it would have
//      passed even if the join had done nothing.
//
// What actually happens on a join (all verified live on this stack, browser-driven):
//
//   * The card list comes from `GET /api/my-join-msels`
//     (`MselService.GetMyJoinInvitationMselsAsync`), which needs Deployed + non-null
//     PlayerViewId + team membership — `seedJoinableMsel` does all three.
//   * Clicking Join issues `POST /api/msels/{id}/join?teamId=` and, on success, the
//     component does `location.href = PlayerUrl + 'view/' + playerViewId`
//     (join.component.ts `join()`), a genuine cross-app navigation.
//   * Player IS reachable in this stack (settings.json `PlayerUrl` is
//     http://localhost:4301, and it answers 200), so that redirect is assertable and is
//     asserted below — no "assert up to the click" fallback was needed.
//
// One non-obvious prerequisite, and the reason a seeded-only MSEL is not enough:
// `JoinMselByInvitationAsync` first checks `GetMyDeployedMselIdsAsync`, i.e. the Player
// views the user is genuinely in. A seeded `playerViewId` is a synthetic guid, so that
// check misses and the code falls through to the Invitation branch. With no Invitation row
// the endpoint answers 403 "No invitations exist for MSEL {id}." Verified live: 403 without
// an invitation, 200 returning the Player View id with one. Hence `createInvitation` below.
//
// Note the landing URL: Player's own OIDC guard bounces /view/<id> through
// /auth-callback and then, because the synthetic view id does not exist in Player, on to
// Player's root. This spec therefore asserts the redirect reached the **Player app with
// the returned view id**, which is the behaviour Blueprint is responsible for, and does not
// assert on Player's rendering of a view Blueprint never really created.

import { test, expect, Services } from '../../fixtures';
import {
  getBlueprintToken,
  getCurrentBlueprintUserId,
  seedJoinableMsel,
  createInvitation,
  listMyJoinMsels,
  getMsel,
  deleteMsel,
  tempBlueprintName,
} from '../../test-helpers';

test.describe('Launch and Join Event Workflows', () => {
  let token: string;
  let mselId: string;
  let mselName: string;
  let playerViewId: string;

  test.beforeEach(async () => {
    token = await getBlueprintToken();
    const userId = await getCurrentBlueprintUserId(token);
    const seeded = await seedJoinableMsel(token, userId, {
      name: tempBlueprintName('TestBP-JoinActive'),
    });
    mselId = seeded.mselId;
    mselName = seeded.mselName;

    // Without this the join POST is a 403 (see the header note).
    await createInvitation(token, mselId, seeded.teamId);

    // The Player View id the join is expected to hand back — read from the API so the
    // redirect assertion below compares against the real value, not a guess.
    const msel = await getMsel(token, mselId);
    playerViewId = msel.playerViewId;
    expect(playerViewId, 'seeded MSEL must carry a playerViewId').toBeTruthy();

    // Preconditions, asserted: the MSEL is Deployed and on the join list. Both are what
    // make the card render, so a failure here is a seeding failure, not a UI failure.
    expect(msel.status).toBe('Deployed');
    const joinList = await listMyJoinMsels(token);
    expect(joinList.map((m: any) => m.id)).toContain(mselId);
  });

  test.afterEach(async () => {
    // `deleteMsel` cascades the MSEL's teams and invitations (verified: the invitation id
    // 404s afterwards), so this single call is the whole teardown.
    if (mselId) await deleteMsel(token, mselId);
  });

  test('Join Active Event', async ({ blueprintAuthenticatedPage: page }) => {
    // 1. Navigate to the join surface and click 'Join' on the seeded MSEL's card.
    await page.goto(`${Services.Blueprint.UI}/join`, { waitUntil: 'domcontentloaded' });
    await expect(page).toHaveURL(/\/join(?:[/?#]|$)/, { timeout: 20000 });

    // expect: Join page displays with available MSELs to join — identified by the seeded
    // MSEL's unique name, so this cannot pass on some unrelated card.
    const mselCard = page.locator('.card-container mat-card').filter({ hasText: mselName });
    await expect(mselCard).toBeVisible({ timeout: 30000 });
    await expect(mselCard).toHaveCount(1);
    await expect(mselCard.locator('mat-card-title')).toHaveText(mselName);

    // expect: Only MSELs with status 'Deployed' are shown.
    //
    // The card markup carries no status text at all (join.component.html renders only name
    // + description + a Join button), so "Deployed-only" is not observable in the DOM — the
    // old spec's `text=Deployed` locator was doomed twice over. It IS observable through the
    // list that populates those cards: every entry `my-join-msels` returns is Deployed.
    // Asserted over the whole list so a non-Deployed leak would fail.
    const joinList = await listMyJoinMsels(token);
    expect(joinList.length, 'join list must contain at least the seeded MSEL').toBeGreaterThan(0);
    expect(
      joinList.map((m: any) => m.status),
      'every MSEL offered for joining must be Deployed'
    ).toEqual(joinList.map(() => 'Deployed'));
    expect(
      joinList.every((m: any) => m.playerViewId),
      'every MSEL offered for joining must have a Player view'
    ).toBe(true);

    // The join affordance, scoped to this MSEL's card.
    //
    // Located by `title="Join {{ msel.name }}"`, NOT by accessible name: the button has
    // visible text ("Join"), and visible text wins when the accessible name is computed, so
    // `getByRole('button', { name: 'Join <mselName>' })` matches nothing. Verified live.
    // Scoping to `mselCard` is what ties the click to the seeded MSEL — an unscoped
    // "Join"-named button would match every card on the page.
    const joinButton = mselCard.getByTitle(`Join ${mselName}`);
    await expect(joinButton).toBeVisible();
    await expect(joinButton).toBeEnabled();
    await expect(joinButton).toHaveText('Join');

    // 2. Click Join. Two things must both happen, and both are waited on paired with the
    //    click: the join request succeeds, and the browser leaves Blueprint for Player.
    const [joinResponse] = await Promise.all([
      page.waitForResponse(
        (r) =>
          r.url().includes(`/api/msels/${mselId}/join`) && r.request().method() === 'POST',
        { timeout: 60000 }
      ),
      page.waitForURL((url) => url.toString().includes(`/view/${playerViewId}`), {
        timeout: 60000,
      }),
      joinButton.click(),
    ]);

    // expect: the join call succeeded and returned this MSEL's Player View id.
    expect(joinResponse.status(), await joinResponse.text().catch(() => '')).toBe(200);

    // expect: User is redirected to the event participant view — i.e. the PLAYER app (not
    // Blueprint, which is what the old assertion checked) at the returned view id.
    expect(page.url()).toContain(Services.Player.UI);
    expect(page.url()).toContain(`/view/${playerViewId}`);

    // And the user is genuinely recorded as a participant: joining adds a Viewer MSEL role.
    const afterJoin = await getMsel(token, mselId);
    const userId = await getCurrentBlueprintUserId(token);
    expect(
      (afterJoin.userMselRoles ?? []).map((r: any) => `${r.userId}:${r.role}`),
      'joining must grant the user a Viewer role on the MSEL'
    ).toContain(`${userId}:Viewer`);
  });
});
