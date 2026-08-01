// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: specs/blueprint-test-plan.md

import { test, expect } from '../../fixtures';
import {
  getBlueprintToken,
  createMsel,
  deleteMsel,
  createScenarioEvent,
  deleteScenarioEvent,
  navigateToMselSection,
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
test.describe('MSEL Playbook', () => {
  let token: string;
  let mselId: string;
  let eventId: string;

  test.beforeEach(async () => {
    token = await getBlueprintToken();
    const msel = await createMsel(token);
    mselId = msel.id;

    // The playbook needs at least one scenario event to have anything to print.
    const event = await createScenarioEvent(token, mselId, {
      description: 'Test scenario event for playbook',
      deltaSeconds: 0,
      moveNumber: 1,
    });
    eventId = event.id;
  });

  test.afterEach(async () => {
    try {
      if (eventId) await deleteScenarioEvent(token, eventId);
    } catch (err) {
      console.warn(`Cleanup failed for event ${eventId}: ${err}`);
    }
    try {
      if (mselId) await deleteMsel(token, mselId);
    } catch (err) {
      console.warn(`Cleanup failed for MSEL ${mselId}: ${err}`);
    }
  });

  test('Print MSEL Playbook', async ({ blueprintAuthenticatedPage: page }) => {
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
