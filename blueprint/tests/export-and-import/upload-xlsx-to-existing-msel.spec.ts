// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: specs/blueprint-test-plan.md

import { test, expect, Services } from '../../fixtures';
import {
  getBlueprintToken,
  createMsel,
  deleteMsel,
  getMsel,
  createRenderableScenarioEvent,
  listScenarioEvents,
  tempBlueprintName,
} from '../../test-helpers';

/**
 * Replacing an EXISTING MSEL's contents from an xlsx workbook.
 *
 * Two findings drove this rewrite:
 *
 * 1. **The previous spec drove a control that does not exist.** It clicked
 *    `Upload .xlsx file to Standard MSEL`; `grep` over the whole Angular app finds no such
 *    button. `msel-list.component.html` offers only the *global* "Upload a new MSEL from a
 *    file" menu (json/xlsx), which creates a NEW MSEL — that path is covered by
 *    `import-msel-from-excel.spec.ts`. Replacing an existing MSEL is currently **API-only**
 *    (`PUT /api/msels/{id}/xlsx`, `replaceWithXlsxFile`), so it is exercised at that level
 *    here. If a UI affordance is added later, extend this spec to cover it.
 *
 * 2. **Its assertions were vacuous.** After the upload it checked only that the URL still
 *    matched `/build` and that the `Standard MSEL` link was still visible — "the page didn't
 *    break" — which passes whether or not the upload did anything. It also mutated the shared
 *    `Standard MSEL` (the template this suite copies data fields from) and leaned on
 *    `networkidle` plus a 2s sleep.
 *
 * Contract note: the multipart field must be named **`ToUpload`** (`ViewModels/FileForm.cs`).
 * Posting it as `file` yields a 500 from a null `form.ToUpload` inside
 * `createMselFromXlsxFile` — a confusing failure, but the client's fault, not a Blueprint bug.
 */
test.describe('Export and Import', () => {
  let token: string;
  let mselId: string;
  let mselName: string;

  test.beforeEach(async () => {
    token = await getBlueprintToken();
    mselName = tempBlueprintName('TestBP-UploadTarget');
    const msel = await createMsel(token, {
      name: mselName,
      description: 'Seeded as xlsx replace target',
    });
    mselId = msel.id;

    await createRenderableScenarioEvent(token, mselId, 'Pre-replace event', { deltaSeconds: 120 });
  });

  test.afterEach(async () => {
    try {
      if (mselId) await deleteMsel(token, mselId);
    } catch (err) {
      console.warn(`Cleanup failed for MSEL ${mselId}: ${err}`);
    }
  });

  test('Upload XLSX to Existing MSEL', async () => {
    const authHeader = { Authorization: `Bearer ${token}` };
    const eventsBefore = (await listScenarioEvents(token, mselId)).length;
    expect(eventsBefore).toBeGreaterThan(0);

    // 1. Export the MSEL, so the workbook we upload is structurally valid by construction.
    const downloadRes = await fetch(`${Services.Blueprint.API}/api/msels/${mselId}/xlsx`, {
      headers: authHeader,
    });
    expect(downloadRes.ok, `xlsx download failed with ${downloadRes.status}`).toBe(true);

    const workbook = Buffer.from(await downloadRes.arrayBuffer());
    expect(workbook.length).toBeGreaterThan(0);
    // xlsx is a zip archive: the local-file-header magic must be "PK".
    expect(workbook.subarray(0, 2).toString('latin1')).toBe('PK');

    // 2. Replace the MSEL from that workbook. The field name must be `ToUpload`.
    const form = new FormData();
    form.append(
      'ToUpload',
      new Blob([workbook], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      }),
      `${mselName}.xlsx`
    );

    const replaceRes = await fetch(`${Services.Blueprint.API}/api/msels/${mselId}/xlsx`, {
      method: 'PUT',
      headers: authHeader,
      body: form,
    });
    expect(
      replaceRes.ok,
      `xlsx replace failed with ${replaceRes.status}: ${await replaceRes.text()}`
    ).toBe(true);

    // 3. The MSEL survived the replace with its identity and content intact.
    const after = await getMsel(token, mselId);
    expect(after.name).toBe(mselName);
    expect((await listScenarioEvents(token, mselId)).length).toBeGreaterThanOrEqual(eventsBefore);
  });
});
