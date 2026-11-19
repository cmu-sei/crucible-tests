// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: specs/blueprint-test-plan.md

import { test, expect, Services, BLUEPRINT_THEMES, applyBlueprintTheme } from '../../fixtures';
import fs from 'fs';
import os from 'os';
import path from 'path';
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
// One MSEL with the standard DataFields (13 POSTs) is seeded per file and shared by both
// theme runs. Safe to share: the test downloads the source and imports into a new MSEL of its own.
// Each test seeds its own uniquely named events, and `resetSharedRenderableMsel` removes
// them (and any extra DataField) in afterEach.
let shared: CreatedMsel;

test.beforeAll(async ({}, workerInfo) => {
  shared = await createSharedRenderableMsel(await getBlueprintToken(), 'Roundtrip', workerInfo.parallelIndex);
});

test.afterAll(async () => {
  if (shared) await deleteMsel(await getBlueprintToken(), shared.id);
});

for (const theme of BLUEPRINT_THEMES) {
    test.describe(`${theme} theme › Export and Import`, () => {
    // Per-test names for this test's own records on the shared MSEL.
    let child: (base: string) => string;
    let token: string;
    let sourceMselId: string;
    let sourceMselName: string;
    let downloadPath: string | undefined;

    test.beforeEach(async ({}, testInfo) => {
      child = (base: string) => sharedChildName(base, testInfo, theme);
      token = await getBlueprintToken();
      sourceMselId = shared.id;
      sourceMselName = shared.name;

      await createRenderableScenarioEvent(token, sourceMselId, child('TestBP-RoundtripEvent'), {
        deltaSeconds: 300,
      });
      downloadPath = undefined;
    });

    test.afterEach(async () => {
      // Remove anything the import created — imported copies carry a name derived from the
      // source, so matching on it catches them all — but not the shared source itself, which
      // goes back to "standard DataFields, no events".
      const res = await fetch(`${Services.Blueprint.API}/api/msels`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const msels = (await res.json()) as Array<{ id: string; name: string }>;
        for (const msel of msels.filter((m) => m.id !== sourceMselId && m.name?.includes(sourceMselName))) {
          await deleteMsel(token, msel.id);
        }
      }
      await resetSharedRenderableMsel(token, sourceMselId);
      if (downloadPath && fs.existsSync(downloadPath)) {
        fs.unlinkSync(downloadPath);
      }
    });

    test('Import MSEL from Excel', async ({ blueprintAuthenticatedPage: page }) => {
    await applyBlueprintTheme(page, theme);
      await page.goto(`${Services.Blueprint.UI}/build`, { waitUntil: 'domcontentloaded' });
      await expect(page.getByRole('table').first()).toBeVisible({ timeout: 15000 });

      // This spec opens two different mat-menus in sequence (Download, then Upload), so each open
      // has to start from a settled overlay — see `downloadMselFile`, which does that for the
      // Download menu and retries the pick.
      const menuPanel = page.locator('.mat-mdc-menu-panel');

      // 1. Export the seeded MSEL to use as the import fixture.
      const sourceRow = await findMselRowByName(page, sourceMselName);
      await expect(sourceRow).toBeVisible();

      const download = await downloadMselFile(page, sourceRow, /Download xlsx file/i);

      // saveAs works when the browser runs remotely, unlike relying on path().
      downloadPath = path.join(os.tmpdir(), `msel-import-${sourceMselName}.xlsx`);
      await download.saveAs(downloadPath);
      expect(fs.statSync(downloadPath).size).toBeGreaterThan(0);

      // 2. Import it back, pairing the upload with the POST it triggers.
      await expect(menuPanel).toHaveCount(0);
      const uploadButton = page.getByRole('button', { name: /Upload a new MSEL from a file/i });
      await expect(uploadButton).toBeVisible({ timeout: 10000 });
      await uploadButton.click();

      const uploadXlsxMenuItem = page.getByRole('menuitem', { name: /Upload xlsx file/i });
      await expect(uploadXlsxMenuItem).toBeVisible({ timeout: 10000 });

      const fileChooserPromise = page.waitForEvent('filechooser');
      const importResponse = page.waitForResponse(
        (r) => /\/api\/msels/i.test(r.url()) && r.request().method() === 'POST',
        { timeout: 30000 }
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
}