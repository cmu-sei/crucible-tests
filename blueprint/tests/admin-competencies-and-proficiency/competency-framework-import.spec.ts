// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: specs/blueprint-test-plan.md
// seed: tests/seed.spec.ts
//
// The Import Competency Framework dialog and the per-row JSON download. The dialog is where
// the UI owns real behaviour: it picks a parser by file extension, renders the API's preview,
// and polls GET /api/competencyframeworks/imports/{importId} on a timer to drive its progress
// bar while the import request is still in flight. (Progress is polled, not pushed over
// SignalR.) Blueprint.Api.Tests owns the import and preview endpoints themselves; this spec
// asserts only what the dialog and the table show.

import { randomUUID } from 'crypto';
import { test, expect, Page } from '../../fixtures';
import {
  getBlueprintToken,
  gotoBlueprintAdminSection,
  tempBlueprintName,
  createCompetencyFramework,
  deleteCompetencyFramework,
  findCompetencyFrameworksByName,
  fillDialogFields,
} from '../../test-helpers';

/**
 * A framework in Blueprint's own export shape (what the row's Download button produces):
 * a work role related to one task and one knowledge item, so the preview has two
 * relationships to count.
 */
function nativeFrameworkFile(name: string, idNumber: string) {
  const framework = {
    name,
    source: 'SPEC-IMPORT',
    version: '1.2',
    idNumber,
    description: 'Imported by the import spec',
    competencies: [
      { idNumber: 'SPEC-WRL-801', shortName: 'Imported work role', relatedIdNumbers: ['T0801', 'K0801'] },
      { idNumber: 'T0801', shortName: 'Imported task', relatedIdNumbers: [] },
      { idNumber: 'K0801', shortName: 'Imported knowledge', relatedIdNumbers: [] },
    ],
  };
  return {
    name: 'spec-framework.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(framework)),
  };
}

function uniqueIdNumber(): string {
  return `SPECFW-${randomUUID().slice(0, 8).toUpperCase()}`;
}

async function openImportDialog(page: Page) {
  await page.getByTitle('Import framework from JSON').click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByText('Import Competency Framework')).toBeVisible();
  return dialog;
}

/** Choose a file in the dialog and, for a JSON file, wait for its preview to come back. */
async function chooseFile(
  page: Page,
  file: { name: string; mimeType: string; buffer: Buffer },
  expectPreview: boolean
) {
  const dialog = page.getByRole('dialog');
  const preview = expectPreview
    ? page.waitForResponse((r) => r.url().toLowerCase().includes('/api/competencyframeworks/preview-json'))
    : null;
  await dialog.locator('input[type="file"]').setInputFiles(file);
  if (preview) expect((await preview).ok()).toBe(true);
}

test.describe('Admin - Competencies and Proficiency', () => {
  let frameworkName: string;

  test.beforeEach(() => {
    frameworkName = tempBlueprintName('ImportFw');
  });

  test.afterEach(async () => {
    const token = await getBlueprintToken();
    for (const fw of await findCompetencyFrameworksByName(token, frameworkName)) {
      await deleteCompetencyFramework(token, fw.id);
    }
  });

  test('Import dialog rejects unsupported files and previews a framework export', async ({ blueprintAuthenticatedPage: page }) => {
    await gotoBlueprintAdminSection(page, 'Competencies');
    const dialog = await openImportDialog(page);
    const importButton = dialog.getByRole('button', { name: 'Import', exact: true });

    // 1. Nothing chosen yet: nothing to import.
    await expect(importButton).toBeDisabled();

    // 2. An unsupported extension is refused client-side, with no preview section.
    await chooseFile(page, { name: 'framework.txt', mimeType: 'text/plain', buffer: Buffer.from('not a framework') }, false);
    await expect(dialog.getByText('framework.txt')).toBeVisible();
    await expect(dialog.getByText('Supported formats: .csv (Moodle), .json (NICE), .xlsx (DCWF)')).toBeVisible();
    await expect(dialog.getByLabel('Source')).toHaveCount(0);
    await expect(importButton).toBeDisabled();

    // 3. A JSON export is previewed: its name, source, version and counts fill the dialog,
    //    and the earlier error is cleared.
    await chooseFile(page, nativeFrameworkFile(frameworkName, uniqueIdNumber()), true);
    await expect(dialog.getByText('spec-framework.json')).toBeVisible();
    await expect(dialog.getByText('Supported formats: .csv (Moodle)')).toHaveCount(0);
    await expect(dialog.locator('.preview-field')).toHaveText(`Framework Name: ${frameworkName}`);
    await expect(dialog.getByLabel('Source')).toHaveValue('SPEC-IMPORT');
    await expect(dialog.getByLabel('Version')).toHaveValue('1.2');
    await expect(dialog.getByText('Competencies to import: 3')).toBeVisible();
    await expect(dialog.getByText('Relationships: 2')).toBeVisible();
    await expect(importButton).toBeEnabled();

    // 4. Cancel closes the dialog without importing anything.
    await dialog.getByRole('button', { name: 'Cancel' }).click();
    await expect(dialog).toBeHidden();
    await page.getByPlaceholder('Search').first().fill(frameworkName);
    await expect(page.getByText('No Competency Frameworks found')).toBeVisible();
  });

  test('Import preview reports a framework ID number that is already taken', async ({ blueprintAuthenticatedPage: page }) => {
    const token = await getBlueprintToken();
    const idNumber = uniqueIdNumber();
    const existing = await createCompetencyFramework(token, { name: frameworkName, version: '3.0', idNumber });

    await gotoBlueprintAdminSection(page, 'Competencies');
    const dialog = await openImportDialog(page);
    await chooseFile(page, nativeFrameworkFile(tempBlueprintName('ImportFwDup'), idNumber), true);

    await expect(dialog.locator('.error-message')).toContainText(
      `A competency framework with ID number '${idNumber}' already exists: '${existing.name}' (version 3.0).`
    );
    // The conflict short-circuits the preview, so no counts are shown.
    await expect(dialog.getByText(/Competencies to import:/)).toHaveCount(0);

    await dialog.getByRole('button', { name: 'Cancel' }).click();
    await expect(dialog).toBeHidden();
  });

  test('Import shows polled progress, then success, and lists the framework', async ({ blueprintAuthenticatedPage: page }) => {
    await gotoBlueprintAdminSection(page, 'Competencies');
    const dialog = await openImportDialog(page);
    await chooseFile(page, nativeFrameworkFile(frameworkName, uniqueIdNumber()), true);

    // A three-item import finishes long before the first progress poll, so the progress bar
    // would never be seen. Let the request reach the API but hold its response: the dialog
    // then stays in its running state, and everything it shows comes from its own polling.
    let releaseImport!: () => void;
    const importHeld = new Promise<void>((resolve) => (releaseImport = resolve));
    await page.route(/\/api\/competencyframeworks\/import-json/i, async (route) => {
      const response = await route.fetch();
      await importHeld;
      await route.fulfill({ response });
    });

    try {
      // Pending upstream: the dialog offers editable Source and Version fields for a JSON
      // file, but the host sends only the file and importId to import-json (which takes no
      // source/version), so an edit here is silently dropped and the framework keeps the
      // file's values. Step 3 asserts the file's version until the edit is honoured (or the
      // fields are made read-only for JSON).
      await fillDialogFields([[dialog.getByLabel('Version'), '9.9']]);

      // 1. Start the import. The button locks and a determinate bar appears.
      const importButton = dialog.getByRole('button', { name: 'Import', exact: true });
      await importButton.click();
      await expect(importButton).toBeDisabled();
      const bar = dialog.locator('mat-progress-bar');
      await expect(bar).toBeVisible();

      // 2. With the response still held, the polled status reaches Complete / 100%.
      const status = dialog.locator('.import-progress-status');
      await expect(status).toContainText('Complete', { timeout: 20000 });
      await expect(status).toContainText('100%');
      await expect(bar).toHaveAttribute('aria-valuenow', '100');
      await expect(dialog.locator('.success-banner')).toHaveCount(0);

      // 3. Release the response: the dialog reports success and offers only Close.
      releaseImport();
      await expect(dialog.locator('.success-banner')).toHaveText(`Successfully imported ${frameworkName}`);
      await expect(dialog.getByRole('button', { name: 'Close' })).toBeVisible();
      await expect(dialog.getByRole('button', { name: 'Import', exact: true })).toHaveCount(0);
      await expect(dialog.getByRole('button', { name: 'Cancel' })).toHaveCount(0);

      await dialog.getByRole('button', { name: 'Close' }).click();
      await expect(dialog).toBeHidden();

      // 4. The framework is in the table with the file's metadata, and expanding it shows
      //    the work role split from the task and knowledge items.
      await page.getByPlaceholder('Search').first().fill(frameworkName);
      const row = page.locator('mat-row.element-row').filter({ hasText: frameworkName });
      await expect(row).toHaveCount(1);
      await expect(row.locator('mat-cell.column-source')).toHaveText('SPEC-IMPORT');
      await expect(row.locator('mat-cell.column-version')).toHaveText('1.2');

      await row.click();
      const detail = page.locator('mat-row.detail-row').filter({ has: page.locator('.section-panel') });
      await expect(detail.getByText('Work Roles (1)')).toBeVisible();
      await expect(detail.getByText('Competencies (2)')).toBeVisible();
    } finally {
      releaseImport();
      await page.unrouteAll({ behavior: 'ignoreErrors' });
    }
  });

  test('Download a framework as JSON', async ({ blueprintAuthenticatedPage: page }) => {
    const token = await getBlueprintToken();
    await createCompetencyFramework(token, {
      name: frameworkName,
      version: '4.1',
      competencies: [
        { idNumber: 'SPEC-WRL-811', shortName: 'Downloaded work role' },
        { idNumber: 'K0811', shortName: 'Downloaded knowledge', parentIdNumber: 'SPEC-WRL-811' },
      ],
    });

    await gotoBlueprintAdminSection(page, 'Competencies');
    await page.getByPlaceholder('Search').first().fill(frameworkName);
    const row = page.locator('mat-row.element-row').filter({ hasText: frameworkName });
    await expect(row).toHaveCount(1);

    const downloadEvent = page.waitForEvent('download');
    await row.getByTitle(`Download ${frameworkName} as JSON`).click();
    const download = await downloadEvent;

    // The file is named "<name>-<version>.json" with anything outside [A-Za-z0-9.-] replaced.
    expect(download.suggestedFilename()).toBe(
      `${frameworkName}-4.1.json`.replace(/[^a-z0-9.-]/gi, '_')
    );
    const body = JSON.parse((await (await download.createReadStream()).toArray()).join(''));
    expect(body.name).toBe(frameworkName);
    expect(body.version).toBe('4.1');
    expect(body.competencies.map((c: any) => c.idNumber).sort()).toEqual(['K0811', 'SPEC-WRL-811']);
  });
});
