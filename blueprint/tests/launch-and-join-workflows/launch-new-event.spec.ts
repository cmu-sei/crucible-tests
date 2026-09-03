// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: specs/blueprint-test-plan.md
// seed: tests/seed.spec.ts
//
// Test: Launch New Event (plan item 8.1)
//
// Rewritten. The previous version could not fail: every step was guarded by
// `if (!await x.isVisible().catch(() => false)) { test.skip(); return; }`, so a missing
// locator produced a silent green. Its last three "expectations" were computed into unread
// variables and followed by the comment "One of these outcomes expected" — no assertion at
// all. It also used `text=A, text=B` selectors, which match ZERO elements: Playwright's
// `text=` engine cannot be comma-combined.
//
// The reason the cards were never there is in the application source, not in the test:
//
//   MselService.cs:2203  GetMyLaunchInvitationMselsAsync
//     // DISABLED: Auto-discovery based on email domain matching
//     // Users must now use invitation links directly to launch MSELs
//     return new List<ViewModels.Msel>();
//
// It returns an empty list unconditionally. Verified live: `GET /api/my-launch-msels` answers
// `[]` with 200 no matter what is seeded. The /launch page's card list is therefore empty BY
// DESIGN, and launching is reachable only through an invitation link. That is a deliberate
// product decision (hence no BP-n entry), but it means a spec that drives the launch *cards*
// has nothing to drive.
//
// So this spec asserts the contract that actually holds, strictly. If auto-discovery is ever
// re-enabled, `my-launch-msels` starts returning rows and this spec FAILS — which is the
// correct signal to restore full launch-flow coverage here.

import { test, expect, Services } from '../../fixtures';
import {
  getBlueprintToken,
  createMsel,
  deleteMsel,
  tempBlueprintName,
} from '../../test-helpers';

test.describe('Launch and Join Event Workflows', () => {
  let token: string;
  let mselId: string;
  let mselName: string;

  test.beforeEach(async () => {
    // Seed an Approved MSEL — the most launch-eligible state a MSEL can be in. Its presence
    // is what makes the assertions below meaningful: the launch list stays empty even though
    // a launchable-looking MSEL exists, pinning the behaviour on the disabled discovery path
    // rather than on "there was simply nothing to launch".
    token = await getBlueprintToken();
    mselName = tempBlueprintName('TestBP-Launch');
    const msel = await createMsel(token, {
      name: mselName,
      description: 'Seeded to prove the launch list is empty by design',
      status: 'Approved',
    });
    mselId = msel.id;
  });

  test.afterEach(async () => {
    if (mselId) await deleteMsel(token, mselId);
  });

  test('Launch New Event', async ({ blueprintAuthenticatedPage: page }) => {
    // 1. The API that feeds the launch card list returns an empty collection by design.
    const launchList = await page.request.get(`${Services.Blueprint.API}/api/my-launch-msels`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(launchList.status(), 'my-launch-msels must be reachable').toBe(200);
    expect(
      await launchList.json(),
      'launch discovery is disabled in MselService.GetMyLaunchInvitationMselsAsync — if this ' +
        'is no longer empty, auto-discovery was re-enabled and this spec should be rewritten ' +
        'to drive the real launch flow'
    ).toEqual([]);

    // 2. The /launch route still resolves and renders its shell.
    await page.goto(`${Services.Blueprint.UI}/launch`, { waitUntil: 'domcontentloaded' });
    await expect(page).toHaveURL(/\/launch/, { timeout: 15000 });
    await expect(page.locator('app-topbar').first()).toBeVisible({ timeout: 15000 });

    // 3. And it therefore offers no launch card and no Start button. The real button carries
    //    title="Start {{ msel.name }}" (launch.component.html), so this is an exact locator
    //    rather than the old text-substring guess.
    await expect(
      page.locator('.card-container mat-card'),
      'no launch card can render while discovery is disabled'
    ).toHaveCount(0);
    await expect(
      page.getByRole('button', { name: /^Start / }),
      'no Start button can render without a launch card'
    ).toHaveCount(0);

    // 4. The seeded Approved MSEL is genuinely absent from the launch surface.
    await expect(page.getByText(mselName, { exact: true })).toHaveCount(0);
  });
});
