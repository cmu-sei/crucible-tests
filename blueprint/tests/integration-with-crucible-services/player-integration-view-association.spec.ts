// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: specs/blueprint-test-plan.md

import { test, expect, Services } from '../../fixtures';
import { request as playwrightRequest, APIRequestContext } from '@playwright/test';
import {
  getBlueprintToken,
  createMsel,
  deleteMsel,
  updateMsel,
  getMsel,
  tempBlueprintName,
  navigateToMsel,
} from '../../test-helpers';

/**
 * Verifies a MSEL's Player-view association is displayed on the Config (Info) tab and
 * links to the right Player view.
 *
 * Rewritten. The previous version had two defects:
 *
 * 1. **It leaked a MSEL on every run.** It drove the UI to create one named the literal
 *    `'Test MSEL for Player Integration'` with no afterEach. The teardown purge matches
 *    the shape `tempBlueprintName()` emits, so that literal was never swept.
 * 2. **It could not fail.** The whole body was nested `if (await x.isVisible())` branches
 *    whose else-paths just `console.log`-ed — including the top-level one, so on this
 *    stack (where no "Create MSEL" button exists by that name) it fell straight through
 *    to a branch that asserted nothing at all.
 *
 * Two of its expectations turned out to describe things that do not exist / do not work.
 * Both are now stated explicitly rather than hidden behind a passing `if`:
 *
 * - **There is no "Player view selector".** Blueprint never lists Player views for the
 *   user to choose from; `grep -rn playerViewId blueprint.ui/src` finds only *display*
 *   sites. The association is minted server-side by Push Integrations
 *   (`IntegrationService.cs` ~line 299: `msel.PlayerViewId = Guid.NewGuid()`), which then
 *   creates that view in Player. So the test seeds the association through the API — the
 *   same field the push path writes — and asserts how the UI renders it.
 * - **The view *name* next to the checkbox does not render today.** The browser-side fetch of
 *   `{PlayerApiUrl}/views/{id}` is blocked by CORS, as Player's API does not allow the
 *   Blueprint UI origin. That assertion is kept intact in a `test.skip`-ed test below.
 */
test.describe('Integration with Crucible Services', () => {
  let token: string;
  let mselId: string;
  let playerViewId: string;
  let playerViewName: string;
  let apiContext: APIRequestContext;

  test.beforeEach(async () => {
    token = await getBlueprintToken();
    apiContext = await playwrightRequest.newContext({ ignoreHTTPSErrors: true });

    // A real Player view, so the id the UI links to resolves to something that exists.
    // The Blueprint session token carries the `player` scope (see the OIDC `scope` in
    // blueprint.ui settings.env.json), so it is accepted by the Player API.
    playerViewName = tempBlueprintName('TestBP-PlayerView');
    const viewRes = await apiContext.post(`${Services.Player.API}/api/views`, {
      headers: { Authorization: `Bearer ${token}` },
      data: {
        name: playerViewName,
        description: 'Seeded by Blueprint player-integration test; deleted on teardown.',
        status: 'Active',
        isTemplate: false,
        createAdminTeam: true,
      },
    });
    expect(viewRes.status(), `Player view create failed: ${await viewRes.text()}`).toBe(201);
    playerViewId = (await viewRes.json()).id;

    const msel = await createMsel(token, {
      name: tempBlueprintName('TestBP-PlayerIntegration'),
      description: 'Seeded to verify the Player view association display.',
    });
    mselId = msel.id;

    // Associate the Player view exactly as the push path does: usePlayer + playerViewId.
    await updateMsel(token, mselId, { usePlayer: true, playerViewId });
  });

  test.afterEach(async () => {
    try {
      if (mselId) {
        // Clear the association and leave a non-Deployed status first: deleting a
        // *Deployed* MSEL runs PullIntegrationsAsync, which would try to delete the
        // Player view out from under our own cleanup below. Logged rather than
        // swallowed if it fails — the delete below still runs either way.
        try {
          await updateMsel(token, mselId, {
            status: 'Approved',
            usePlayer: false,
            playerViewId: null,
          });
        } catch (err) {
          console.warn(`Could not clear integrations on MSEL ${mselId} before delete: ${err}`);
        }
        await deleteMsel(token, mselId);
      }
      if (playerViewId) {
        const del = await apiContext.delete(`${Services.Player.API}/api/views/${playerViewId}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!del.ok() && del.status() !== 404) {
          console.warn(`Player view cleanup for ${playerViewId} returned ${del.status()}`);
        }
      }
    } catch (err) {
      console.warn(`Cleanup failed for MSEL ${mselId} / view ${playerViewId}: ${err}`);
    } finally {
      await apiContext.dispose();
    }
  });

  test('Player Integration - View Association', async ({ blueprintAuthenticatedPage: page }) => {
    // Precondition, asserted rather than assumed: the API really holds the association.
    const seeded = await getMsel(token, mselId);
    expect(seeded.usePlayer).toBe(true);
    expect(seeded.playerViewId).toBe(playerViewId);
    expect(seeded.isTemplate).toBe(false);

    // 1. Open the MSEL's Config (Info) tab — the default tab for a MSEL.
    await navigateToMsel(page, mselId);

    // The Player integration row. Scoped by its own checkbox so this cannot silently
    // match the Gallery/CITE/Steamfitter rows, which have identical structure.
    const playerRow = page
      .locator('.integration-row')
      .filter({ has: page.getByRole('checkbox', { name: 'Player' }) });
    await expect(playerRow).toHaveCount(1);

    // expect: Player integration is shown as enabled.
    const playerCheckbox = page.getByRole('checkbox', { name: 'Player' });
    await expect(playerCheckbox).toBeVisible();
    await expect(playerCheckbox).toBeChecked();

    // expect: the associated view is shown as associated.
    // `msel-info.component.html` renders this block under
    // `@if (!msel.isTemplate && msel.usePlayer && msel.playerViewId)`, so all three
    // preconditions are seeded above and the details are deterministic.
    const details = playerRow.locator('.integration-details');
    await expect(details).toBeVisible();
    await expect(details.locator('.integration-label')).toHaveText('View:');
    await expect(details.locator('.integration-guid')).toHaveText(playerViewId);

    // expect: a link to open Player with this view is available and points at Player.
    // `getPlayerViewUrl()` builds `${PlayerUrl}/view/${playerViewId}`; assert the exact
    // URL rather than a bare port match so this holds under either topology.
    const playerLink = details.locator('a.integration-link');
    await expect(playerLink).toHaveAttribute('title', 'Open in Player');
    await expect(playerLink).toHaveAttribute(
      'href',
      `${Services.Player.UI.replace(/\/$/, '')}/view/${playerViewId}`
    );
    await expect(playerLink).toHaveAttribute('target', '_blank');

    // The integration-actions block is the other half of the contract: with a
    // playerViewId set, the header offers "Remove Integrations" and NOT
    // "Push Integrations" (the push button's `@if` requires every integration id to be
    // null). Asserting both directions proves the association drove the UI state.
    await expect(page.getByRole('button', { name: 'Remove Integrations' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Push Integrations' })).toHaveCount(0);
  });

  // Skipped pending upstream support: the Player view *name* can
  // never render, because the browser-side GET of `{PlayerApiUrl}/views/{id}` from the
  // Blueprint UI origin is rejected by Player's CORS policy. The assertion below is
  // correct as written and should pass once Player allows the Blueprint UI origin —
  // un-skip it then. It is deliberately NOT weakened into a passing branch.
  test('Player Integration - View Name Displayed', async ({
    blueprintAuthenticatedPage: page,
  }) => {
    test.skip(
      true,
      'Pending upstream support: Player API CORS policy allowing the Blueprint UI origin, ' +
        'which msel-info.component.ts fetchIntegrationNames() needs to resolve playerViewName'
    );

    // `fetchIntegrationNames()` returns early unless the MSEL is Deployed, so that is a
    // real precondition for the name lookup and is seeded here.
    await updateMsel(token, mselId, { status: 'Deployed' });

    await navigateToMsel(page, mselId);

    const playerRow = page
      .locator('.integration-row')
      .filter({ has: page.getByRole('checkbox', { name: 'Player' }) });

    // 2. expect: Player view name is displayed next to the Player checkbox.
    await expect(playerRow.locator('.integration-name')).toHaveText(playerViewName);
  });
});
