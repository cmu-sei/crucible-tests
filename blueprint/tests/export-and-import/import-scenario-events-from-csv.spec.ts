// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: specs/blueprint-test-plan.md

import { test, expect, Services } from '../../fixtures';
import {
  getBlueprintToken,
  createMsel,
  deleteMsel,
  createRenderableScenarioEvent,
  listScenarioEvents,
  getScenarioEvent,
  tempBlueprintName,
} from '../../test-helpers';

/**
 * Importing scenario events into an existing MSEL from a spreadsheet.
 *
 * The previous version was effectively a duplicate of `upload-xlsx-to-existing-msel.spec.ts`:
 * both downloaded `Standard MSEL`, both clicked a `Upload .xlsx file to Standard MSEL` button
 * that **does not exist anywhere in the Angular app**, and both ended by asserting only that
 * the page had not navigated away and the MSEL link was still visible — i.e. "no crash",
 * which passes regardless of whether any import happened. Both also mutated the shared
 * `Standard MSEL` and used `networkidle` + a 2s sleep.
 *
 * This spec now covers what the sibling does not: that the **scenario events themselves**
 * survive an xlsx round-trip into an existing MSEL, including their data-value text — which is
 * the actual subject ("import scenario events"). Replacing an existing MSEL is API-only
 * (`PUT /api/msels/{id}/xlsx`); the multipart field must be named `ToUpload`
 * (`ViewModels/FileForm.cs`).
 *
 * Note the spec name says CSV, but Blueprint's import/export for this surface is xlsx and json
 * only — there is no CSV path (see `msel-list.component.html`).
 */
test.describe('Export and Import', () => {
  let token: string;
  let mselId: string;
  let mselName: string;
  const eventText = 'Imported scenario event';

  test.beforeEach(async () => {
    token = await getBlueprintToken();
    mselName = tempBlueprintName('TestBP-EventImport');
    const msel = await createMsel(token, {
      name: mselName,
      description: 'Seeded for scenario-event import',
    });
    mselId = msel.id;

    // Two events at distinct offsets, so ordering and count are both meaningful.
    await createRenderableScenarioEvent(token, mselId, eventText, { deltaSeconds: 300 });
    await createRenderableScenarioEvent(token, mselId, 'Second imported event', {
      deltaSeconds: 900,
    });
  });

  test.afterEach(async () => {
    try {
      if (mselId) await deleteMsel(token, mselId);
    } catch (err) {
      console.warn(`Cleanup failed for MSEL ${mselId}: ${err}`);
    }
  });

  test('Import Scenario Events from Excel into existing MSEL', async () => {
    const authHeader = { Authorization: `Bearer ${token}` };

    const before = await listScenarioEvents(token, mselId);
    expect(before.length).toBe(2);

    // 1. Export the MSEL — this workbook carries the scenario events.
    const downloadRes = await fetch(`${Services.Blueprint.API}/api/msels/${mselId}/xlsx`, {
      headers: authHeader,
    });
    expect(downloadRes.ok, `xlsx download failed with ${downloadRes.status}`).toBe(true);

    const workbook = Buffer.from(await downloadRes.arrayBuffer());
    expect(workbook.subarray(0, 2).toString('latin1')).toBe('PK');

    // 2. Import it back into the same MSEL.
    const form = new FormData();
    form.append(
      'ToUpload',
      new Blob([workbook], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      }),
      `${mselName}.xlsx`
    );

    const importRes = await fetch(`${Services.Blueprint.API}/api/msels/${mselId}/xlsx`, {
      method: 'PUT',
      headers: authHeader,
      body: form,
    });
    expect(
      importRes.ok,
      `scenario-event import failed with ${importRes.status}: ${await importRes.text()}`
    ).toBe(true);

    // 3. The events survived: same count, same offsets, and the text is still present.
    // `deltaSeconds` needs coercing — the API's `JsonIntegerConverter` writes every int as a
    // JSON string, so these arrive as "300"/"900".
    const after = await listScenarioEvents(token, mselId);
    expect(after.length).toBe(before.length);
    expect(
      after.map((e: any) => Number(e.deltaSeconds)).sort((a: number, b: number) => a - b)
    ).toEqual([300, 900]);

    // Data values are only populated on the single-event endpoint, so read the
    // events individually to confirm the imported text round-tripped rather than being dropped.
    const allValues: string[] = [];
    for (const event of after) {
      const full = await getScenarioEvent(token, event.id);
      allValues.push(
        ...(full.dataValues ?? []).map((dv: any) => dv.value).filter(Boolean)
      );
    }
    expect(allValues).toContain(eventText);
  });
});
