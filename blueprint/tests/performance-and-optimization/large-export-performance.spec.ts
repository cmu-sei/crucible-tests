// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: specs/blueprint-test-plan.md

import { test, expect, Services } from '../../fixtures';
import fs from 'fs';
import {
  getBlueprintToken,
  createMsel,
  deleteMsel,
  createScenarioEvent,
  listScenarioEvents,
  seedMselDataFields,
  findMselRowByName,
  tempBlueprintName,
} from '../../test-helpers';

/**
 * Exporting an event-heavy MSEL: the download completes in reasonable time, the page stays
 * responsive while it runs, and the workbook is real.
 *
 * Rewritten. The previous version asserted the **absence** of test data as a pass condition:
 *
 *   } else {
 *     console.log('No MSELs found - test requires existing MSEL data with events');
 *     expect(hasMsel).toBe(false);        // <-- passes BECAUSE nothing was found
 *   }
 *
 * and the inner branch did the same for the export button (`expect(hasExportButton).toBe(false)`).
 * It reached those branches every run, because it navigated to `${UI}/msels` — not a Blueprint
 * route (the routes are '', build, join, launch, manage, starter, assess, msel/:mselid/view,
 * mselpage/:id, admin, eventdetail), so `a[href*="/msel/"]` matched nothing. The run log records
 * it: "No MSELs found - test requires existing MSEL data with events". Nothing was exported and
 * nothing was measured; the only assertion that ran was
 * `expect(document.readyState === 'complete').toBe(true)`.
 *
 * It also depended on pre-existing data, which AGENTS.md forbids, and drove the export through
 * `button:has-text("Export")` / a menu item "Excel" — neither exists. The real control is a
 * per-row `button[title^="Download "]` opening a menu whose item is "Download xlsx file".
 *
 * This version seeds a MSEL with 60 scenario events, exports it through that real control, and
 * measures. 60 rather than the plan's 500: seeding is one API call per event, and 60 is enough
 * to make the export non-trivial while keeping `beforeEach` quick. The count is asserted, so the
 * spec states the size it actually tested instead of implying 500.
 */
test.describe('Performance and Optimization', () => {
  const EVENT_COUNT = 60;

  let token: string;
  let mselId: string;
  let mselName: string;

  test.beforeEach(async () => {
    token = await getBlueprintToken();
    mselName = tempBlueprintName('TestBP-ExportPerf');
    const msel = await createMsel(token, {
      name: mselName,
      description: 'Seeded to measure export performance.',
    });
    mselId = msel.id;

    // DataFields once, then the events. `createScenarioEvent` is used directly rather than
    // `createRenderableScenarioEvent` because the cell text is irrelevant here and skipping the
    // per-event DataValue write keeps setup to one call per event.
    await seedMselDataFields(token, mselId);
    for (let i = 0; i < EVENT_COUNT; i++) {
      await createScenarioEvent(token, mselId, { deltaSeconds: (i + 1) * 60 });
    }
  });

  test.afterEach(async () => {
    try {
      if (mselId) await deleteMsel(token, mselId);
    } catch (err) {
      console.warn(`Cleanup failed for MSEL ${mselId}: ${err}`);
    }
  });

  test('Large Export Performance', async ({ blueprintAuthenticatedPage: page }) => {
    // expect: the fixture really has the events this spec claims to export. Read through the
    // shared helper, which knows the endpoint is lowercase `/api/scenarioevents`.
    const seededEvents = await listScenarioEvents(token, mselId);
    expect(seededEvents.length, 'seeded scenario event count').toBe(EVENT_COUNT);

    await page.goto(`${Services.Blueprint.UI}/build`, { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('table').first()).toBeVisible({ timeout: 30000 });

    const mselRow = await findMselRowByName(page, mselName);
    await expect(mselRow).toBeVisible();

    await mselRow.locator('button[title^="Download "]').click();
    const xlsxOption = page.getByRole('menuitem', { name: /Download xlsx file/i });
    await expect(xlsxOption).toBeVisible({ timeout: 15000 });

    const downloadPromise = page.waitForEvent('download', { timeout: 60000 });
    const startedAt = Date.now();
    await xlsxOption.click();
    const download = await downloadPromise;
    const exportSeconds = (Date.now() - startedAt) / 1000;

    // expect: the export completes in reasonable time.
    expect(exportSeconds, `export of ${EVENT_COUNT} events took ${exportSeconds}s`).toBeLessThan(60);

    // expect: the page is still responsive afterwards — asserted by actually driving it, not by
    // reading `document.readyState` (which is 'complete' on a wedged page too, and was the old
    // version's only real check).
    await expect(page.getByRole('table').first()).toBeVisible({ timeout: 15000 });
    const searchBox = page.getByPlaceholder('Search').first();
    await expect(searchBox).toBeVisible({ timeout: 15000 });
    await searchBox.fill(mselName);
    await expect(searchBox).toHaveValue(mselName);

    // expect: a real workbook, not an error placeholder. xlsx is a zip, so it starts with "PK".
    expect(download.suggestedFilename()).toMatch(/\.xlsx?$/i);
    const downloadPath = await download.path();
    expect(downloadPath, 'export produced no file on disk').toBeTruthy();

    const contents = fs.readFileSync(downloadPath!);
    expect(contents.subarray(0, 2).toString('latin1')).toBe('PK');

    // expect: the file is neither empty nor implausibly large.
    const fileSizeMB = contents.length / 1024 / 1024;
    expect(contents.length).toBeGreaterThan(0);
    expect(fileSizeMB, `workbook was ${fileSizeMB.toFixed(2)} MB`).toBeLessThan(50);
  });
});
