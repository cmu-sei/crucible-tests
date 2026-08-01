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
test.describe('Export and Import', () => {
  let token: string;
  let mselId: string;
  let mselName: string;

  test.beforeEach(async () => {
    token = await getBlueprintToken();
    mselName = tempBlueprintName('TestBP-Export');
    const msel = await createMsel(token, { name: mselName, description: 'Seeded for export' });
    mselId = msel.id;

    // Give the export something to contain.
    await createRenderableScenarioEvent(token, mselId, 'Exported event', { deltaSeconds: 300 });
  });

  test.afterEach(async () => {
    try {
      if (mselId) await deleteMsel(token, mselId);
    } catch (err) {
      console.warn(`Cleanup failed for MSEL ${mselId}: ${err}`);
    }
  });

  test('Export MSEL to CSV', async ({ blueprintAuthenticatedPage: page }) => {
    await page.goto(`${Services.Blueprint.UI}/build`, { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('table').first()).toBeVisible({ timeout: 15000 });

    // Search narrows the paginated list onto this test's own row.
    const mselRow = await findMselRowByName(page, mselName);
    await expect(mselRow).toBeVisible();

    /** Open the row's Download menu and save the given format, returning the download. */
    const downloadFormat = async (menuItem: RegExp) => {
      await mselRow.locator('button[title^="Download "]').click();

      const option = page.getByRole('menuitem', { name: menuItem });
      await expect(option).toBeVisible({ timeout: 10000 });

      const downloadPromise = page.waitForEvent('download', { timeout: 30000 });
      await option.click();
      return downloadPromise;
    };

    // --- xlsx ---
    const xlsx = await downloadFormat(/Download xlsx file/i);
    expect(xlsx.suggestedFilename()).toMatch(/\.xlsx$/i);

    const xlsxPath = await xlsx.path();
    expect(xlsxPath, 'xlsx download produced no file on disk').toBeTruthy();
    expect(fs.statSync(xlsxPath!).size).toBeGreaterThan(0);

    // --- json ---
    const json = await downloadFormat(/Download json file/i);
    expect(json.suggestedFilename()).toMatch(/\.json$/i);

    const jsonPath = await json.path();
    expect(jsonPath, 'json download produced no file on disk').toBeTruthy();
    expect(fs.statSync(jsonPath!).size).toBeGreaterThan(0);

    // The JSON export must actually describe the seeded MSEL, not merely be non-empty.
    const exported = JSON.parse(fs.readFileSync(jsonPath!, 'utf8'));
    expect(JSON.stringify(exported)).toContain(mselName);
  });
});
