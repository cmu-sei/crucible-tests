// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: caster/caster-test-plan.md
// seed: seed.spec.ts

import path from 'path';
import {
  test,
  expect,
  casterApi,
  casterEditorContent,
  openCasterDirectory,
  seedCasterDirectory,
  seedCasterProject,
  CASTER_THEMES,
  setCasterTheme,
} from '../../fixtures';

// Caster has no single-file upload: files reach a directory by importing an
// archive into it from the directory's context menu. This zip holds
// variables.tf and network.tf at its root.
const ARCHIVE = path.join(__dirname, 'data', 'terraform-files.zip');

for (const theme of CASTER_THEMES) {
  test.describe(`${theme} theme › Directories Management`, () => {
    test('Upload Files to Directory', async ({ casterAuthenticatedPage: page, cleanupCasterProject }) => {
      await setCasterTheme(page, theme);
      const projectId = await seedCasterProject(page, `Upload File Project ${Date.now()}`);
      cleanupCasterProject(projectId);
      const directoryId = await seedCasterDirectory(page, projectId, 'Upload-Dir');

      // 1. Open the directory's context menu and choose Import
      await openCasterDirectory(page, projectId, 'Upload-Dir');
      await page.getByRole('button', { name: 'Upload-Dir', exact: true }).click({ button: 'right' });
      await page.getByRole('menuitem', { name: 'Import' }).click();

      // expect: the import dialog, which can't be submitted until a file is chosen
      const dialog = page.getByRole('dialog', { name: 'Import Directory: Upload-Dir' });
      await expect(dialog.getByRole('button', { name: 'Choose File' })).toBeVisible();
      await expect(dialog.getByRole('button', { name: 'Import' })).toBeDisabled();

      // 2. Choose the archive
      await dialog.locator('input[type="file"]').setInputFiles(ARCHIVE);

      // expect: it is selected
      await expect(dialog).toContainText('terraform-files.zip');
      await expect(dialog.getByRole('button', { name: 'Import' })).toBeEnabled();

      // 3. Import it
      await dialog.getByRole('button', { name: 'Import' }).click();

      // expect: success, and both files listed in the directory
      await expect(dialog.getByText('Import Successful')).toBeVisible();
      await dialog.getByRole('button', { name: 'OK' }).click();
      await expect(dialog).toBeHidden();
      await page.getByRole('button', { name: 'FILES', exact: true }).click();
      const files = page.getByRole('region', { name: 'FILES' });
      await expect(files.getByText('network.tf', { exact: true })).toBeVisible();
      await expect(files.getByText('variables.tf', { exact: true })).toBeVisible();

      // expect: a file's content can be viewed
      await files.getByText('network.tf', { exact: true }).click();
      await expect
        .poll(() => casterEditorContent(page))
        .toBe('resource "terraform_data" "net" {}\n');

      // expect: and they were stored in this directory
      const stored = (await casterApi<any[]>(page, 'GET', `directories/${directoryId}/files`)).body;
      expect(stored.map((f) => f.name).sort()).toEqual(['network.tf', 'variables.tf']);
    });
  });
}
