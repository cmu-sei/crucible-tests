// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: topomojo/topomojo-test-plan.md
// seed: tests/seed.spec.ts

import { test, expect, Services } from '../../fixtures';
import type { Page } from '@playwright/test';
import {
  createWorkspace,
  deleteWorkspace,
  getTopoMojoAdminToken,
  setWorkspaceDocument,
} from '../../../topomojo-helpers';

// The document editor shares edits between everyone who has the workspace open: each
// edit goes to the TopoMojo hub over SignalR and is applied to the other open editors.
async function openDocument(page: Page, workspaceId: string) {
  await page.goto(`${Services.TopoMojo.UI}/topo/${workspaceId}/document`, { waitUntil: 'domcontentloaded' });
  // The editor unlocks (Save replaces the lock icon) 5 s after the document has loaded
  // (a debounce in the editor), on top of loading Monaco, so allow more than the default.
  await expect(page.getByRole('button', { name: 'Save your document changes.' })).toBeVisible({ timeout: 20000 });
  return page.locator('ngx-monaco-editor .monaco-editor .view-lines').first();
}

test.describe('Real-time Updates and Notifications', () => {
  let workspaceId: string | undefined;

  test.afterEach(async () => {
    if (workspaceId) await deleteWorkspace(await getTopoMojoAdminToken(), workspaceId);
    workspaceId = undefined;
  });

  test('Real-time Workspace Updates', async ({ topomojoAuthenticatedPage: page }) => {
    const token = await getTopoMojoAdminToken();
    workspaceId = (await createWorkspace(token, { name: `E2E Realtime Document ${Date.now()}` })).id;
    await setWorkspaceDocument(token, workspaceId, '# Shared notes\n\nFirst line.\n');

    // 1. Open the workspace document in two browser windows for the same user
    // expect: Both windows show the same document
    const first = await openDocument(page, workspaceId);
    await expect(first).toContainText('First line.');
    const secondPage = await page.context().newPage();
    try {
      const second = await openDocument(secondPage, workspaceId);
      await expect(second).toContainText('First line.');

      // 2. Make a change in one window: move to the end of the text and type a line
      const line = `Live edit ${Date.now()}`;
      await first.click();
      await page.keyboard.press('Control+End');
      await page.keyboard.press('Enter');
      await page.keyboard.type(line);
      await expect(first).toContainText(line);

      // expect: The change appears in the second window without a reload or a click
      await expect(second).toContainText(line, { timeout: 15000 });

      // expect: Edits from the second window reach the first one the same way
      const reply = `Reply ${Date.now()}`;
      await second.click();
      await secondPage.keyboard.press('Control+End');
      await secondPage.keyboard.press('Enter');
      await secondPage.keyboard.type(reply);
      await expect(second).toContainText(reply);
      await expect(first).toContainText(reply, { timeout: 15000 });
    } finally {
      await secondPage.close();
    }
  });

  test('Real-time Workspace Updates - First Edit in an Empty Document', async ({ topomojoAuthenticatedPage: page }) => {
    // Pending upstream: when an edit arrives without the sender's begin positions (the
    // sender typed without first moving the cursor, as when clicking into an empty
    // document), the receiving editor throws "externalRange.getStartPosition is not a
    // function": CollaborationService builds plain objects cast to Monaco's Range. The
    // throw leaves the receiver's applyingRemoteEdits flag set, so it drops the edit and
    // never sends its own edits again. Asserting the correct behavior; listed in
    // ci/known-failures.json until the receiving editor applies the edit.
    workspaceId = (await createWorkspace(await getTopoMojoAdminToken(), {
      name: `E2E Realtime Empty Document ${Date.now()}`,
    })).id;

    // 1. Open the empty workspace document in two browser windows
    const first = await openDocument(page, workspaceId);
    const secondPage = await page.context().newPage();
    try {
      const second = await openDocument(secondPage, workspaceId);

      // 2. Click into the empty document in the first window and type
      const line = `First words ${Date.now()}`;
      await first.click();
      await page.keyboard.type(line);
      await expect(first).toContainText(line);

      // expect: The second window shows the text and can answer it
      await expect(second).toContainText(line, { timeout: 15000 });
      const reply = `Reply ${Date.now()}`;
      await second.click();
      await secondPage.keyboard.press('Control+End');
      await secondPage.keyboard.press('Enter');
      await secondPage.keyboard.type(reply);
      await expect(second).toContainText(reply);
      await expect(first).toContainText(reply, { timeout: 15000 });
    } finally {
      await secondPage.close();
    }
  });
});
