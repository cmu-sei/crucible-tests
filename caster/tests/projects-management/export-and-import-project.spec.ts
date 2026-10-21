// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: caster/caster-test-plan.md
// seed: seed.spec.ts

import path from 'path';
import { Page } from '@playwright/test';
import {
  test,
  expect,
  Services,
  casterApi,
  seedCasterDirectory,
  seedCasterFile,
  seedCasterProject,
  CASTER_THEMES,
  setCasterTheme,
} from '../../fixtures';

/**
 * A folder compressed in macOS Finder: `Finder-Dir/` holds main.tf, a .DS_Store and
 * a GIF, and `__MACOSX/` holds the AppleDouble `._` file Finder writes for each of
 * them. The .DS_Store, the `._` files and the GIF all contain NUL bytes.
 */
const FINDER_ARCHIVE = path.join(__dirname, 'data', 'finder-compressed.zip');

/** Open a project's Import dialog, import an archive, and dismiss the result. */
async function importArchive(page: Page, projectId: string, projectName: string, archive: string): Promise<void> {
  await page.goto(`${Services.Caster.UI}/projects/${projectId}`);
  await page.getByText('Import Project', { exact: true }).filter({ visible: true }).click();
  const dialog = page.getByRole('dialog', { name: `Import Project: ${projectName}` });
  await dialog.locator('input[type="file"]').setInputFiles(archive);
  await expect(dialog).toContainText(path.basename(archive));
  await dialog.getByRole('button', { name: 'Import' }).click();

  // expect: the import reports success
  await expect(dialog.getByText('Import Successful')).toBeVisible();
  await dialog.getByRole('button', { name: 'OK' }).click();
  await expect(dialog).toBeHidden();
}

/** The project's top-level directory with this name. */
async function directoryByName(page: Page, projectId: string, name: string): Promise<any> {
  const directories = (await casterApi<any[]>(page, 'GET', `projects/${projectId}/directories`)).body;
  return directories.find((d) => d.name === name);
}

for (const theme of CASTER_THEMES) {
  test.describe(`${theme} theme › Projects Management`, () => {
    test('Export And Import A Project With Its Settings', async ({
      casterAuthenticatedPage: page,
      cleanupCasterProject,
    }, testInfo) => {
      await setCasterTheme(page, theme);
      const suffix = Date.now();

      // Pin a version other than the default, so a lost setting can't pass by
      // falling back to the same value.
      const versions: string[] = (await casterApi(page, 'GET', 'terraform/versions')).body.versions;
      const terraformVersion = versions[versions.length - 1];

      const sourceName = `Export Source ${suffix}`;
      const sourceId = await seedCasterProject(page, sourceName);
      cleanupCasterProject(sourceId);
      const directoryId = await seedCasterDirectory(page, sourceId, 'Settings-Dir', { terraformVersion, parallelism: 7 });
      await seedCasterFile(page, directoryId, 'main.tf', 'resource "terraform_data" "exported" {}\n');
      const workspace = await casterApi(page, 'POST', 'workspaces', {
        name: 'pinned',
        directoryId,
        terraformVersion,
        parallelism: 3,
      });
      expect(workspace.status).toBe(201);

      // 1. Export the project as a zip
      await page.goto(`${Services.Caster.UI}/projects/${sourceId}`);
      await page.getByText('Export Project', { exact: true }).filter({ visible: true }).click();
      const exportDialog = page.getByRole('dialog', { name: `Export Project: ${sourceName}` });
      await expect(exportDialog.getByRole('combobox', { name: 'Archive Type' })).toHaveText('Zip');
      const download = page.waitForEvent('download');
      await exportDialog.getByRole('button', { name: 'Export' }).click();
      const archive = testInfo.outputPath(`${sourceName}.zip`);
      await (await download).saveAs(archive);

      // 2. Import it into a new, empty project
      const targetName = `Import Target ${suffix}`;
      const targetId = await seedCasterProject(page, targetName);
      cleanupCasterProject(targetId);
      await importArchive(page, targetId, targetName, archive);

      // expect: the directory and its file arrive
      const imported = await directoryByName(page, targetId, 'Settings-Dir');
      expect(imported).toBeTruthy();
      await page.getByRole('button', { name: 'Settings-Dir', exact: true }).click();
      await page.getByRole('button', { name: 'FILES', exact: true }).click();
      await expect(page.getByRole('region', { name: 'FILES' }).getByText('main.tf', { exact: true })).toBeVisible();

      // expect: so do the directory's settings, rather than falling back to the defaults
      expect(imported).toMatchObject({ terraformVersion, parallelism: 7 });

      // expect: and the workspace import created keeps its own pinned settings
      const workspaces = (await casterApi<any[]>(page, 'GET', `directories/${imported.id}/workspaces`)).body;
      expect(workspaces).toEqual([expect.objectContaining({ name: 'pinned', terraformVersion, parallelism: 3 })]);
    });

    test('Import A Folder Compressed In macOS Finder', async ({ casterAuthenticatedPage: page, cleanupCasterProject }) => {
      await setCasterTheme(page, theme);
      const projectName = `Finder Import ${Date.now()}`;
      const projectId = await seedCasterProject(page, projectName);
      cleanupCasterProject(projectId);

      // 1. Import the Finder zip
      // Pending upstream: the import result's `warnings` names logo.gif as a binary
      // file that was not imported, but the dialog only lists locked files, so it
      // reports a plain "Import Successful". Once the dialog shows warnings, assert
      // that it names logo.gif here.
      await importArchive(page, projectId, projectName, FINDER_ARCHIVE);

      // expect: the directory arrives with main.tf only; Finder's metadata is
      // dropped, and so is the binary file Postgres could not store
      const directory = await directoryByName(page, projectId, 'Finder-Dir');
      expect(directory).toBeTruthy();
      const files = (await casterApi<any[]>(page, 'GET', `directories/${directory.id}/files`)).body;
      expect(files.map((f) => f.name)).toEqual(['main.tf']);
      expect(await directoryByName(page, projectId, '__MACOSX')).toBeUndefined();

      // expect: and the sidebar shows the same
      await page.getByRole('button', { name: 'Finder-Dir', exact: true }).click();
      await page.getByRole('button', { name: 'FILES', exact: true }).click();
      const listed = page.getByRole('region', { name: 'FILES' });
      await expect(listed.getByText('main.tf', { exact: true })).toBeVisible();
      await expect(listed.getByText(/\.DS_Store|^\._|logo\.gif/)).toHaveCount(0);
    });
  });
}
