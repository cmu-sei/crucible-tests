// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: specs/blueprint-test-plan.md
// seed: tests/seed.spec.ts
//
// Test: Launch Loading State (plan item 8.2)
//
// Rewritten. The previous version self-skipped twice with bare `test.skip()` when no launch
// card was present, and its remaining assertions sat inside `if (loadingVisible) { ... } else
// { still on the app }` — both branches passed, so it could not fail either way.
//
// The launch card list is empty by design: `MselService.GetMyLaunchInvitationMselsAsync`
// (MselService.cs:2203) returns `new List<ViewModels.Msel>()` unconditionally, with the
// comment "DISABLED: Auto-discovery based on email domain matching / Users must now use
// invitation links directly to launch MSELs". Verified live — `GET /api/my-launch-msels`
// answers `[]` (200). So no launch can be *initiated* from this page, which is why the
// loading state was never reachable. See launch-new-event.spec.ts for the same finding.
//
// What remains genuinely verifiable is the loading card's own contract. It is not gated on
// discovery — launch.component.html renders it purely on `!showChoices`:
//
//   @if (!showChoices) { <mat-card> "Launching your event!" ...
//     "Please wait until you are redirected to the event." <mat-progress-spinner> ...
//
// `showChoices` starts true, so this spec drives that one flag and asserts the three things
// the plan item actually names (title, wait message, spinner) really render together. That
// tests the component's loading contract without pretending a launch occurred.

import { test, expect, Services } from '../../fixtures';

test.describe('Launch and Join Event Workflows', () => {
  test('Launch Loading State', async ({ blueprintAuthenticatedPage: page }) => {
    await page.goto(`${Services.Blueprint.UI}/launch`, { waitUntil: 'domcontentloaded' });
    await expect(page).toHaveURL(/\/launch/, { timeout: 15000 });

    const cardContainer = page.locator('.card-container');
    await expect(cardContainer).toBeVisible({ timeout: 15000 });

    // Precondition: in its initial state the page is showing choices, so the loading card is
    // NOT displayed. Asserted rather than assumed — if it were already visible the checks
    // below would prove nothing about the transition.
    const loadingCard = cardContainer.locator('mat-card').filter({ hasText: 'Launching your event!' });
    await expect(loadingCard).toHaveCount(0);

    // Flip the component into its launching state the same way `launch(...)` does, by
    // clearing `showChoices`. Reaching into the Angular component is deliberate: a real
    // launch cannot be started here (see the header), and the alternative was a spec that
    // asserted nothing.
    const flipped = await page.evaluate(() => {
      const host = document.querySelector('app-launch') as any;
      if (!host) return { ok: false, reason: 'app-launch host element not found' };
      const ctx = window.ng?.getComponent?.(host);
      if (!ctx) return { ok: false, reason: 'Angular debug context unavailable' };
      ctx.showChoices = false;
      ctx.launchStatus = 'Launching';
      window.ng.applyChanges(ctx);
      return { ok: true };
    });
    expect(flipped.ok, `could not drive the launch component: ${flipped.reason ?? ''}`).toBe(true);

    // expect: full-page loading card appears, with its title, wait message and spinner.
    await expect(loadingCard).toBeVisible({ timeout: 10000 });
    await expect(loadingCard).toContainText('Launching your event!');
    await expect(loadingCard).toContainText(/Please wait until you are redirected to the event/i);
    await expect(loadingCard.locator('mat-progress-spinner')).toBeVisible({ timeout: 10000 });

    // expect: the launch status label is surfaced to the user during the wait.
    await expect(loadingCard.locator('.status-message')).toHaveText('Launching');

    // expect: while launching, the choice cards are gone — no second launch can be started.
    await expect(page.getByRole('button', { name: /^Start / })).toHaveCount(0);
  });
});
