// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: specs/blueprint-test-plan.md

import { test, expect, Services } from '../../fixtures';
import { chromium } from '@playwright/test';
import {
  getKeycloakAdminToken,
  createKeycloakUser,
  deleteKeycloakUser,
  tempUsername,
} from '../../../keycloak-admin';
import {
  getBlueprintToken,
  createMsel,
  deleteMsel,
  createUnit,
  deleteUnit,
  addUnitToMsel,
  removeUnitFromMsel,
  addUserToUnit,
  createBlueprintUser,
  deleteBlueprintUser,
  navigateToMsel,
  tempBlueprintName,
} from '../../test-helpers';

/**
 * Verifies the presence bar shows another user who is viewing the same MSEL, and removes
 * them when they leave.
 *
 * Rewritten. The previous version could not fail:
 *
 * 1. Every real check sat inside `if (isPresenceVisible)` / `if
 *    (presenceVisibleAfterSecondUser)`. On this stack the outer condition was always false —
 *    the run log shows it taking the "Presence bar is not currently visible" branch — so the
 *    counts were never asserted.
 * 2. Its only unconditional assertion was
 *    `expect(await page.locator('app-presence-bar').count()).toBeGreaterThanOrEqual(1)`,
 *    i.e. that the component tag exists in the DOM. That is true on any page that renders the
 *    toolbar, whether or not presence works, and it is what let the spec print
 *    "✓ User presence indicator feature verified" while verifying nothing.
 * 3. It then opened a second window as **the same `admin` user**, which cannot produce a
 *    chip — see below.
 * 4. Four fixed sleeps (2s + 3s + 3s) stood in for waiting on propagation.
 *
 * **Why the second window had to be a different user.** `MainHub.GetPresence` filters the
 * cached connections with `c.MselId == mselId && c.UserId != userId`
 * (`MainHub.cs:154-160`), and arrival is broadcast with `Clients.OthersInGroup(mselId)`
 * (line 133). `updatePresence` in `signalr.service.ts` then dedupes by actor id. So a second
 * window signed in as the same account is deliberately excluded from its own presence list:
 * the old spec's "multi-user" step could never add a chip, no matter how long it slept.
 * This version creates a real second Keycloak user and puts it in a **unit** attached to the
 * seeded MSEL. Team membership is *not* enough: `MainHub.GetMselIdList` (MainHub.cs:182-214)
 * builds a non-admin user's group list from `UnitUsers` -> `MselUnits`, plus MSELs they
 * created and templates — it never looks at teams. Seeding a team instead produced exactly
 * zero chips, which is how this was found.
 *
 * Presence renders only `@if (actors.length > 0)` (`presence-bar.component.html:6`), so
 * `.presence-container` appearing at all is itself the signal, and `.presence-name` carries
 * the other user's name.
 */
test.describe('Real-time Collaboration and SignalR', () => {
  let blueprintToken: string;
  let keycloakToken: string;
  let mselId: string;
  let unitId: string | undefined;
  let mselUnitId: string | undefined;
  let secondUserId: string | undefined;
  let secondBlueprintUserId: string | undefined;
  let secondUsername: string;
  let secondDisplayName: string;
  const secondPassword = 'TestPassword123!';

  test.beforeEach(async () => {
    blueprintToken = await getBlueprintToken();
    const msel = await createMsel(blueprintToken, {
      name: tempBlueprintName('TestBP-Presence'),
      description: 'Seeded to verify SignalR presence propagation.',
    });
    mselId = msel.id;

    // A real second identity. Presence excludes your own connections, so the observer and
    // the observed must be different users.
    keycloakToken = await getKeycloakAdminToken();
    secondUsername = tempUsername('bppresence');
    // The presence chip renders the token's `name` claim, which Keycloak composes from
    // firstName + lastName -- NOT the username. Left at the helper's defaults it reads
    // "Test User", which would make the name assertion below indistinguishable between
    // users. Set both explicitly so the chip carries something unique to this run.
    secondDisplayName = `Presence ${secondUsername}`;
    const kcUser = await createKeycloakUser(keycloakToken, {
      username: secondUsername,
      password: secondPassword,
      email: `${secondUsername}@test.local`,
      firstName: 'Presence',
      lastName: secondUsername,
      realmRoles: [],
    });
    secondUserId = kcUser.id;

    // Blueprint keys presence off its own user id, which must match the Keycloak subject.
    const bpUser = await createBlueprintUser(blueprintToken, {
      id: kcUser.id,
      name: secondUsername,
    });
    secondBlueprintUserId = bpUser.id;

    // Unit membership is what puts the second user in this MSEL's SignalR group
    // (MainHub.Join -> GetMselIdList, which reads UnitUsers -> MselUnits).
    const unit = await createUnit(blueprintToken, { name: tempBlueprintName('TestBP-PresenceUnit') });
    unitId = unit.id;
    await addUserToUnit(blueprintToken, unit.id, kcUser.id);
    const mselUnit = await addUnitToMsel(blueprintToken, mselId, unit.id);
    mselUnitId = mselUnit.id;
  });

  test.afterEach(async () => {
    try {
      if (mselUnitId) await removeUnitFromMsel(blueprintToken, mselUnitId);
    } catch (err) {
      console.warn(`Cleanup failed for MselUnit ${mselUnitId}: ${err}`);
    }
    try {
      if (unitId) await deleteUnit(blueprintToken, unitId);
    } catch (err) {
      console.warn(`Cleanup failed for unit ${unitId}: ${err}`);
    }
    try {
      if (secondBlueprintUserId) await deleteBlueprintUser(blueprintToken, secondBlueprintUserId);
    } catch (err) {
      console.warn(`Cleanup failed for Blueprint user ${secondBlueprintUserId}: ${err}`);
    }
    try {
      if (secondUserId) await deleteKeycloakUser(keycloakToken, secondUserId);
    } catch (err) {
      console.warn(`Cleanup failed for Keycloak user ${secondUserId}: ${err}`);
    }
    try {
      if (mselId) await deleteMsel(blueprintToken, mselId);
    } catch (err) {
      console.warn(`Cleanup failed for MSEL ${mselId}: ${err}`);
    }
  });

  test('User Presence Indicators', async ({ blueprintAuthenticatedPage: page }) => {
    // ── Window 1: admin, on the seeded MSEL ─────────────────────────────────────
    await navigateToMsel(page, mselId);

    const presenceContainer = page.locator('.presence-container');
    const presenceChips = page.locator('.presence-chip');

    // expect: no one else is here yet, so the bar does not render at all
    // (`@if (actors.length > 0)`).
    await expect(presenceChips).toHaveCount(0, { timeout: 15000 });

    // ── Window 2: the second user, on the same MSEL ─────────────────────────────
    const browser = await chromium.launch();
    try {
      const context2 = await browser.newContext({ ignoreHTTPSErrors: true });
      const page2 = await context2.newPage();

      // Sign in as the second user. Two Keycloak behaviours have to be worked around:
      //   - A plain visit to Blueprint reuses the realm's existing SSO session and lands
      //     straight in as *admin*, with no login form.
      //   - Adding `prompt=login` does re-prompt, but Keycloak pins the form to the already
      //     identified account: it renders "admin / Please re-authenticate to continue" with a
      //     password field only, and no username field (measured).
      // Clearing the realm cookies for this context drops that session, so the next
      // authorization request renders the full username+password form.
      await page2.goto(Services.Blueprint.UI, { waitUntil: 'domcontentloaded' });
      await context2.clearCookies();
      await page2.goto(Services.Blueprint.UI, { waitUntil: 'domcontentloaded' });

      const usernameField = page2.getByRole('textbox', { name: /username/i });
      await expect(usernameField).toBeVisible({ timeout: 30000 });
      await usernameField.fill(secondUsername);
      await page2.getByRole('textbox', { name: /password/i }).fill(secondPassword);
      await page2.getByRole('button', { name: /sign in/i }).click();

      await expect(page2.locator('app-root mat-toolbar').first()).toBeVisible({ timeout: 30000 });
      await navigateToMsel(page2, mselId);

      // expect: window 1 learns about the second user with no reload. `expect.poll` re-reads
      // the live DOM; window 1 is never refreshed, so only a pushed PresenceArrived (or the
      // greet-back) can satisfy this.
      await expect
        .poll(() => presenceChips.count(), {
          timeout: 30000,
          intervals: [250, 500, 1000],
          message: 'window 1 never received PresenceArrived for the second user',
        })
        .toBeGreaterThan(0);

      await expect(presenceContainer).toBeVisible();

      // expect: the chip names the *other* user, not the viewer. The name comes from the
      // token's `name` claim (firstName + lastName), seeded uniquely above.
      await expect(page.locator('.presence-chip .presence-name').first()).toHaveText(
        new RegExp(secondDisplayName, 'i'),
        { timeout: 15000 }
      );
      await expect(page.locator('.presence-chip .presence-name')).not.toHaveText(/Admin User/i);

      // ── The second user leaves ────────────────────────────────────────────────
      await context2.close();

      // expect: window 1 drops them again, via PresenceDeparted on disconnect
      // (MainHub.OnDisconnectedAsync).
      await expect
        .poll(() => presenceChips.count(), {
          timeout: 30000,
          intervals: [250, 500, 1000],
          message: 'window 1 never received PresenceDeparted after the second user closed',
        })
        .toBe(0);
    } finally {
      await browser.close();
    }
  });
});
