// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: specs/blueprint-test-plan.md

import { test, expect } from '../../fixtures';
import { chromium, type Page } from '@playwright/test';
import {
  getBlueprintToken,
  createMsel,
  deleteMsel,
  createUnit,
  deleteUnit,
  addUnitToMsel,
  removeUnitFromMsel,
  addUserToUnit,
  navigateToMsel,
  signInToBlueprintAs,
  tempBlueprintName,
} from '../../test-helpers';

/**
 * A user with the same MSEL open in two tabs counts once, and is still listed while either tab is open.
 *
 * Each tab is its own SignalR connection. Presence used to be kept per connection, so closing one of two
 * tabs announced the user's departure while the other tab was still open, and everyone else saw them
 * disappear. The observer (admin, window 1) must keep seeing the second user until their last tab closes.
 */
/** The JSON messages in one SignalR frame, which separates them with U+001E. */
function hubMessages(payload: string | Buffer): any[] {
  return String(payload)
    .split('\u001e')
    .filter(Boolean)
    .map((message) => {
      try {
        return JSON.parse(message);
      } catch {
        return {};
      }
    });
}

/**
 * Resolves once the hub has answered this page's selectMsel, which is when the server has put the page's connection
 * on the MSEL. Register it before the page navigates; it rejects if the hub never answers.
 */
function selectMselAnswered(page: Page, timeoutMs = 30000): Promise<void> {
  const answered = new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('the hub never answered selectMsel')), timeoutMs);
    page.on('websocket', (ws) => {
      if (!ws.url().includes('/hubs/main')) return;
      const pending = new Set<string>();
      ws.on('framesent', (frame) => {
        for (const message of hubMessages(frame.payload)) {
          if (message.target === 'selectMsel' && message.invocationId) pending.add(message.invocationId);
        }
      });
      ws.on('framereceived', (frame) => {
        for (const message of hubMessages(frame.payload)) {
          if (message.type === 3 && pending.has(message.invocationId)) {
            clearTimeout(timer);
            resolve();
          }
        }
      });
    });
  });
  // Nobody awaits it yet when it can reject; the await that follows still sees the rejection.
  answered.catch(() => undefined);
  return answered;
}

test.describe('Real-time Collaboration and SignalR › presence with two tabs', () => {
  let blueprintToken: string;
  let mselId: string;
  let unitId: string | undefined;
  let mselUnitId: string | undefined;

  test.beforeEach(async ({ nonAdminUser }) => {
    blueprintToken = await getBlueprintToken();
    const msel = await createMsel(blueprintToken, {
      name: tempBlueprintName('TestBP-PresenceTabs'),
      description: 'Seeded to verify presence with two tabs of one user.',
    });
    mselId = msel.id;
    const unit = await createUnit(blueprintToken, {
      name: tempBlueprintName('TestBP-PresenceTabsUnit'),
    });
    unitId = unit.id;
    await addUserToUnit(blueprintToken, unit.id, nonAdminUser.userId);
    mselUnitId = (await addUnitToMsel(blueprintToken, mselId, unit.id)).id;
  });

  test.afterEach(async () => {
    for (const cleanup of [
      async () => mselUnitId && removeUnitFromMsel(blueprintToken, mselUnitId),
      async () => unitId && deleteUnit(blueprintToken, unitId),
      async () => mselId && deleteMsel(blueprintToken, mselId),
    ]) {
      try {
        await cleanup();
      } catch (err) {
        console.warn(`Cleanup failed: ${err}`);
      }
    }
    mselUnitId = unitId = undefined;
  });

  test('closing one of two tabs keeps the user listed until the last one closes', async ({
    blueprintAuthenticatedPage: page,
    nonAdminUser,
  }) => {
    const observerSelected = selectMselAnswered(page);
    await navigateToMsel(page, mselId);
    await observerSelected;
    const chips = page.locator('.presence-chip');
    await expect(chips).toHaveCount(0, { timeout: 15000 });

    const browser = await chromium.launch();
    try {
      // One context, so one Keycloak login; two pages in it are two tabs of the same user.
      const context = await browser.newContext({
        ignoreHTTPSErrors: true,
        storageState: { cookies: [], origins: [] },
      });
      const firstTab = await context.newPage();
      await signInToBlueprintAs(firstTab, nonAdminUser.username, nonAdminUser.password);
      await expect(firstTab.locator('app-root mat-toolbar').first()).toBeVisible({ timeout: 30000 });
      const firstSelected = selectMselAnswered(firstTab);
      await navigateToMsel(firstTab, mselId);
      await firstSelected;

      const secondTab = await context.newPage();
      // The tab only counts once the hub has put its own connection on the MSEL, not when the page has loaded.
      const secondSelected = selectMselAnswered(secondTab);
      await navigateToMsel(secondTab, mselId);
      await secondSelected;

      // The user shows once, however many tabs they have open.
      await expect(chips).toHaveCount(1, { timeout: 30000 });
      await expect(page.locator('.presence-chip .presence-name')).toHaveText(
        new RegExp(`${nonAdminUser.displayName}(?!\\d)`, 'i'),
      );

      // Closing one tab must not make them disappear: they are still on the MSEL in the other.
      await secondTab.close();
      // allow-wait-antipattern: Blueprint tells the observer nothing when one of a user's two tabs closes and the user stays listed, so there is no completion signal to wait on
      await page.waitForTimeout(1000);
      await expect(chips, 'the user vanished when one of their two tabs closed').toHaveCount(1);

      // Closing the last tab does.
      await firstTab.close();
      await expect(chips).toHaveCount(0, { timeout: 30000 });
      await context.close();
    } finally {
      await browser.close();
    }
  });
});
