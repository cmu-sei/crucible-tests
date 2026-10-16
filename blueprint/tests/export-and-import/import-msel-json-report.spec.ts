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
} from '../../test-helpers';

/**
 * A MSEL JSON import shows a report: what was imported, what the import changed, and an
 * Open MSEL button that goes to the new MSEL.
 *
 * Seeds a uniquely named MSEL with one scenario event, exports it as JSON through the API and
 * imports that file through the UI. The source still exists, so the import has to rename the
 * copy, and the report must say so under Changed.
 */
test.describe('MSEL JSON import report', () => {
  let token: string;
  let sourceMselId: string;
  let sourceMselName: string;
  let importedMselId: string | undefined;
  let filePath: string;

  test.beforeEach(async () => {
    token = await getBlueprintToken();
    sourceMselName = tempBlueprintName('TestBP-JsonImport');
    const msel = await createMsel(token, { name: sourceMselName });
    sourceMselId = msel.id;
    await createRenderableScenarioEvent(token, sourceMselId, 'Imported event', {
      deltaSeconds: 300,
    });
    importedMselId = undefined;

    const res = await fetch(`${Services.Blueprint.API}/api/msels/${sourceMselId}/json`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.ok, `export of ${sourceMselId} failed: ${res.status}`).toBe(true);
    filePath = path.join(os.tmpdir(), `${sourceMselName}.json`);
    fs.writeFileSync(filePath, Buffer.from(await res.arrayBuffer()));
  });

  test.afterEach(async () => {
    if (importedMselId) await deleteMsel(token, importedMselId);
    if (sourceMselId) await deleteMsel(token, sourceMselId);
    if (filePath && fs.existsSync(filePath)) fs.unlinkSync(filePath);
  });

  test('Import shows what was imported and changed, and Open MSEL opens it', async ({
    blueprintAuthenticatedPage: page,
  }) => {
    await page.goto(`${Services.Blueprint.UI}/build`, { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('table').first()).toBeVisible({ timeout: 15000 });

    await page.getByRole('button', { name: /Upload a new MSEL from a file/i }).click();
    const uploadJson = page.getByRole('menuitem', { name: /Upload json file/i });
    await expect(uploadJson).toBeVisible({ timeout: 10000 });

    const fileChooserPromise = page.waitForEvent('filechooser');
    const importResponse = page.waitForResponse(
      (r) => r.url().endsWith('/api/msels/json/import') && r.request().method() === 'POST',
      { timeout: 60000 }
    );
    await uploadJson.click();
    (await fileChooserPromise).setFiles(filePath);

    const response = await importResponse;
    expect(response.ok()).toBe(true);
    const result = await response.json();
    importedMselId = result.msel.id;
    expect(importedMselId).not.toBe(sourceMselId);

    const dialog = page.getByRole('dialog');
    await expect(dialog.getByText('Import MSEL')).toBeVisible();
    await expect(dialog.locator('.msel-name')).toHaveText(result.msel.name);

    // Imported: the one seeded scenario event came across.
    const scenarioEvents = dialog.locator('.count-list li', { hasText: 'Scenario Events' });
    await expect(scenarioEvents.locator('.count-value')).toHaveText('1');

    // Changed: the source still holds the name, so the copy was renamed.
    const changed = dialog.locator('section', { has: page.getByRole('heading', { name: 'Changed' }) });
    await expect(changed).toBeVisible();
    const rename = result.changes.find((c: { field: string }) => c.field === 'name');
    expect(rename, 'expected a name change in the import result').toBeTruthy();
    await expect(changed).toContainText(rename.message);

    // Open MSEL goes to the new MSEL's build page.
    await dialog.getByRole('button', { name: 'Open MSEL' }).click();
    await expect(dialog).toBeHidden();
    await expect(page).toHaveURL(new RegExp(`/build\\?msel=${importedMselId}`));
  });
});
