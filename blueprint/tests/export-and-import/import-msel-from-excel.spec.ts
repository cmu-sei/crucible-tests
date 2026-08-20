// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: specs/blueprint-test-plan.md

import { test, expect, Services } from '../../fixtures';
import fs from 'fs';
import os from 'os';
import path from 'path';
import {
  getBlueprintToken,
  createMsel,
  deleteMsel,
  createRenderableScenarioEvent,
  tempBlueprintName,
  findMselRowByName,
} from '../../test-helpers';

/**
 * Round-trip: export a seeded MSEL to xlsx, re-import it, and confirm a new MSEL is created.
 *
 * Rewritten. The previous version exported the pre-existing `Standard MSEL` as its fixture,
 * which (a) breaks the rule that a test creates its own data, (b) made the result depend on
 * whatever other tests had done to that MSEL, and (c) is the very template this suite copies
 * data fields from. It also finished with `networkidle` + a 3s sleep and then asserted on
 * *any* row whose description matched /Uploaded from/ — which passes on a leftover import from
 * an earlier run rather than the one under test.
 *
 * Now: seed a uniquely-named MSEL, export it, import that file, and assert a MSEL derived from
 * the seeded name exists. The source and every imported copy are deleted through the API in
 * teardown, so nothing leaks even if the body fails midway.
 */
test.describe('Export and Import', () => {
  let token: string;
  let sourceMselId: string;
  let sourceMselName: string;
  let downloadPath: string | undefined;

  test.beforeEach(async () => {
    token = await getBlueprintToken();
    sourceMselName = tempBlueprintName('TestBP-Roundtrip');
    const msel = await createMsel(token, {
      name: sourceMselName,
      description: 'Seeded as import fixture',
    });
    sourceMselId = msel.id;

    await createRenderableScenarioEvent(token, sourceMselId, 'Round-trip event', {
      deltaSeconds: 300,
    });
    downloadPath = undefined;
  });

  test.afterEach(async () => {
    // Remove the source MSEL and anything the import created. Imported copies carry a name
    // derived from the source, so matching on the seeded name catches them all.
    try {
      const res = await fetch(`${Services.Blueprint.API}/api/msels`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const msels = (await res.json()) as Array<{ id: string; name: string }>;
        for (const msel of msels.filter((m) => m.name?.includes(sourceMselName))) {
          await deleteMsel(token, msel.id);
        }
      }
      if (sourceMselId) await deleteMsel(token, sourceMselId);
    } catch (err) {
      console.warn(`Cleanup failed for round-trip MSELs of "${sourceMselName}": ${err}`);
    }

    if (downloadPath && fs.existsSync(downloadPath)) {
      fs.unlinkSync(downloadPath);
    }
  });

  test('Import MSEL from Excel', async ({ blueprintAuthenticatedPage: page }) => {
    await page.goto(`${Services.Blueprint.UI}/build`, { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('table').first()).toBeVisible({ timeout: 15000 });

    // This spec opens two different mat-menus in sequence (Download, then Upload). A menu
    // still running its close animation leaves the outgoing overlay in the DOM, so the next
    // menu item resolves but the click lands on the stale panel and times out — the observed
    // failure was exactly that ("waiting for getByRole('menuitem', {name: /Download xlsx
    // file/i}) - locator resolved to <button role=menuitem ...>", 10s). Settling on zero menu
    // panels between opens makes the sequence deterministic.
    const menuPanel = page.locator('.mat-mdc-menu-panel');

    // 1. Export the seeded MSEL to use as the import fixture.
    const sourceRow = await findMselRowByName(page, sourceMselName);
    await expect(sourceRow).toBeVisible();

    await expect(menuPanel).toHaveCount(0);
    await sourceRow.locator('button[title^="Download "]').click();

    const xlsxOption = page.getByRole('menuitem', { name: /Download xlsx file/i });
    await expect(xlsxOption).toBeVisible({ timeout: 10000 });

    const downloadPromise = page.waitForEvent('download', { timeout: 30000 });
    await xlsxOption.click();
    const download = await downloadPromise;
    await expect(menuPanel).toHaveCount(0);

    // saveAs works when the browser runs remotely, unlike relying on path().
    downloadPath = path.join(os.tmpdir(), `msel-import-${sourceMselName}.xlsx`);
    await download.saveAs(downloadPath);
    expect(fs.statSync(downloadPath).size).toBeGreaterThan(0);

    // 2. Import it back, pairing the upload with the POST it triggers.
    const uploadButton = page.getByRole('button', { name: /Upload a new MSEL from a file/i });
    await expect(uploadButton).toBeVisible({ timeout: 10000 });
    await uploadButton.click();

    const uploadXlsxMenuItem = page.getByRole('menuitem', { name: /Upload xlsx file/i });
    await expect(uploadXlsxMenuItem).toBeVisible({ timeout: 10000 });

    const fileChooserPromise = page.waitForEvent('filechooser');
    const importResponse = page.waitForResponse(
      (r) => /\/api\/msels/i.test(r.url()) && r.request().method() === 'POST',
      { timeout: 60000 }
    );
    await uploadXlsxMenuItem.click();
    (await fileChooserPromise).setFiles(downloadPath);

    expect((await importResponse).ok()).toBe(true);

    // 3. A NEW MSEL derived from the seeded one now exists. Asserted via the API so a stale
    //    row from an earlier run cannot satisfy it.
    const listRes = await fetch(`${Services.Blueprint.API}/api/msels`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(listRes.ok).toBe(true);
    const msels = (await listRes.json()) as Array<{ id: string; name: string }>;

    const derived = msels.filter((m) => m.name?.includes(sourceMselName));
    expect(
      derived.length,
      `expected an imported copy alongside the source MSEL "${sourceMselName}"`
    ).toBeGreaterThan(1);
  });
});
