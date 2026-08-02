// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: specs/blueprint-test-plan.md

import { test, expect, Services } from '../../fixtures';
import { chromium } from '@playwright/test';
import fs from 'fs';
import { authStatePath, authSessionStatePath } from '../../../auth-paths';
import {
  getBlueprintToken,
  createMsel,
  deleteMsel,
  createRenderableScenarioEvent,
  assertJoinedMselGroup,
  tempBlueprintName,
  navigateToMselSection,
} from '../../test-helpers';

/**
 * Verifies SignalR pushes a new scenario event to a second window with no refresh.
 *
 * Rewritten. The previous version failed on three separate defects:
 *
 * 1. It clicked a link named "Project Lagoon TTX - Admin User". No such MSEL exists on
 *    this stack, so `locator.click` timed out after 10s — the spec never reached its
 *    SignalR assertion at all.
 * 2. Its second context loaded `storageState` from `.auth/user.json`, a path that does
 *    not exist. The real per-app files are `.auth/blueprint.json` (+ `-session.json`),
 *    written by global-setup and addressed via `auth-paths.ts`.
 * 3. It waited with `waitForTimeout(5000)` and then compared counts once. A fixed sleep
 *    both slows the suite and makes the result a coin flip; CLAUDE.md forbids it.
 *
 * The real-time behaviour itself is sound — verified live, the new row reached window 2
 * in ~1s without a reload. So this is a test defect, not an app bug.
 *
 * Now: seed a MSEL, open it in two independently-authenticated contexts, create an event
 * through window 1's UI (paired with its POST), and poll window 2 with `expect.poll`.
 * Window 2 is never reloaded, so only a pushed update can satisfy the assertion.
 */
test.describe('Real-time Collaboration and SignalR', () => {
  let token: string;
  let mselId: string;

  test.beforeEach(async () => {
    token = await getBlueprintToken();
    const msel = await createMsel(token, {
      name: tempBlueprintName('TestBP-Realtime'),
      description: 'Seeded to verify SignalR scenario-event propagation.',
    });
    mselId = msel.id;

    // One baseline event, so the grid is rendered and its DataFields exist before the
    // window-1 UI creates the second one.
    await createRenderableScenarioEvent(token, mselId, 'Baseline event', { deltaSeconds: 60 });
  });

  test.afterEach(async () => {
    if (mselId) {
      try {
        await deleteMsel(token, mselId);
      } catch (err) {
        console.warn(`Cleanup failed for MSEL ${mselId}: ${err}`);
      }
    }
  });

  test('Real-time MSEL Updates', async ({ blueprintAuthenticatedPage: page }) => {
    // ── Window 1: the seeded MSEL's Scenario Events ─────────────────────────────
    await navigateToMselSection(page, mselId, 'Scenario Events');

    const rows1 = page.locator('table tbody tr');
    await expect(rows1).toHaveCount(1, { timeout: 20000 });

    // ── Window 2: a separate context on the same MSEL ───────────────────────────
    // Reuses the storageState global-setup captured, so this costs no extra Keycloak
    // round-trip. sessionStorage is restored too, since the OIDC client may keep its
    // token there rather than in localStorage.
    const statePath = authStatePath('blueprint');
    expect(
      fs.existsSync(statePath),
      `expected global-setup to have written ${statePath}`
    ).toBe(true);

    const sessionPath = authSessionStatePath('blueprint');
    const sessionState: Array<[string, string]> = fs.existsSync(sessionPath)
      ? JSON.parse(fs.readFileSync(sessionPath, 'utf8'))
      : [];

    const browser = await chromium.launch();
    try {
      const context2 = await browser.newContext({
        ignoreHTTPSErrors: true,
        storageState: statePath,
      });
      if (sessionState.length > 0) {
        await context2.addInitScript((entries: Array<[string, string]>) => {
          for (const [key, value] of entries) {
            sessionStorage.setItem(key, value);
          }
        }, sessionState);
      }
      const page2 = await context2.newPage();

      await navigateToMselSection(page2, mselId, 'Scenario Events');

      // Both windows show the same MSEL, at the same starting count.
      const rows2 = page2.locator('table tbody tr');
      await expect(rows2).toHaveCount(1, { timeout: 20000 });

      // Both clients must actually be in the MSEL's SignalR group before propagation can be
      // asserted. Under suite load the app's fire-and-forget join loses the race and a client
      // ends up connected but never added to the group (BP-18) -- which is indistinguishable
      // from a dropped push unless it is checked explicitly. These probes make the failure name
      // its real cause.
      await assertJoinedMselGroup(page, token, mselId);
      await assertJoinedMselGroup(page2, token, mselId);

      // The probes each add and remove an event, so both grids are back to the baseline count.
      await expect(rows1).toHaveCount(1, { timeout: 20000 });
      await expect(rows2).toHaveCount(1, { timeout: 20000 });

      // ── Create an event in window 1 through the UI ─────────────────────────────
      // Scope to the header Action List — the per-row button is titled
      // "Event N Action List" and its menu has no "Add New Event".
      await page.locator('button[title="Action List"]').click();
      await page.getByRole('menuitem', { name: /Add New Event/i }).click();

      const dialog = page.locator('[role="dialog"]').first();
      await expect(dialog).toBeVisible({ timeout: 15000 });

      // Pair the save with the POST it triggers, so the wait ends on the real event.
      // Note the endpoint is lowercase `/api/scenarioevents` — match case-insensitively.
      const createResponse = page.waitForResponse(
        (r) => /\/api\/scenarioevents/i.test(r.url()) && r.request().method() === 'POST',
        { timeout: 30000 }
      );
      await page.getByRole('button', { name: /^\s*Save\s*$/ }).last().click();
      expect((await createResponse).ok()).toBe(true);

      // Window 1 reflects its own change.
      await expect(rows1).toHaveCount(2, { timeout: 20000 });

      // ── Window 2 must receive it with NO reload ────────────────────────────────
      // expect.poll re-reads the live count; window 2 is never refreshed, so the only
      // way this passes is a server-pushed update.
      await expect
        .poll(() => rows2.count(), {
          timeout: 30000,
          intervals: [250, 500, 1000],
          message:
            'window 2 never received the new scenario event via SignalR (no reload was performed)',
        })
        .toBe(2);

      await context2.close();
    } finally {
      await browser.close();
    }
  });
});
