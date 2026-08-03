// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: specs/blueprint-test-plan.md
// seed: tests/seed.spec.ts

import { test, expect, Services } from '../../fixtures';
import fs from 'fs';
import os from 'os';
import path from 'path';
import zlib from 'zlib';
import {
  getBlueprintToken,
  createMsel,
  deleteMsel,
  createRenderableScenarioEvent,
  setScenarioEventFieldValue,
  tempBlueprintName,
  findMselRowByName,
} from '../../test-helpers';

/**
 * Reads a single named entry out of a zip archive (an xlsx workbook is a zip of XML parts)
 * without adding a dependency. Walks the end-of-central-directory record to find the central
 * directory, locates the entry's local file header from there, and inflates its data with
 * Node's built-in zlib when the entry is DEFLATE-compressed (method 8) — verified against a
 * real Blueprint xlsx download that this is how the app's OpenXML writer stores its parts.
 */
function readZipEntryText(buffer: Buffer, entryName: string): string | null {
  let eocdOffset = -1;
  for (let i = buffer.length - 22; i >= 0; i--) {
    if (buffer.readUInt32LE(i) === 0x06054b50) {
      eocdOffset = i;
      break;
    }
  }
  if (eocdOffset === -1) {
    throw new Error('Not a valid zip file: end-of-central-directory record not found');
  }

  const centralDirOffset = buffer.readUInt32LE(eocdOffset + 16);
  const entryCount = buffer.readUInt16LE(eocdOffset + 10);

  let cursor = centralDirOffset;
  for (let i = 0; i < entryCount; i++) {
    if (buffer.readUInt32LE(cursor) !== 0x02014b50) break; // central directory file header signature
    const compressedSize = buffer.readUInt32LE(cursor + 20);
    const fileNameLength = buffer.readUInt16LE(cursor + 28);
    const extraFieldLength = buffer.readUInt16LE(cursor + 30);
    const fileCommentLength = buffer.readUInt16LE(cursor + 32);
    const localHeaderOffset = buffer.readUInt32LE(cursor + 42);
    const fileName = buffer.toString('utf8', cursor + 46, cursor + 46 + fileNameLength);

    if (fileName === entryName) {
      const localFileNameLength = buffer.readUInt16LE(localHeaderOffset + 26);
      const localExtraFieldLength = buffer.readUInt16LE(localHeaderOffset + 28);
      const compressionMethod = buffer.readUInt16LE(localHeaderOffset + 8);
      const dataStart = localHeaderOffset + 30 + localFileNameLength + localExtraFieldLength;
      const compressedData = buffer.subarray(dataStart, dataStart + compressedSize);
      const raw = compressionMethod === 8 ? zlib.inflateRawSync(compressedData) : compressedData;
      return raw.toString('utf8');
    }
    cursor += 46 + fileNameLength + extraFieldLength + fileCommentLength;
  }
  return null;
}

/** Extracts the inner XML of a single `<x:row r="N">...</x:row>` element from a sheet's XML. */
function extractRowXml(sheetXml: string, rowNumber: number): string {
  const match = sheetXml.match(new RegExp(`<x:row r="${rowNumber}"[^>]*>([\\s\\S]*?)</x:row>`));
  return match ? match[1] : '';
}

/**
 * Exporting the Scenario Events grid, asserting the downloaded workbook actually contains the
 * seeded events' content and DataField columns.
 *
 * `export-msel-to-excel.spec.ts` and `export-msel-to-csv.spec.ts` already cover this same
 * Download menu, but only assert the file is a well-formed, non-empty archive (magic bytes,
 * `size > 0`) or — for the JSON option — that it contains the MSEL's name. Plan item 11.7
 * explicitly calls out "with all events and data fields", so this spec is the one that actually
 * opens the workbook: it asserts the header row carries every seeded DataField name (not just
 * one) and the data row carries the seeded event's real text in two different DataField
 * columns, proving the export is complete rather than merely present.
 *
 * Verified app facts this spec relies on (see blueprint/test-helpers.ts, and the "Skipped
 * tests" table in README.md, for more detail):
 *   - A MSEL from `POST /api/msels` has zero DataFields, so `seedMselDataFields` (invoked via
 *     `createRenderableScenarioEvent`) must copy the 13-field "Standard MSEL" set first, or the
 *     export has no columns to check.
 *   - A ScenarioEvent's visible text lives in `DataValue` rows, not a `description` column, so
 *     the marker text is written through `createRenderableScenarioEvent` /
 *     `setScenarioEventFieldValue`.
 *   - `GET /api/msels/{id}/xlsx` writes each cell as an inline string (`t="str"`) with no
 *     `xl/sharedStrings.xml` part in the workbook, so the seeded text is read directly out of
 *     `xl/worksheets/sheet1.xml`. The scenario-events LIST endpoint dropping
 *     `dataValues` does not apply here — the export reads straight from the database via
 *     `GetMselDataAsync`, not the list projection the grid uses.
 *   - `showTimeOnScenarioEventList` / `...Move...` / `...Group...` all default to `false` on a
 *     freshly created MSEL, so the "Time"/"Move"/"Group" system columns are absent from this
 *     export; only DataField columns are asserted on here, since those are the ones guaranteed
 *     present once seeded.
 */
test.describe('Scenario Events Management', () => {
  let token: string;
  let mselId: string;
  let mselName: string;
  let descriptionMarker: string;
  let controlNumberMarker: string;
  let downloadPath: string | undefined;

  test.beforeEach(async () => {
    token = await getBlueprintToken();
    mselName = tempBlueprintName('TestBP-EventExport');
    const msel = await createMsel(token, {
      name: mselName,
      description: 'Seeded for scenario event export',
    });
    mselId = msel.id;

    descriptionMarker = tempBlueprintName('ExportedDescription');
    const event = await createRenderableScenarioEvent(token, mselId, descriptionMarker, {
      deltaSeconds: 300,
    });

    // A second DataField value on the same event, so the export is proven to carry more than
    // one column's worth of event data — the plan explicitly calls out "all ... data fields".
    controlNumberMarker = tempBlueprintName('ExportedControl');
    await setScenarioEventFieldValue(token, event.id, 'Control Number', controlNumberMarker);

    downloadPath = undefined;
  });

  test.afterEach(async () => {
    // Deleting the MSEL cascades to its scenario events and data fields.
    try {
      if (mselId) await deleteMsel(token, mselId);
    } catch (err) {
      console.warn(`Cleanup failed for MSEL ${mselId}: ${err}`);
    }
    if (downloadPath && fs.existsSync(downloadPath)) {
      fs.unlinkSync(downloadPath);
    }
  });

  test('Export Scenario Events', async ({ blueprintAuthenticatedPage: page }) => {
    await page.goto(`${Services.Blueprint.UI}/build`, { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('table').first()).toBeVisible({ timeout: 15000 });

    // 1. Click 'Export' or download button and select a format.
    const mselRow = await findMselRowByName(page, mselName);
    await expect(mselRow).toBeVisible();
    await mselRow.locator('button[title^="Download "]').click();

    const xlsxOption = page.getByRole('menuitem', { name: /Download xlsx file/i });
    await expect(xlsxOption).toBeVisible({ timeout: 10000 });

    const downloadPromise = page.waitForEvent('download', { timeout: 30000 });
    await xlsxOption.click();
    const download = await downloadPromise;

    // expect: File is generated and downloaded with all events and data fields.
    expect(download.suggestedFilename()).toMatch(/\.xlsx$/i);

    // saveAs works when the browser runs remotely, unlike relying on path() alone.
    downloadPath = path.join(os.tmpdir(), `scenario-event-export-${mselName}.xlsx`);
    await download.saveAs(downloadPath);
    const fileBuffer = fs.readFileSync(downloadPath);
    expect(fileBuffer.subarray(0, 2).toString('latin1')).toBe('PK');

    const sheetXml = readZipEntryText(fileBuffer, 'xl/worksheets/sheet1.xml');
    expect(sheetXml, 'exported xlsx has no xl/worksheets/sheet1.xml entry').toBeTruthy();

    // The header row (row 1) carries every seeded DataField, not just the two this test
    // happens to read values from.
    const headerRowXml = extractRowXml(sheetXml!, 1);
    expect(headerRowXml, 'no header row (row 1) found in the exported sheet').toBeTruthy();
    for (const fieldName of [
      'Control Number',
      'Move',
      'Group',
      'Delivery Time',
      'Simulated Time',
      'Assigned To',
      'Status',
      'Title',
      'Description',
      'From Org',
      'To Org',
      'Expected Actions',
      'Details',
    ]) {
      expect(headerRowXml).toContain(fieldName);
    }

    // The data row (row 2 — the single seeded event) carries the actual seeded content in
    // both DataField columns it was written to, proving the export round-trips real data
    // rather than just producing an empty template.
    const dataRowXml = extractRowXml(sheetXml!, 2);
    expect(dataRowXml, 'no data row (row 2) found in the exported sheet').toBeTruthy();
    expect(dataRowXml).toContain(descriptionMarker);
    expect(dataRowXml).toContain(controlNumberMarker);
  });
});
