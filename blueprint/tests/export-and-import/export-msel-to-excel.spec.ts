// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: specs/blueprint-test-plan.md

import { test, expect, Services } from '../../fixtures';
import fs from 'fs';
import {
  getBlueprintToken,
  createMsel,
  deleteMsel,
  createRenderableScenarioEvent,
  tempBlueprintName,
  findMselRowByName,
  downloadMselFile,
} from '../../test-helpers';

/**
 * Exporting a MSEL as xlsx, asserting the download is real and non-trivial.
 *
 * Rewritten: the previous version depended on a pre-existing MSEL named `Standard MSEL`
 * ("MSEL list is displayed with system MSELs"), which breaks CLAUDE.md's rule that a test
 * creates what it needs — and `Standard MSEL` is in fact the template this suite copies data
 * fields from, so exporting it was also testing whatever state other tests had left it in.
 * Navigation went through "Manage an Event" plus two `networkidle` waits.
 *
 * Now the MSEL is seeded (with a scenario event, so the workbook has content), located by
 * name via the list's search box, exported, and deleted in teardown.
 */
test.describe('Export and Import', () => {
  let token: string;
  let mselId: string;
  let mselName: string;

  test.beforeEach(async () => {
    token = await getBlueprintToken();
    mselName = tempBlueprintName('TestBP-Xlsx');
    const msel = await createMsel(token, {
      name: mselName,
      description: 'Seeded for xlsx export',
    });
    mselId = msel.id;

    await createRenderableScenarioEvent(token, mselId, 'Event in the workbook', {
      deltaSeconds: 600,
    });
  });

  test.afterEach(async () => {
    try {
      if (mselId) await deleteMsel(token, mselId);
    } catch (err) {
      console.warn(`Cleanup failed for MSEL ${mselId}: ${err}`);
    }
  });

  test('Export MSEL to Excel', async ({ blueprintAuthenticatedPage: page }) => {
    await page.goto(`${Services.Blueprint.UI}/build`, { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('table').first()).toBeVisible({ timeout: 15000 });

    const mselRow = await findMselRowByName(page, mselName);
    await expect(mselRow).toBeVisible();

    const download = await downloadMselFile(page, mselRow, /Download xlsx file/i);

    expect(download.suggestedFilename()).toMatch(/\.xlsx$/i);

    const downloadPath = await download.path();
    expect(downloadPath, 'xlsx download produced no file on disk').toBeTruthy();

    // A real workbook, not a zero-byte or error placeholder. xlsx is a zip archive, so the
    // first two bytes must be the local-file-header magic "PK".
    const contents = fs.readFileSync(downloadPath!);
    expect(contents.length).toBeGreaterThan(0);
    expect(contents.subarray(0, 2).toString('latin1')).toBe('PK');
  });
});
