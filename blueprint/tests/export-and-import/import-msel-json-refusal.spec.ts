// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: specs/blueprint-test-plan.md

import { test, expect, Services } from '../../fixtures';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { getBlueprintToken, deleteMsel, tempBlueprintName } from '../../test-helpers';

/**
 * A JSON upload that is not a Blueprint MSEL is refused: the import dialog says why, and no MSEL is
 * made. Any JSON object used to deserialize into an empty, unnamed MSEL.
 */
test.describe('MSEL JSON import refusal', () => {
  let token: string;
  let filePath: string;
  let mselIdsBefore: Set<string>;

  async function mselIds(): Promise<Set<string>> {
    const res = await fetch(`${Services.Blueprint.API}/api/msels`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.ok, `listing MSELs failed: ${res.status}`).toBe(true);
    return new Set(((await res.json()) as { id: string }[]).map((m) => m.id));
  }

  test.beforeEach(async () => {
    token = await getBlueprintToken();
    filePath = path.join(os.tmpdir(), `${tempBlueprintName('TestBP-NotAMsel')}.json`);
    fs.writeFileSync(filePath, JSON.stringify({ not: 'a msel' }));
    mselIdsBefore = await mselIds();
  });

  test.afterEach(async () => {
    // a Blueprint without the check makes a MSEL from the file; leave nothing behind either way
    for (const id of await mselIds()) {
      if (!mselIdsBefore.has(id)) await deleteMsel(token, id);
    }
    if (filePath && fs.existsSync(filePath)) fs.unlinkSync(filePath);
  });

  test('Uploading JSON that is not a MSEL says why and creates nothing', async ({
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
    expect(response.status()).toBe(400);

    const dialog = page.getByRole('dialog');
    await expect(dialog.getByRole('alert')).toContainText('The file is not a Blueprint MSEL. Upload a file downloaded from Blueprint.');

    expect(await mselIds()).toEqual(mselIdsBefore);
  });
});
