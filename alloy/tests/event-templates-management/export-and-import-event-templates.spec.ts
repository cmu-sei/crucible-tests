// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: alloy/alloy-test-plan.md

import { readFile, writeFile } from 'node:fs/promises';
import { test, expect, Page } from '@playwright/test';
import { authenticateWithKeycloak, Services } from '../../../shared-fixtures';
import {
  ALLOY_THEMES,
  applyAlloyTheme,
  createTestEventTemplate,
  deleteEventTemplatesByPattern,
} from '../../test-helpers';

/** Every template these tests create or import starts with this, so the cleanup's search finds them all. */
const PREFIX = 'Export Source';

/** The id of the one listed template named exactly `name`, read from its "Copy: <id>" button. */
async function templateIdOf(page: Page, name: string): Promise<string> {
  const row = page.getByRole('row').filter({ has: page.getByRole('cell', { name, exact: true }) });
  const title = (await row.getByRole('button', { name: /^Copy: / }).getAttribute('title')) ?? '';
  return title.replace(/^Copy:\s*/, '').trim();
}

async function importFile(page: Page, path: string, fileName: string) {
  const importDialog = page.getByRole('dialog', { name: 'Import Event Templates' });
  await page.getByRole('button', { name: 'Import Event Templates' }).click();
  await expect(importDialog).toBeVisible();
  await importDialog.locator('input[type="file"]').setInputFiles(path);
  await expect(importDialog.getByText(fileName)).toBeVisible();
  await importDialog.getByRole('button', { name: 'Import' }).click();
  return importDialog;
}

for (const theme of ALLOY_THEMES) {
  test.describe(`${theme} theme › Event Templates Management`, () => {
    let templateName: string;

    test.beforeEach(async ({ page }) => {
      await authenticateWithKeycloak(page, Services.Alloy.UI);
      await applyAlloyTheme(page, theme);
      templateName = `${PREFIX} ${Date.now()}`;
      await createTestEventTemplate(page, templateName);
    });

    test.afterEach(async ({ page }) => {
      // Removes the source template and every copy an import made of it ("<name> - <user>").
      await deleteEventTemplatesByPattern(page, templateName);
      await deleteEventTemplatesByPattern(page, PREFIX);
    });

    test('Export and Import Event Templates', async ({ page }, testInfo) => {
      // 1. Navigate to admin Event Templates section
      await page.goto(`${Services.Alloy.UI}/admin`);
      await expect(page.getByRole('heading', { name: 'Administration' })).toBeVisible();
      await page.getByRole('textbox', { name: 'Search' }).fill(templateName);

      // expect: The template appears in the list
      await expect(page.getByRole('cell', { name: templateName, exact: true })).toBeVisible({ timeout: 30000 });
      const templateId = await templateIdOf(page, templateName);
      expect(templateId).toMatch(/^[0-9a-f-]{36}$/);

      // 2. Select the template's checkbox and click the export button
      await page.getByRole('checkbox', { name: `Select ${templateName}` }).check();
      await page.getByRole('button', { name: 'Export 1 Selected Event Template' }).click();

      // expect: The Export Event Templates dialog shows "Selected Event Templates: 1"
      const exportDialog = page.getByRole('dialog', { name: 'Export Event Templates' });
      await expect(exportDialog).toBeVisible();
      await expect(exportDialog.getByText('Selected Event Templates: 1')).toBeVisible();

      // 3. Click "Export"
      const downloadPromise = page.waitForEvent('download');
      await exportDialog.getByRole('button', { name: 'Export' }).click();

      // expect: "<template name>.json" downloads, holding the template as a JSON object, and the dialog closes
      const download = await downloadPromise;
      expect(download.suggestedFilename()).toBe(`${templateName}.json`);
      const exportPath = testInfo.outputPath(download.suggestedFilename());
      await download.saveAs(exportPath);
      const exported = JSON.parse(await readFile(exportPath, 'utf8'));
      expect(Array.isArray(exported)).toBe(false);
      expect(exported).toMatchObject({ id: templateId, name: templateName, durationHours: 2 });
      await expect(exportDialog).not.toBeVisible();

      // 4. Click "Import Event Templates", "Choose File" the downloaded file and click "Import"
      const importDialog = await importFile(page, exportPath, download.suggestedFilename());

      // expect: The dialog reports one imported template, renamed with " - <user>" because the original still has the name
      await expect(importDialog.getByText('Imported Event Templates: 1')).toBeVisible({ timeout: 30000 });
      await expect(importDialog.getByText('Imported with changes:')).toBeVisible();
      // The change sits in a list item beside the "Name:" and "Change:" labels, so match without anchoring to its start
      const renamed = importDialog.getByRole('listitem').filter({
        hasText: new RegExp(`Renamed to "${templateName} - .+" because an Event Template named "${templateName}" already exists\\.$`),
      });
      await expect(renamed).toBeVisible();
      const copyName = /Renamed to "(.+)" because/.exec((await renamed.textContent()) ?? '')?.[1] ?? '';
      await importDialog.getByRole('button', { name: 'OK' }).click();
      await expect(importDialog).not.toBeVisible();

      // expect: The copy is a new template with a new id, and the original is unchanged
      await page.getByRole('textbox', { name: 'Search' }).fill(templateName);
      await expect(page.getByRole('cell', { name: copyName, exact: true })).toBeVisible({ timeout: 30000 });
      await expect(page.getByRole('cell', { name: templateName, exact: true })).toHaveCount(1);
      const copyId = await templateIdOf(page, copyName);
      expect(copyId).toMatch(/^[0-9a-f-]{36}$/);
      expect(copyId).not.toBe(templateId);
      expect(await templateIdOf(page, templateName)).toBe(templateId);
    });

    test('Import a JSON array of Event Templates', async ({ page }, testInfo) => {
      // 1. Write a file holding two templates whose names no template has
      const names = [`${templateName} Array A`, `${templateName} Array B`];
      const filePath = testInfo.outputPath('event-templates.json');
      await writeFile(filePath, JSON.stringify(names.map((name) => ({ name, durationHours: 1 }))));
      await page.goto(`${Services.Alloy.UI}/admin`);
      await expect(page.getByRole('heading', { name: 'Administration' })).toBeVisible();

      // 2. Import it
      const importDialog = await importFile(page, filePath, 'event-templates.json');

      // expect: Both are imported under their own names, with nothing to report
      await expect(importDialog.getByText('Imported Event Templates: 2')).toBeVisible({ timeout: 30000 });
      await expect(importDialog.getByText('Import Successful')).toBeVisible();
      await importDialog.getByRole('button', { name: 'OK' }).click();
      await expect(importDialog).not.toBeVisible();

      // expect: Both templates are in the list
      await page.getByRole('textbox', { name: 'Search' }).fill(`${templateName} Array`);
      for (const name of names) {
        await expect(page.getByRole('cell', { name, exact: true })).toBeVisible({ timeout: 30000 });
      }
    });
  });
}
