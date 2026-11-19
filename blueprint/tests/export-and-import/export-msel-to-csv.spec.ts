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
 * Downloading a MSEL as a spreadsheet from the /build list's Download menu.
 *
 * Rewritten: the previous version asserted against a pre-existing MSEL named `HSEEP`
 * ("MSEL list is displayed with system MSELs"), which violates CLAUDE.md's rule that every
 * test creates what it needs — it passed or failed based on whatever the dev database
 * happened to contain, and would silently stop testing anything if that row were renamed.
 * It also navigated via "Manage an Event" with two `networkidle` waits.
 *
 * The spec name says CSV, but the app's menu offers "Download json file" and
 * "Download xlsx file" (see `msel-list.component.html`) — there is no CSV export on this
 * surface. Both real options are exercised here, with assertions matching what the app
 * actually produces. The filename is left to the app; only the extension is asserted.
 */
// One MSEL with the standard DataFields (13 POSTs) is seeded per file and shared by both
// theme runs. Safe to share: the test only downloads the MSEL.
// Each test seeds its own uniquely named events, and `resetSharedRenderableMsel` removes
// them (and any extra DataField) in afterEach.
let shared: CreatedMsel;

test.beforeAll(async ({}, workerInfo) => {
  shared = await createSharedRenderableMsel(await getBlueprintToken(), 'CsvExport', workerInfo.parallelIndex);
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

      // Give the export something to contain.
      await createRenderableScenarioEvent(token, mselId, child('TestBP-CsvExportEvent'), { deltaSeconds: 300 });
    });

    test.afterEach(async () => {
      // Back to "standard DataFields, no events" for the next test on the shared MSEL.
      await resetSharedRenderableMsel(token, mselId);
    });

    test('Export MSEL to CSV', async ({ blueprintAuthenticatedPage: page }) => {
    await applyBlueprintTheme(page, theme);
      await page.goto(`${Services.Blueprint.UI}/build`, { waitUntil: 'domcontentloaded' });
      await expect(page.getByRole('table').first()).toBeVisible({ timeout: 15000 });

      // Search narrows the paginated list onto this test's own row.
      const mselRow = await findMselRowByName(page, mselName);
      await expect(mselRow).toBeVisible();

      // Both formats go through `downloadMselFile`, which settles the mat-menu overlay before and
      // after each open — necessary here in particular, since this spec opens the same menu twice.

      // --- xlsx ---
      const xlsx = await downloadMselFile(page, mselRow, /Download xlsx file/i);
      expect(xlsx.suggestedFilename()).toMatch(/\.xlsx$/i);

      const xlsxPath = await xlsx.path();
      expect(xlsxPath, 'xlsx download produced no file on disk').toBeTruthy();
      expect(fs.statSync(xlsxPath!).size).toBeGreaterThan(0);

      // --- json ---
      const json = await downloadMselFile(page, mselRow, /Download json file/i);
      expect(json.suggestedFilename()).toMatch(/\.json$/i);

      const jsonPath = await json.path();
      expect(jsonPath, 'json download produced no file on disk').toBeTruthy();
      expect(fs.statSync(jsonPath!).size).toBeGreaterThan(0);

      // The JSON export must actually describe the seeded MSEL, not merely be non-empty.
      const exported = JSON.parse(fs.readFileSync(jsonPath!, 'utf8'));
      expect(JSON.stringify(exported)).toContain(mselName);
    });
    });
}