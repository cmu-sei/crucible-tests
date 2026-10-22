// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: caster/caster-test-plan.md
// seed: seed.spec.ts

import {
  test,
  expect,
  casterApi,
  casterEditorContent,
  openCasterDirectory,
  seedCasterDirectory,
  seedCasterFile,
  seedCasterProject,
  CASTER_THEMES,
  setCasterTheme,
} from '../../fixtures';

for (const theme of CASTER_THEMES) {
  test.describe(`${theme} theme › Directories Management`, () => {
    test('Edit File in Directory', async ({ casterAuthenticatedPage: page, cleanupCasterProject }) => {
      await setCasterTheme(page, theme);
      const projectId = await seedCasterProject(page, `Edit File Project ${Date.now()}`);
      cleanupCasterProject(projectId);
      const directoryId = await seedCasterDirectory(page, projectId, 'Edit-File-Dir');
      const fileId = await seedCasterFile(page, directoryId, 'edit-test.tf', '# before\n');

      // 1. Open the file from the directory's file list
      await openCasterDirectory(page, projectId, 'Edit-File-Dir');
      await page.getByRole('button', { name: 'FILES', exact: true }).click();
      await page.getByRole('region', { name: 'FILES' }).getByText('edit-test.tf', { exact: true }).click();

      // expect: its content in the editor, read-only until editing starts
      await expect.poll(() => casterEditorContent(page)).toBe('# before\n');
      await expect(page.getByRole('button', { name: 'Save Changes' })).toBeDisabled();

      // 2. Start editing and add a line
      await page.getByRole('button', { name: 'Edit this file' }).click();
      await expect(page.getByRole('button', { name: 'Finish editing' })).toBeVisible();
      // Monaco's own input is invisible; clicking its rendered lines focuses it.
      await page.locator('.monaco-editor .view-lines').click();
      await page.keyboard.press('ControlOrMeta+End');
      await page.keyboard.type('# after\n');

      // expect: the change is tracked, so it can be saved or discarded
      await expect.poll(() => casterEditorContent(page)).toContain('# after');
      await expect(page.getByRole('button', { name: 'Save Changes' })).toBeEnabled();
      await expect(page.getByRole('button', { name: 'Discard Changes' })).toBeEnabled();

      // 3. Save
      const save = page.waitForRequest(
        (r) => ['PUT', 'PATCH'].includes(r.method()) && new URL(r.url()).pathname.endsWith(`/api/files/${fileId}`)
      );
      await page.getByRole('button', { name: 'Save Changes' }).click();
      const body = (await save).postDataJSON();

      // expect: the request carries the content and at most the name; the API keeps
      // the file's directory and workspace from what it has stored
      expect(body.content).toContain('# after');
      expect(Object.keys(body).filter((k) => !['name', 'content'].includes(k))).toEqual([]);

      // expect: the save lands, and the file is still in its directory
      await expect(page.getByRole('button', { name: 'Save Changes' })).toBeDisabled();
      const saved = (await casterApi(page, 'GET', `files/${fileId}`)).body;
      expect(saved.content).toContain('# before\n');
      expect(saved.content).toContain('# after');
      expect(saved.directoryId).toBe(directoryId);

      // 4. Stop editing
      await page.getByRole('button', { name: 'Finish editing' }).click();
      await expect(page.getByRole('button', { name: 'Edit this file' })).toBeVisible();
    });
  });
}
