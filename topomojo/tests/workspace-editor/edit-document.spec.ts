// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: topomojo/topomojo-test-plan.md
// seed: tests/seed.spec.ts

import { test, expect, Services } from '../../fixtures';
import {
  createWorkspace,
  deleteWorkspace,
  getTopoMojoAdminToken,
  getWorkspaceDocument,
} from '../../../topomojo-helpers';

test.describe('Workspace Editor', () => {
  let workspaceId: string | undefined;

  test.beforeEach(async () => {
    const token = await getTopoMojoAdminToken();
    workspaceId = (await createWorkspace(token, { name: `E2E Edit Document ${Date.now()}` })).id;
  });

  test.afterEach(async () => {
    if (workspaceId) await deleteWorkspace(await getTopoMojoAdminToken(), workspaceId);
    workspaceId = undefined;
  });

  test('Workspace Editor - Edit Document', async ({ topomojoAuthenticatedPage: page }) => {
    // 1. Navigate to the workspace document tab
    // expect: Document editor is displayed. The editor starts read-only and unlocks 5 s
    // after the document has loaded (a debounce in the editor); the Save button replaces
    // the lock icon at that point, so its wait allows more than the default.
    await page.goto(`${Services.TopoMojo.UI}/topo/${workspaceId}/document`, { waitUntil: 'domcontentloaded' });
    const editor = page.locator('ngx-monaco-editor .monaco-editor').first();
    const saveButton = page.getByRole('button', { name: 'Save your document changes.' });
    await expect(editor).toBeVisible();
    await expect(saveButton).toBeVisible({ timeout: 20000 });

    // 2. Enter document content with markdown
    // expect: Editor accepts text input. Typed rather than inserted in one go: Playwright's
    // insertText lands twice in Monaco under Firefox. Monaco auto-closes the opening quote
    // and the closing one types over it, so the text ends up as written.
    const heading = `Lab Instructions ${Date.now()}`;
    const markdown = [
      `# ${heading}`,
      '',
      '"Connect" to the console -- then begin.',
      '',
      '> Read every step first.',
      '',
      '| Host | Address |',
      '| --- | --- |',
      '| web | 10.0.0.5 |',
      '',
      'Good luck :smile:',
      '',
    ].join('\n');
    await editor.locator('.view-lines').click();
    await page.keyboard.type(markdown);
    await expect(editor.locator('.view-lines')).toContainText(heading);

    // expect: Markdown formatting works. The preview toggle renders the text the way
    // players see it: the app's renderer styles tables and block quotes, smartypants
    // curls quotes and dashes, and the editor's preview turns emoji shortnames into emoji.
    const previewToggle = page.getByRole('button', { name: /Toggle preview mode/ });
    await previewToggle.click();
    await expect(previewToggle).toHaveClass(/active/);
    const preview = page.locator('.preview markdown');
    await expect(preview.getByRole('heading', { level: 1, name: heading })).toBeVisible();
    await expect(preview.locator('table.table-striped')).toContainText('10.0.0.5');
    await expect(preview.locator('blockquote.blockquote')).toContainText('Read every step first.');
    await expect(preview).toContainText('“Connect” to the console – then begin.');
    await expect(preview).toContainText('Good luck 😄');
    await previewToggle.click();
    await expect(editor).toBeVisible();

    // 3. Save document
    // expect: Document is saved — the Saved indicator appears
    const saved = page.waitForResponse(
      (r) => r.request().method() === 'PUT' && new URL(r.url()).pathname.endsWith(`/api/document/${workspaceId}`),
    );
    await saveButton.click();
    expect((await saved).ok()).toBe(true);
    await expect(page.locator('fa-icon[aria-label="Saved"]')).toBeVisible();

    // expect: Content persists
    const stored = await getWorkspaceDocument(await getTopoMojoAdminToken(), workspaceId!);
    expect(stored).toContain(`# ${heading}`);
    expect(stored).toContain('| web | 10.0.0.5 |');
  });
});
