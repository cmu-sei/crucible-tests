// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: specs/blueprint-test-plan.md
// seed: tests/seed.spec.ts
//
// Test: Manage Deployed Event (plan item 8.4)
//
// Rewritten. The previous version had four separate ways of not testing anything:
//
//   1. `page.locator('table tbody tr:has-text("Deployed"), ...')` never matched: the /build
//      list is a `mat-table` (mat-row / mat-cell), not `table tbody tr`. On the miss it ran
//      a bare `test.skip(); return;` and reported green.
//   2. It depended on some pre-existing Deployed MSEL rather than seeding one — forbidden by
//      CLAUDE.md, and the reason the skip always fired.
//   3. It clicked the row's `<a>`, which the repo has already established is a zero-size
//      anchor that never becomes visible, on a list that paginates.
//   4. `page.locator('text=Complete, text=Archived, ...')` matched zero elements (`text=`
//      cannot be comma-combined), and the verdict was
//      `expect(statusChanged || notifVisible).toBe(true)` — an OR over two soft probes that
//      passes if EITHER happens, including for the wrong reason.
//
// Verified live against this stack, browser-driven:
//
//   * A MSEL can be created directly as Deployed (`createMsel(token, {status:'Deployed'})`),
//     and its /build row is findable with `findMselRowByName` — the search box is a reactive
//     `[formControl]`, so `fill()` collapses the paginated list onto the row.
//   * The End Event flow does NOT live on /build. `msel-list` has no End Event control at
//     all; only `/manage?msel=<id>` renders one (manage.component.html gates the End Date /
//     Time input and the End Event button on `msel.status === 'Deployed'`). The plan item's
//     step-1 wording conflates the two surfaces, so this spec asserts the /build list shows
//     the Deployed MSEL, then drives End Event where it exists.
//   * End Event opens a `CrucibleDialogService.confirm` dialog titled "End the Event" with
//     No/Yes buttons, and Yes issues `DELETE /api/msels/{id}/archive`.
//   * The resulting status is **Archived**, not Complete. `MselService.ArchiveAsync` sets
//     `MselItemStatus.Archived` explicitly and queues a pull with `FinalStatus = Archived`.
//     Confirmed against the API after the click. The plan item's "Complete or Archived" is
//     asserted here as exactly Archived so a change of behaviour fails the test.
//   * There is NO success notification. Polled for `mat-snack-bar-container`,
//     `simple-snack-bar`, `.mat-mdc-snack-bar-container`, `[role="alert"]` and
//     `mat-bottom-sheet-container` every 500ms for 3s after the archive response: zero.
//     `mselDataService.archive()` has no success notification path. The plan item's
//     "Success notification is displayed" is therefore not implemented; the real
//     user-visible confirmation is that /manage redirects away (the component bounces to
//     `post_logout_redirect_uri` as soon as status stops being Deployed), which IS asserted.

import { test, expect, Services } from '../../fixtures';
import {
  getBlueprintToken,
  createMsel,
  getMsel,
  deleteMsel,
  findMselRowByName,
  tempBlueprintName,
} from '../../test-helpers';

test.describe('Launch and Join Event Workflows', () => {
  let token: string;
  let mselId: string;
  let mselName: string;

  test.beforeEach(async () => {
    token = await getBlueprintToken();
    mselName = tempBlueprintName('TestBP-ManageDeployed');
    const msel = await createMsel(token, {
      name: mselName,
      description: 'Seeded Deployed MSEL for the End Event flow.',
      status: 'Deployed',
    });
    mselId = msel.id;

    // Precondition, asserted: the MSEL really persisted as Deployed. Everything below —
    // the list's status cell, the End Date field, the End Event button — is gated on it, so
    // a silent status coercion must fail here rather than mid-test.
    expect(msel.status, 'seeded MSEL must be Deployed').toBe('Deployed');
  });

  test.afterEach(async () => {
    // Runs even when the body throws, and after a successful archive too: DELETE on an
    // Archived MSEL answers 204 (verified), and `deleteMsel` swallows the 404 if the test
    // failed before creating anything.
    if (mselId) await deleteMsel(token, mselId);
  });

  test('Manage Deployed Event', async ({ blueprintAuthenticatedPage: page }) => {
    // ── 1. Build page: the Deployed MSEL is listed, and shown as Deployed ──────────────
    await page.goto(`${Services.Blueprint.UI}/build`, { waitUntil: 'domcontentloaded' });

    const row = await findMselRowByName(page, mselName);
    await expect(row).toHaveCount(1);
    await expect(row.locator('.mat-column-status')).toHaveText('Deployed');

    // ── 2. Manage page: the deployed-event controls the plan item names ────────────────
    //
    // Reached by id rather than by clicking the row: the /build name cell is an empty,
    // zero-size anchor that never becomes visible, and it routes to /build anyway — the
    // End Event control only exists under /manage.
    await page.goto(`${Services.Blueprint.UI}/manage?msel=${mselId}`, {
      waitUntil: 'domcontentloaded',
    });

    // expect: MSEL details are shown ...
    await expect(page.getByText(mselName, { exact: true })).toBeVisible({ timeout: 30000 });

    // ... with an End Date/Time field ...
    const endDateInput = page.locator('input[placeholder="End Date / Time"]');
    await expect(endDateInput).toBeVisible();
    // It is populated from startTime + durationSeconds, so it must not be blank.
    await expect(endDateInput).not.toHaveValue('');

    // ... and an 'End Event' button.
    const endEventButton = page.getByRole('button', { name: 'End Event' });
    await expect(endEventButton).toBeVisible();
    await expect(endEventButton).toBeEnabled();

    // ── 3. Click 'End Event' and confirm ──────────────────────────────────────────────
    await endEventButton.click();

    const confirmDialog = page.locator('mat-dialog-container, .mat-mdc-dialog-container').first();
    await expect(confirmDialog).toBeVisible({ timeout: 15000 });
    await expect(confirmDialog).toContainText('End the Event');
    await expect(confirmDialog).toContainText('Are you sure that you want to end this event?');

    // The confirm control is the dialog's 'Yes' (CrucibleDialogService defaults are
    // Yes/No), not a text-substring guess like the old `.last()` of a mixed selector list.
    const confirmButton = confirmDialog.getByRole('button', { name: 'Yes' });
    await expect(confirmButton).toBeVisible();

    const [archiveResponse] = await Promise.all([
      page.waitForResponse(
        (r) =>
          r.url().includes(`/api/msels/${mselId}/archive`) &&
          r.request().method() === 'DELETE',
        { timeout: 60000 }
      ),
      confirmButton.click(),
    ]);
    expect(archiveResponse.status(), await archiveResponse.text().catch(() => '')).toBe(200);

    // expect: Event status changes from 'Deployed' to Archived.
    //
    // Deterministic and server-side: the API is the system of record, and the /manage page
    // navigates away on success so there is no status text left on screen to read. Asserted
    // as exactly 'Archived' — the value `MselService.ArchiveAsync` sets — not "Complete or
    // Archived", so a behaviour change is caught rather than absorbed.
    await expect
      .poll(async () => (await getMsel(token, mselId)).status, {
        message: 'MSEL status must become Archived after End Event',
        timeout: 30000,
      })
      .toBe('Archived');

    // Archiving also pulls the integrations, clearing the Player view linkage.
    expect((await getMsel(token, mselId)).playerViewId).toBeNull();

    // expect: the user is told the event ended. There is no success snackbar (see header),
    // so the real, asserted confirmation is that /manage stops offering management controls
    // and bounces the user back to the dashboard, which the component does as soon as the
    // status stops being Deployed.
    await expect(page).toHaveURL(
      new RegExp(`^${Services.Blueprint.UI.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}/?$`),
      { timeout: 30000 }
    );
    await expect(page.getByRole('button', { name: 'End Event' })).toHaveCount(0);
  });
});
