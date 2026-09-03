// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: specs/blueprint-test-plan.md

import { test, expect } from '../../fixtures';
import {
  getBlueprintToken,
  createMsel,
  deleteMsel,
  navigateToMselSection,
  tempBlueprintName,
} from '../../test-helpers';

/**
 * Dialog focus management: initial focus, focus trapping, and focus restore on close.
 *
 * Rewritten. The previous version searched the dashboard for any of six speculative
 * trigger selectors (`button:has-text("Create")`, `"Add"`, `"New"`, `"Edit"`, ...), and on
 * a miss ran a bare `test.skip()` — so it reported green while asserting nothing. It also
 * depended on whatever the dashboard happened to render, i.e. on database shape.
 *
 * This version seeds its own MSEL and drives a known dialog (MSEL → Teams → Add a team →
 * New Team), so the trigger always exists.
 *
 * Two behaviours were established by direct measurement before being asserted here, because
 * the naive version of each assertion fails for the wrong reason:
 *
 * 1. **The dialog is opened from a `mat-menu`, and that menu's overlay outlives the dialog's
 *    appearance.** Measured immediately after the dialog became visible:
 *    `.cdk-overlay-pane` count 2, `.mat-mdc-menu-panel` count 1, and `document.activeElement`
 *    was the *menu trigger button* — outside the dialog. Tabbing then walked background
 *    content (table sort headers "Short Name" / "Name" / "Email", then the menu's own items).
 *    Once the menu panel detaches, focus is on `mat-dialog-container` and stays inside it.
 *    So this spec waits for the menu overlay to detach before measuring focus. Asserting
 *    without that wait would report a focus-trap bug that does not exist.
 *
 * 2. **Escape deliberately does NOT close this dialog.** `team-edit-dialog.component.html:10`
 *    sets `[guardUnsavedWork]="true"`, and `crucible-dialog` in `@cmusei/crucible-common`
 *    sets `dialogRef.disableClose = true` then re-enables Escape only
 *    `if (event.key === 'Escape' && !this.guardUnsavedWork() && !this.loading())`. Escape is
 *    therefore suppressed by design so in-progress work is not lost, and Cancel is the
 *    documented way out. Confirmed live: the dialog was still visible after Escape, and
 *    closed on Cancel. The previous spec asserted `expect(dialogStillVisible).toBe(false)`
 *    after Escape, which contradicts the intended behaviour.
 */
test.describe('Accessibility and Usability', () => {
  let token: string;
  let mselId: string;

  test.beforeEach(async () => {
    token = await getBlueprintToken();
    const msel = await createMsel(token, { name: tempBlueprintName('TestBP-DialogFocus') });
    mselId = msel.id;
  });

  test.afterEach(async () => {
    try {
      if (mselId) await deleteMsel(token, mselId);
    } catch (err) {
      console.warn(`Cleanup failed for MSEL ${mselId}: ${err}`);
    }
  });

  test('Focus Management in Dialogs', async ({ blueprintAuthenticatedPage: page }) => {
    await navigateToMselSection(page, mselId, 'Teams');
    await expect(page.locator('table').first()).toBeVisible({ timeout: 15000 });

    // 1. Open the dialog through its real trigger.
    const addTeamButton = page.getByRole('button', { name: 'Add a team' });
    await expect(addTeamButton).toBeVisible({ timeout: 10000 });
    await addTeamButton.click();

    const newTeamMenuItem = page.getByRole('menuitem', { name: 'New Team' });
    await expect(newTeamMenuItem).toBeVisible({ timeout: 10000 });
    await newTeamMenuItem.click();

    const dialog = page.locator('mat-dialog-container').first();
    await expect(dialog).toBeVisible({ timeout: 10000 });

    // The menu overlay outlives the dialog's appearance; focus only lands inside the dialog
    // after it detaches. See note 1 above.
    await page.locator('.mat-mdc-menu-panel').waitFor({ state: 'detached', timeout: 10000 });

    // expect: focus has moved into the dialog.
    const focusIsInDialog = () =>
      page.evaluate(() => {
        const el = document.activeElement;
        return Array.from(document.querySelectorAll('mat-dialog-container')).some(
          (d) => el instanceof Node && d.contains(el)
        );
      });

    await expect
      .poll(focusIsInDialog, { timeout: 10000, message: 'focus should move into the dialog' })
      .toBe(true);

    // 2. expect: focus is trapped — it stays inside the dialog across a full cycle of the
    //    dialog's own focusable controls, and then some.
    const focusable = dialog.locator(
      'button:not([disabled]), input:not([disabled]), select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    const focusableCount = await focusable.count();
    expect(focusableCount).toBeGreaterThan(0);

    for (let i = 0; i < focusableCount + 2; i++) {
      await page.keyboard.press('Tab');
      expect(await focusIsInDialog(), `focus left the dialog after Tab #${i + 1}`).toBe(true);
    }

    // expect: trapping holds in the backward direction too.
    for (let i = 0; i < 3; i++) {
      await page.keyboard.press('Shift+Tab');
      expect(await focusIsInDialog(), `focus left the dialog after Shift+Tab #${i + 1}`).toBe(true);
    }

    // 3. expect: Escape does NOT close this dialog — it guards unsaved work. See note 2.
    await page.keyboard.press('Escape');
    await expect(dialog).toBeVisible({ timeout: 5000 });
    expect(await focusIsInDialog()).toBe(true);

    // 4. expect: Cancel closes it, which is the deliberate way out.
    const cancelButton = dialog.getByRole('button', { name: 'Cancel' });
    await expect(cancelButton).toBeVisible({ timeout: 5000 });
    await cancelButton.click();
    await expect(dialog).not.toBeVisible({ timeout: 10000 });

    // 5. expect: with the dialog gone, focus is no longer held inside a dialog and the page
    //    is interactive again — the trigger can be operated a second time.
    expect(await focusIsInDialog()).toBe(false);
    await expect(addTeamButton).toBeVisible({ timeout: 10000 });
    await addTeamButton.click();
    await expect(page.getByRole('menuitem', { name: 'New Team' })).toBeVisible({ timeout: 10000 });
    await page.keyboard.press('Escape'); // close the menu; no dialog is open, nothing to guard
  });
});
