// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: specs/blueprint-test-plan.md

import { test, expect, BLUEPRINT_THEMES, applyBlueprintTheme } from '../../fixtures';
import {
  getBlueprintToken,
  deleteMsel,
  createRenderableScenarioEvent,
  navigateToMselSection,
  createSharedRenderableMsel,
  resetSharedRenderableMsel,
  type CreatedMsel,
  sharedChildName,
} from '../../test-helpers';

/**
 * The MSEL Playbook's two print actions.
 *
 * Both app handlers (`printpage()` and `printAllEvents()` in
 * `msel-playbook.component.ts`) do the same thing: swap `document.body.innerHTML` for the
 * printable area, call `window.print()`, then immediately `location.reload()`.
 *
 * That reload is why the previous version of this spec failed while looking correct: it
 * stubbed `window.print` to set `window.__printCalled = true`, but the reload destroys the
 * JS context before the assertion runs, so the flag always read back false. `window.print`
 * genuinely IS invoked — verified by recording the call somewhere that survives a reload.
 * This is a test bug, not an application defect.
 *
 * The stub records into `sessionStorage`, which persists across the reload within the same
 * tab. It also suppresses the real print dialog, which would otherwise block the run.
 */
// One MSEL with the standard DataFields (13 POSTs) is seeded per file and shared by both
// theme runs. Safe to share: the test only reads the playbook.
// Each test seeds its own uniquely named events, and `resetSharedRenderableMsel` removes
// them (and any extra DataField) in afterEach.
let shared: CreatedMsel;

test.beforeAll(async ({}, workerInfo) => {
  shared = await createSharedRenderableMsel(await getBlueprintToken(), 'PrintPlaybook', workerInfo.parallelIndex);
});

test.afterAll(async () => {
  if (shared) await deleteMsel(await getBlueprintToken(), shared.id);
});

for (const theme of BLUEPRINT_THEMES) {
    test.describe(`${theme} theme › MSEL Playbook`, () => {
    // Per-test names for this test's own records on the shared MSEL.
    let child: (base: string) => string;
    let token: string;
    let mselId: string;
    let eventId: string;

    test.beforeEach(async ({}, testInfo) => {
      child = (base: string) => sharedChildName(base, testInfo, theme);
      token = await getBlueprintToken();
      mselId = shared.id;

      // The playbook needs at least one scenario event to have anything to print.
      // Use the renderable variant: the playbook renders an event's DataValues, and a MSEL
      // created via POST /api/msels has no DataFields, so a bare createScenarioEvent yields a
      // row with nothing in it. (`description`/`moveNumber` are not API fields — see
      // createScenarioEvent's doc comment.)
      const event = await createRenderableScenarioEvent(
        token,
        mselId,
        child('TestBP-PrintPlaybookEvent'),
        { deltaSeconds: 0 }
      );
      eventId = event.id;
    });

    test.afterEach(async () => {
      // Back to "standard DataFields, no events" for the next test on the shared MSEL.
      await resetSharedRenderableMsel(token, mselId);
    });

    test('Print MSEL Playbook', async ({ blueprintAuthenticatedPage: page }) => {
    await applyBlueprintTheme(page, theme);
      // Stub window.print before any app code runs. sessionStorage survives the
      // location.reload() the print handlers trigger; a plain window property would not.
      await page.addInitScript(() => {
        window.print = () => {
          const count = Number(sessionStorage.getItem('__printCount') ?? '0') + 1;
          sessionStorage.setItem('__printCount', String(count));
        };
      });

      await navigateToMselSection(page, mselId, 'MSEL Playbook');

      const printCount = () =>
        page.evaluate(() => Number(sessionStorage.getItem('__printCount') ?? '0'));

      const printCurrentPageButton = page.getByRole('button', { name: 'Print Current Page' });
      const printAllEventsButton = page.getByRole('button', { name: 'Print All Events' });

      await expect(printCurrentPageButton).toBeVisible({ timeout: 15000 });
      await expect(printAllEventsButton).toBeVisible({ timeout: 10000 });

      // Nothing has printed yet.
      expect(await printCount()).toBe(0);

      // --- Print Current Page ---
      await printCurrentPageButton.click();

      // The handler reloads the page; wait for the playbook to come back rather than sleeping,
      // then read the counter that survived it.
      await expect(printCurrentPageButton).toBeVisible({ timeout: 15000 });
      await expect.poll(printCount, { timeout: 15000 }).toBe(1);

      // --- Print All Events ---
      // This handler expands pageSize to every event, prints, then restores and reloads.
      await printAllEventsButton.click();

      await expect(printAllEventsButton).toBeVisible({ timeout: 15000 });
      await expect.poll(printCount, { timeout: 15000 }).toBe(2);
    });
    });
}