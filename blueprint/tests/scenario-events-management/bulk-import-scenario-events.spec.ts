// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: specs/blueprint-test-plan.md
// seed: tests/seed.spec.ts

import { test, expect, Services } from '../../fixtures';
import fs from 'fs';
import os from 'os';
import path from 'path';
import {
  getBlueprintToken,
  createMsel,
  deleteMsel,
  seedMselDataFields,
  createRenderableScenarioEvent,
  tempBlueprintName,
  listScenarioEvents,
  getScenarioEvent,
} from '../../test-helpers';

/**
 * Plan item 11.6 — Bulk Import Scenario Events.
 *
 * There is no per-existing-MSEL "Import Events" button in the Angular app (verified by
 * grepping every component under `blueprint.ui/src/app` for `uploadFile`/`xlsx` — the only
 * matches are the /build list's global "Upload a new MSEL from a file" menu and the admin
 * catalog list's JSON-only uploader). That global control is Blueprint's actual bulk-import
 * affordance for scenario events: uploading an .xlsx creates a brand-new MSEL whose rows
 * become scenario events. Replacing an EXISTING MSEL's events from a file is API-only
 * (`PUT /api/msels/{id}/xlsx`, covered by `upload-xlsx-to-existing-msel.spec.ts`) — there is
 * no UI control for it, so this spec exercises the control that actually exists.
 *
 * To guarantee the uploaded file is a structurally valid xlsx, this spec seeds its own source
 * MSEL via the API (with data fields and two renderable scenario events), then exports it
 * through the app itself before re-uploading that export.
 *
 * Import-time note: Blueprint's xlsx import does not carry each event's exported Delivery
 * Time through, assigning `deltaSeconds = rowIndex * 60` instead. This spec therefore does
 * not assert imported times survive the round-trip — a skipped spec covers that separately.
 * It asserts what this plan item actually calls for: the file is accepted, the events are
 * imported (count and content), and no error is surfaced.
 *
 * dataValues note: `GET /api/msels/{id}/scenarioEvents` omits `dataValues`, so the grid renders
 * blank cells. That endpoint is not used here — `POST /api/msels/xlsx`'s own response
 * includes each imported scenario event WITH its dataValues populated (verified directly
 * against the running API), so content is asserted from the upload response itself.
 *
 * Notification note: unlike newer import dialogs elsewhere in the app (e.g. the admin
 * Competency Framework importer, which renders a "Successfully imported ..." banner), the
 * MSEL xlsx uploader is an older bare menu-item + hidden `<input type="file">` flow with no
 * dialog and no snackbar/alert on success or failure (confirmed directly: after a successful
 * upload there are 0 `mat-snack-bar-container`/`[role="alert"]` elements on the page). So
 * "success notification shows number of events imported" is not implemented — there is no
 * notification at all. This is verified below (rather than skipped) so a regression that adds
 * an incorrect/misleading notification would also be caught.
 */
test.describe('Scenario Events Management', () => {
  let token: string;
  let sourceMselId: string;
  let sourceMselName: string;
  let importedMselId: string | undefined;
  let downloadPath: string | undefined;

  test.beforeEach(async () => {
    token = await getBlueprintToken();
    sourceMselName = tempBlueprintName('TestBP-BulkImportSrc');
    const msel = await createMsel(token, {
      name: sourceMselName,
      description: 'Seeded as bulk-import fixture',
    });
    sourceMselId = msel.id;
    await seedMselDataFields(token, sourceMselId);

    await createRenderableScenarioEvent(token, sourceMselId, 'Bulk import first event', {
      deltaSeconds: 300,
    });
    await createRenderableScenarioEvent(token, sourceMselId, 'Bulk import second event', {
      deltaSeconds: 900,
    });

    importedMselId = undefined;
    downloadPath = undefined;
  });

  test.afterEach(async () => {
    try {
      if (importedMselId) await deleteMsel(token, importedMselId);
    } catch (err) {
      console.warn(`Cleanup failed for imported MSEL ${importedMselId}: ${err}`);
    }
    try {
      if (sourceMselId) await deleteMsel(token, sourceMselId);
    } catch (err) {
      console.warn(`Cleanup failed for source MSEL ${sourceMselId}: ${err}`);
    }
    if (downloadPath && fs.existsSync(downloadPath)) {
      fs.unlinkSync(downloadPath);
    }
  });

  test('Bulk Import Scenario Events', async ({ blueprintAuthenticatedPage: page }) => {
    // 1. Click 'Import' or 'Upload Events' button in MSEL details and select a CSV or Excel
    //    file. Navigate to the MSEL list and export the seeded MSEL to get a guaranteed-valid
    //    xlsx fixture.
    await page.goto(`${Services.Blueprint.UI}/build`, { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('table').first()).toBeVisible({ timeout: 15000 });

    const searchBox = page.getByRole('textbox', { name: 'Search' });
    await searchBox.fill(sourceMselName);

    const sourceRow = page.getByRole('row').filter({ hasText: sourceMselName });
    await expect(sourceRow).toBeVisible({ timeout: 10000 });

    await sourceRow.getByRole('button', { name: /Download/i }).first().click();
    const downloadXlsxItem = page.getByRole('menuitem', { name: /Download xlsx file/i });
    await expect(downloadXlsxItem).toBeVisible({ timeout: 10000 });

    const downloadPromise = page.waitForEvent('download', { timeout: 30000 });
    await downloadXlsxItem.click();
    const download = await downloadPromise;

    downloadPath = path.join(os.tmpdir(), `bulk-import-${sourceMselName}.xlsx`);
    await download.saveAs(downloadPath);
    expect(fs.statSync(downloadPath).size).toBeGreaterThan(0);

    // Now select that file through Blueprint's bulk-import control: the list header's
    // "Upload a new MSEL from a file" button. This is the only file-based import affordance
    // for scenario events that exists in the UI (see file-level comment above).
    const uploadButton = page.getByRole('button', { name: /Upload a new MSEL from a file/i });
    await expect(uploadButton).toBeVisible({ timeout: 10000 });
    await uploadButton.click();

    const uploadXlsxItem = page.getByRole('menuitem', { name: /Upload xlsx file/i });
    await expect(uploadXlsxItem).toBeVisible({ timeout: 10000 });

    // 2. Confirm import: selecting the file itself submits — there is no separate confirm
    //    step in this control — so pair the file-chooser selection with the POST it triggers.
    const fileChooserPromise = page.waitForEvent('filechooser');
    const importResponsePromise = page.waitForResponse(
      (r) => /\/api\/msels\/xlsx/i.test(r.url()) && r.request().method() === 'POST',
      { timeout: 30000 }
    );
    await uploadXlsxItem.click();
    const fileChooser = await fileChooserPromise;
    await fileChooser.setFiles(downloadPath);

    // expect: File is uploaded and validated — the API accepts it and returns the created MSEL.
    const importResponse = await importResponsePromise;
    expect(importResponse.ok(), `import failed with ${importResponse.status()}`).toBe(true);
    const importedMsel = await importResponse.json();
    importedMselId = importedMsel.id;
    expect(importedMselId).toBeTruthy();

    // expect: Events are imported — the response's own scenarioEvents collection (unlike
    // GET /api/msels/{id}/scenarioEvents, which omits dataValues) already includes each
    // event's dataValues, so count and content are asserted directly from it.
    expect(importedMsel.scenarioEvents.length).toBe(2);
    const importedTexts = importedMsel.scenarioEvents.flatMap((se: any) =>
      (se.dataValues ?? []).map((dv: any) => dv.value).filter(Boolean)
    );
    expect(importedTexts).toEqual(
      expect.arrayContaining(['Bulk import first event', 'Bulk import second event'])
    );

    // Cross-check independently via the single-event endpoint (which does return dataValues),
    // confirming the import response was not a fluke of what the client happened to send back.
    const persistedEvents = await listScenarioEvents(token, importedMselId!);
    expect(persistedEvents.length).toBe(2);
    const persistedTexts: string[] = [];
    for (const event of persistedEvents) {
      const full = await getScenarioEvent(token, event.id);
      persistedTexts.push(...(full.dataValues ?? []).map((dv: any) => dv.value).filter(Boolean));
    }
    expect(persistedTexts).toEqual(
      expect.arrayContaining(['Bulk import first event', 'Bulk import second event'])
    );

    // expect: no error is surfaced for this successful import (see file-level Notification
    // note — the control has no success banner either, only the new row appearing in the list).
    await expect(
      page.locator('simple-snack-bar, mat-snack-bar-container, .mat-mdc-snack-bar-container')
    ).toHaveCount(0);
    await expect(page.getByRole('alert')).toHaveCount(0);

    // The new MSEL also appears in the list, confirming the import is reflected in the UI.
    await searchBox.fill(importedMsel.name);
    const importedRow = page.getByRole('row').filter({ hasText: sourceMselName }).filter({
      hasText: 'Uploaded from',
    });
    await expect(importedRow).toBeVisible({ timeout: 10000 });
  });
});
