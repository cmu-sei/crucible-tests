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
  getScenarioEvent,
  listMselDataFields,
  assertJoinedMselGroup,
  tempBlueprintName,
  navigateToMselSection,
} from '../../test-helpers';

/**
 * Concurrent edits to the same scenario event: what Blueprint actually does.
 *
 * Rewritten, and the assertion is deliberately the opposite of the old one.
 *
 * The previous version asserted `expect(hasConflictUI || hasError).toBeTruthy()` after two
 * windows saved the same event, looking for /conflict/i, /modified by another user/i,
 * /concurrent edit/i, /outdated/i. **Blueprint implements no such feature.** Measured before
 * writing this spec:
 *
 *   - No optimistic-concurrency support exists anywhere in the API: no `IsConcurrencyToken`,
 *     no `RowVersion`/`xmin` mapping, and no 412/Precondition-Failed or conflict-exception
 *     handling in the services.
 *   - Two clients read the same DataValue, then both PUT it — the second from a now-stale
 *     copy. Result: `write 1 -> 200`, `write 2 (stale) -> 200`, final value `"WINDOW-2"`.
 *     Last write wins, silently.
 *
 * So the old assertion could only ever pass by accident — and it did, because
 * `conflictIndicators` included the bare class matches `[class*="error"]` and
 * `[class*="warning"]`, which match ubiquitous Angular Material classes on a normal page.
 * It "verified" conflict handling on an app that has none. (It was also comma-joined `text=`
 * selectors, which Playwright cannot combine, so the text alternatives matched nothing.)
 * Everything was additionally nested in `if (isVisible)` guards over an unowned MSEL, and it
 * ended with a `test.skip()` on the else branch.
 *
 * This spec asserts the real, currently-correct contract:
 *   1. last write wins, and
 *   2. the losing window is not left showing stale data — SignalR pushes the winning value
 *      to it, so the two windows converge.
 *
 * That second part is the genuinely valuable property here, and it is what a user relies on.
 * If Blueprint ever gains real conflict detection, this spec should fail and be rewritten —
 * which is the correct outcome, rather than a spec that passes either way.
 */
test.describe('Real-time Collaboration and SignalR', () => {
  let token: string;
  let mselId: string;
  let eventId: string;

  const ORIGINAL = 'Conflict baseline';

  test.beforeEach(async () => {
    token = await getBlueprintToken();
    const msel = await createMsel(token, {
      name: tempBlueprintName('TestBP-Conflict'),
      description: 'Seeded to verify concurrent-edit convergence.',
    });
    mselId = msel.id;

    const event = await createRenderableScenarioEvent(token, mselId, ORIGINAL, {
      deltaSeconds: 60,
    });
    eventId = event.id;
  });

  test.afterEach(async () => {
    try {
      if (mselId) await deleteMsel(token, mselId);
    } catch (err) {
      console.warn(`Cleanup failed for MSEL ${mselId}: ${err}`);
    }
  });

  test('Collaborative Editing Conflict Resolution', async ({
    blueprintAuthenticatedPage: page,
  }) => {
    // ── Window 1 ────────────────────────────────────────────────────────────────
    await navigateToMselSection(page, mselId, 'Scenario Events');
    await expect(page.getByText(ORIGINAL).first()).toBeVisible({ timeout: 20000 });

    // ── Window 2, on the same MSEL ──────────────────────────────────────────────
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
      await expect(page2.getByText(ORIGINAL).first()).toBeVisible({ timeout: 20000 });

      // Both clients must be in the MSEL's SignalR group before convergence can be asserted.
      // The app's join is fire-and-forget and loses the race under suite load, leaving a
      // client connected but not in the group -- which looks exactly like a lost push. These
      // probes make such a failure name its real cause instead of blaming delivery.
      await assertJoinedMselGroup(page, token, mselId);
      await assertJoinedMselGroup(page2, token, mselId);

      // ── Two writes to the same field, the second from a stale copy ─────────────
      // Capture the DataValue as both windows currently see it, so the second PUT genuinely
      // carries a pre-first-write copy rather than a re-read.
      const full = await getScenarioEvent(token, eventId);
      const fields = await listMselDataFields(token, mselId);
      const descField = fields.find((f: any) => f.name === 'Description');
      expect(descField, 'the seeded MSEL should have a Description DataField').toBeTruthy();

      const staleCopy = (full.dataValues ?? []).find(
        (d: any) => d.dataFieldId === descField.id
      );
      expect(staleCopy, 'the seeded event should have a Description DataValue').toBeTruthy();
      expect(staleCopy.value).toBe(ORIGINAL);

      const firstWrite = `Window 1 wrote ${Date.now()}`;
      await setScenarioEventFieldValue(token, eventId, 'Description', firstWrite);

      // Window 2 saves its stale copy. expect: it is accepted (no conflict detection exists).
      const secondWrite = `Window 2 wrote ${Date.now()}`;
      const apiBase = process.env.BLUEPRINT_API_URL || 'http://localhost:4724';
      const staleResponse = await fetch(`${apiBase}/api/dataValues/${staleCopy.id}`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...staleCopy, value: secondWrite }),
      });
      expect(
        staleResponse.status,
        'Blueprint has no optimistic concurrency, so a stale write is accepted'
      ).toBe(200);

      // expect: last write wins server-side.
      const settled = await getScenarioEvent(token, eventId);
      const settledValue = (settled.dataValues ?? []).find(
        (d: any) => d.dataFieldId === descField.id
      )?.value;
      expect(settledValue).toBe(secondWrite);

      // ── Both windows converge on the winning value, with no reload ─────────────
      // This is the property that actually protects the user: whichever window lost, neither
      // is left displaying stale text.
      for (const [label, target] of [
        ['window 1', page],
        ['window 2', page2],
      ] as const) {
        await expect
          .poll(() => target.getByText(secondWrite).count(), {
            timeout: 30000,
            intervals: [250, 500, 1000],
            message: `${label} never converged on the winning value (no reload was performed)`,
          })
          .toBeGreaterThan(0);

        await expect
          .poll(() => target.getByText(firstWrite).count(), {
            timeout: 15000,
            intervals: [250, 500, 1000],
            message: `${label} still shows the overwritten value`,
          })
          .toBe(0);
      }

      await context2.close();
    } finally {
      await browser.close();
    }
  });
});
