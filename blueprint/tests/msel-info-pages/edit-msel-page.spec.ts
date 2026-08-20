// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: specs/blueprint-test-plan.md

import { test, expect, Services } from '../../fixtures';
import {
  getBlueprintToken,
  createMsel,
  deleteMsel,
  tempBlueprintName,
  navigateToMsel,
} from '../../test-helpers';

/**
 * Editing a MSEL Info page: entering edit mode exposes the rich-text editor and its controls.
 *
 * The previous version was flaky because it built its precondition through the UI: it clicked
 * the "Add Page" tab, then clicked Save only `if (saveVisible)` — a conditional that silently
 * skipped the save when the button hadn't rendered yet — and never waited on the POST that the
 * Add Page tab fires. When that race lost, no page existed and "Edit Page" was never found.
 *
 * This version seeds the page via `POST /api/mselpages`, so the precondition is guaranteed
 * before the browser is involved, and the test exercises only the behaviour under test.
 *
 * DOM notes from `msel-info.component.html`:
 *   - The edit control is `<button mat-icon-button title="Edit Page">` — an icon button whose
 *     accessible name comes from `title`, not text content.
 *   - Pages render as tabs labelled with the page name. "Add Page" is a trailing tab that
 *     creates a page named "New Page" (then "New Page 2", ...) the instant it is selected.
 */
test.describe('MSEL Info Pages Management', () => {
  let token: string;
  let mselId: string;
  let pageId: string;
  let pageName: string;

  test.beforeEach(async () => {
    token = await getBlueprintToken();
    const msel = await createMsel(token);
    mselId = msel.id;

    pageName = tempBlueprintName('TestBP-Page');
    const res = await fetch(`${Services.Blueprint.API}/api/mselpages`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        mselId,
        name: pageName,
        content: '<p>Seeded page content</p>',
        allCanView: false,
        includeInPlaybook: false,
      }),
    });
    expect(res.ok, `seeding MSEL page failed with ${res.status}`).toBe(true);
    pageId = (await res.json()).id;
  });

  test.afterEach(async () => {
    // Deleting the MSEL should cascade to its pages, but remove the page explicitly first so
    // a cascade failure cannot leak it.
    try {
      if (pageId) {
        await fetch(`${Services.Blueprint.API}/api/mselpages/${pageId}`, {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${token}` },
        });
      }
    } catch (err) {
      console.warn(`Cleanup failed for MSEL page ${pageId}: ${err}`);
    }
    try {
      if (mselId) await deleteMsel(token, mselId);
    } catch (err) {
      console.warn(`Cleanup failed for MSEL ${mselId}: ${err}`);
    }
  });

  test('Edit MSEL Page', async ({ blueprintAuthenticatedPage: page }) => {
    await navigateToMsel(page, mselId);

    // The seeded page appears as its own tab; select it.
    const pageTab = page.getByRole('tab').filter({ hasText: pageName }).first();
    await expect(pageTab).toBeVisible({ timeout: 15000 });
    await pageTab.click();
    await expect(pageTab).toHaveAttribute('aria-selected', 'true', { timeout: 10000 });

    // Enter edit mode.
    const editButton = page.getByRole('button', { name: 'Edit Page' });
    await expect(editButton).toBeVisible({ timeout: 10000 });
    await editButton.click();

    // expect: the rich-text editor toolbar is available.
    await expect(page.getByRole('button', { name: 'Bold' })).toBeVisible({ timeout: 10000 });

    // expect: the content area is editable and holds the seeded content.
    const contentArea = page.locator('[contenteditable="true"]').first();
    await expect(contentArea).toBeVisible({ timeout: 10000 });
    await expect(contentArea).toContainText('Seeded page content');

    // expect: Save and Cancel are offered while editing.
    await expect(page.getByRole('button', { name: /Save Changes/i }).first()).toBeVisible({
      timeout: 10000,
    });
    await expect(page.getByRole('button', { name: /Cancel/i }).first()).toBeVisible({
      timeout: 10000,
    });
  });
});
