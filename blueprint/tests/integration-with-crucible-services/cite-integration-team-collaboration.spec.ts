// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: specs/blueprint-test-plan.md

import { test, expect } from '../../fixtures';
import {
  getBlueprintToken,
  createMsel,
  deleteMsel,
  updateMsel,
  createTeam,
  navigateToMsel,
  tempBlueprintName,
} from '../../test-helpers';

/**
 * CITE integration: the Config tab's team-readiness validation.
 *
 * Rewritten. The previous version opened `/build`, grabbed the globally first MSEL link,
 * and ran a bare `test.skip()` when it found none — so on a stack with no pre-existing
 * MSELs it reported green having asserted nothing, and on any other stack it asserted
 * against a MSEL it did not own. It also depended on `text=Scoring Model:,
 * [class*="scoring-model"]`; Playwright's `text=` engine cannot be comma-combined, so that
 * locator matches **zero** elements. Every remaining check was wrapped in
 * `if (await x.isVisible().catch(() => false))`, so nothing could fail.
 *
 * This version seeds its own MSEL and team, so it has no dependency on database shape.
 *
 * The behaviour under test is `citeWarningMessage()` in `msel-info.component.ts`. With CITE
 * enabled and no evaluation pushed yet, it emits a single message whenever any team on the
 * MSEL still lacks a CITE Team Type (`citeToDo()`):
 *
 *   "** There are unassigned CITE Team Types in Teams **"
 *
 * That state is the one reachable through public API seeding: `POST /api/teams` does not
 * accept a `citeTeamTypeId` (verified: the created team comes back with
 * `citeTeamTypeId: null`), and this stack has no `/api/citeteamtypes` endpoint to read valid
 * ids from — it answers **404**. So the fully-typed (no-warning) fixture cannot be built
 * here; that half of the branch is left uncovered deliberately rather than faked.
 *
 * The Push Integrations button is bound to
 * `[disabled]="... || (msel.useCite && !msel.citeScoringModelId) || (msel.useCite &&
 * hasCiteTeamsWithoutType()) || ..."` (`msel-info.component.html:129-133`), so with an
 * untyped team it must be disabled. That is asserted too, since it is the user-visible
 * consequence of the warning.
 */
test.describe('Integration with Crucible Services', () => {
  let token: string;
  let mselId: string;

  test.beforeEach(async () => {
    token = await getBlueprintToken();
    const msel = await createMsel(token, { name: tempBlueprintName('TestBP-CiteTeam') });
    mselId = msel.id;

    // Enable CITE. The Config tab is explicit-save, so seeding the flag through the API
    // keeps this spec about the validation rather than about the save mechanism.
    await updateMsel(token, mselId, { useCite: true });
  });

  test.afterEach(async () => {
    try {
      if (mselId) await deleteMsel(token, mselId);
    } catch (err) {
      console.warn(`Cleanup failed for MSEL ${mselId}: ${err}`);
    }
  });

  test('CITE Integration Team Collaboration', async ({ blueprintAuthenticatedPage: page }) => {
    // 1. Seed one team. `POST /api/teams` leaves citeTeamTypeId null, which is exactly the
    //    "no teams have a CITE Team Type" state.
    const team = await createTeam(token, mselId, { name: tempBlueprintName('TestBP-CiteTeamA') });
    expect(team.mselId).toBe(mselId);

    // 2. Open the seeded MSEL's Config tab.
    await navigateToMsel(page, mselId);

    const configTab = page.getByRole('tab', { name: 'Config' });
    await expect(configTab).toBeVisible({ timeout: 10000 });
    await expect(configTab).toHaveAttribute('aria-selected', 'true');

    // expect: CITE is shown as enabled, since that is what was seeded.
    const citeCheckbox = page.locator('mat-checkbox').filter({ hasText: 'CITE' }).first();
    await expect(citeCheckbox).toBeVisible({ timeout: 10000 });
    await expect(citeCheckbox.locator('input[type="checkbox"]')).toBeChecked();

    // expect: enabling CITE reveals the Scoring Model field. Asserted as a real locator --
    // the previous comma-joined `text=` selector could never match.
    await expect(page.getByText('Scoring Model:', { exact: true })).toBeVisible({ timeout: 10000 });

    // 3. expect: the CITE team-type warning is rendered, naming the actual condition.
    //    citeWarningMessage() emits one message for the whole citeToDo() condition; it no
    //    longer distinguishes "some teams typed" from "none typed".
    await expect(
      page.getByText(/There are unassigned CITE Team Types in Teams/i)
    ).toBeVisible({ timeout: 10000 });

    // 4. expect: Push Integrations is blocked while a team lacks a CITE Team Type.
    const pushButton = page.getByRole('button', { name: 'Push Integrations' });
    await expect(pushButton).toBeVisible({ timeout: 10000 });
    await expect(pushButton).toBeDisabled();
  });
});
