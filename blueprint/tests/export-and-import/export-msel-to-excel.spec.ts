// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: specs/blueprint-test-plan.md

import { test, expect, Services, BLUEPRINT_THEMES, applyBlueprintTheme } from '../../fixtures';
import fs from 'fs';
import {
  getBlueprintToken,
  deleteMsel,
  createRenderableScenarioEvent,
  findMselRowByName,
  downloadMselFile,
  createSharedRenderableMsel,
  resetSharedRenderableMsel,
  type CreatedMsel,
  sharedChildName,
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
// One MSEL with the standard DataFields (13 POSTs) is seeded per file and shared by both
// theme runs. Safe to share: the test only downloads the MSEL.
// Each test seeds its own uniquely named events, and `resetSharedRenderableMsel` removes
// them (and any extra DataField) in afterEach.
let shared: CreatedMsel;

test.beforeAll(async ({}, workerInfo) => {
  shared = await createSharedRenderableMsel(await getBlueprintToken(), 'XlsxExport', workerInfo.parallelIndex);
});

test.afterAll(async () => {
  if (shared) await deleteMsel(await getBlueprintToken(), shared.id);
});

for (const theme of BLUEPRINT_THEMES) {
    test.describe(`${theme} theme › Export and Import`, () => {
    // Per-test names for this test's own records on the shared MSEL.
    let child: (base: string) => string;
    let token: string;
    let mselId: string;
    let mselName: string;

    test.beforeEach(async ({}, testInfo) => {
      child = (base: string) => sharedChildName(base, testInfo, theme);
      token = await getBlueprintToken();
      mselId = shared.id;
      mselName = shared.name;

      await createRenderableScenarioEvent(token, mselId, child('TestBP-XlsxEvent'), {
        deltaSeconds: 600,
      });
    });

    test.afterEach(async () => {
      // Back to "standard DataFields, no events" for the next test on the shared MSEL.
      await resetSharedRenderableMsel(token, mselId);
    });

    test('Export MSEL to Excel', async ({ blueprintAuthenticatedPage: page }) => {
    await applyBlueprintTheme(page, theme);
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
}