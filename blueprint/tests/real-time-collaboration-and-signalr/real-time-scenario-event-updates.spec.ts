// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: specs/blueprint-test-plan.md

import { test, expect } from '../../fixtures';
import { chromium } from '@playwright/test';
import fs from 'fs';
import { authStatePath, authSessionStatePath } from '../../../auth-paths';
import {
  getBlueprintToken,
  createMsel,
  deleteMsel,
  createRenderableScenarioEvent,
  setScenarioEventFieldValue,
  tempBlueprintName,
  navigateToMselSection,
} from '../../test-helpers';

/**
 * Verifies SignalR pushes an *edit* of an existing scenario event to a second window with
 * no refresh. (`real-time-msel-updates` covers the create case; this one covers update.)
 *
 * Rewritten. The previous version could not fail, and mostly did not run:
 *
 * 1. Its entire body was inside `if (await existingEvent.isVisible(...))`, keyed on
 *    `[class*="event"], [class*="scenario"]` against whatever MSEL happened to be first on
 *    the dashboard. It seeded nothing, so on a stack without a suitable pre-existing MSEL it
 *    asserted nothing and reported green.
 * 2. Its verdict was `expect(textUpdated || textChanged).toBeTruthy()` — an OR over two soft
 *    probes, one of which (`textChanged`) compares the first matched element's text before
 *    and after and so is satisfied by *any* unrelated re-render.
 * 3. It navigated by clicking `a[href*="/msel"], div[class*="msel"]`, then edited "an
 *    existing event" belonging to a MSEL it did not own — mutating another test's or the
 *    user's data.
 * 4. Three fixed sleeps (1s, 2s, 3s) stood in for waiting on the actual propagation, which
 *    CLAUDE.md forbids: they slow the suite and make the outcome a coin flip.
 *
 * Now: seed a MSEL with one renderable event, open it in two independently-authenticated
 * contexts, change the event's Title through the API (the same write path the UI uses, and
 * the one that raises the SignalR notification), and poll window 2 for the new text.
 * Window 2 is never reloaded, so only a pushed update can satisfy the assertion.
 */
test.describe('Real-time Collaboration and SignalR', () => {
  let token: string;
  let mselId: string;
  let eventId: string;

  const ORIGINAL_TITLE = 'Realtime edit baseline';

  test.beforeEach(async () => {
    token = await getBlueprintToken();
    const msel = await createMsel(token, {
      name: tempBlueprintName('TestBP-RealtimeEdit'),
      description: 'Seeded to verify SignalR scenario-event edit propagation.',
    });
    mselId = msel.id;

    const event = await createRenderableScenarioEvent(token, mselId, ORIGINAL_TITLE, {
      deltaSeconds: 60,
    });
    eventId = event.id;
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

  test('Real-time Scenario Event Updates', async ({ blueprintAuthenticatedPage: page }) => {
    // ── Window 1: the seeded MSEL's Scenario Events ─────────────────────────────
    await navigateToMselSection(page, mselId, 'Scenario Events');

    // The seeded title must be on screen before the edit, otherwise "the new title appeared"
    // proves nothing about propagation.
    await expect(page.getByText(ORIGINAL_TITLE).first()).toBeVisible({ timeout: 20000 });

    // ── Window 2: a separate context on the same MSEL ───────────────────────────
    // Reuses the storageState global-setup captured, so this costs no extra Keycloak
    // round-trip. sessionStorage is restored too, since the OIDC client may keep its token
    // there rather than in localStorage.
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

      // Both windows start from the same state.
      await expect(page2.getByText(ORIGINAL_TITLE).first()).toBeVisible({ timeout: 20000 });

      // ── Edit the event ─────────────────────────────────────────────────────────
      // `createRenderableScenarioEvent` writes its text into the 'Description' DataField, so
      // that is the field to change — a ScenarioEvent has no `description` column of its own,
      // its text lives in DataValue rows.
      const updatedTitle = `Realtime edited ${Date.now()}`;
      await setScenarioEventFieldValue(token, eventId, 'Description', updatedTitle);

      // ── Window 2 must receive it with NO reload ────────────────────────────────
      // expect.poll re-reads the live DOM; window 2 is never refreshed, so the only way the
      // new title can appear is a server-pushed update.
      await expect
        .poll(() => page2.getByText(updatedTitle).count(), {
          timeout: 30000,
          intervals: [250, 500, 1000],
          message:
            'window 2 never received the scenario-event edit via SignalR (no reload was performed)',
        })
        .toBeGreaterThan(0);

      // expect: it is genuinely an update, not an extra row — the old title is gone.
      await expect
        .poll(() => page2.getByText(ORIGINAL_TITLE).count(), {
          timeout: 15000,
          intervals: [250, 500, 1000],
          message: 'the pre-edit title should be replaced, not duplicated',
        })
        .toBe(0);

      await context2.close();
    } finally {
      await browser.close();
    }
  });
});
