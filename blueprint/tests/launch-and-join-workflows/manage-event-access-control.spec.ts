// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: specs/blueprint-test-plan.md

import { test, expect, Services } from '../../fixtures';
import {
  getBlueprintToken,
  createMsel,
  deleteMsel,
  tempBlueprintName,
} from '../../test-helpers';

/**
 * Verifies both branches of the `/manage` page's access gate.
 *
 * `manage.component.html` renders management controls only when
 * `msel.id && (owner || canEditMsels)`; otherwise it shows the
 * "You have nothing to manage." panel.
 *
 * Rewritten. The previous version had two defects:
 *
 * 1. Its locator was malformed. `page.locator('text=/a/i, text=/b/i')` is not valid
 *    Playwright syntax — `text=` engines cannot be comma-combined — so it matched 0
 *    elements even though the text is on the page. Verified live: that locator
 *    returns count 0 while `getByText(/contact your administrator/i)` returns 1.
 *
 * 2. It wrapped everything in `if (nothingVisible) … else …`, so whichever branch ran
 *    was whatever the app happened to do. A spec that adapts to the app's output
 *    cannot fail, and therefore tests nothing.
 *
 * Now: each branch is driven to deterministically. Visiting `/manage` with no `?msel=`
 * leaves `msel.id` undefined, which must produce the denial panel. Visiting it with a
 * seeded Deployed MSEL as admin (who holds EditMsels) must produce the End Event control.
 */
test.describe('Launch and Join Event Workflows', () => {
  test('Manage Event Access Control', async ({ blueprintAuthenticatedPage: page }) => {
    // ── Branch 1: no MSEL in context → access denied ────────────────────────────
    await page.goto(`${Services.Blueprint.UI}/manage`, { waitUntil: 'domcontentloaded' });

    const denialPanel = page.locator('.nothing-to-see-here');
    await expect(denialPanel).toBeVisible({ timeout: 20000 });

    await expect(page.getByRole('heading', { name: 'You have nothing to manage.' })).toBeVisible();
    await expect(
      page.getByText(/If you believe you should have permissions to manage this event, contact your administrator\./i)
    ).toBeVisible();

    // No management control may leak into the denied state.
    await expect(page.getByRole('button', { name: 'End Event' })).toHaveCount(0);

    // ── Branch 2: a Deployed MSEL the admin can edit → controls render ──────────
    const token = await getBlueprintToken();
    const mselName = tempBlueprintName('TestBP-Manage');
    const msel = await createMsel(token, {
      name: mselName,
      description: 'Seeded Deployed MSEL for the manage-page permitted branch.',
      // The manage view only renders controls for a Deployed MSEL; any other status
      // redirects away via post_logout_redirect_uri.
      status: 'Deployed',
    });

    try {
      await page.goto(`${Services.Blueprint.UI}/manage?msel=${msel.id}`, {
        waitUntil: 'domcontentloaded',
      });

      // The End Event button is the management control gated behind the permission check.
      await expect(page.getByRole('button', { name: 'End Event' })).toBeVisible({ timeout: 20000 });

      // The MSEL under management is identified by name, proving the right one loaded.
      await expect(page.getByText(mselName, { exact: true })).toBeVisible({ timeout: 15000 });

      // The denial panel must be gone in the permitted branch.
      await expect(denialPanel).toHaveCount(0);
    } finally {
      await deleteMsel(token, msel.id);
    }
  });
});
