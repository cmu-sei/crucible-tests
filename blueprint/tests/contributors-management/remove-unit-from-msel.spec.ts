// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: specs/blueprint-test-plan.md
// seed: tests/seed.spec.ts

import { test, expect } from '../../fixtures';
import {
  getBlueprintToken,
  createMsel,
  deleteMsel,
  tempBlueprintName,
  navigateToMselSection,
} from '../../test-helpers';
import { APIRequestContext, request as playwrightRequest } from '@playwright/test';
import { Services } from '../../fixtures';

// Local helper functions for Unit and MselUnit management
async function newContext(): Promise<APIRequestContext> {
  return playwrightRequest.newContext({ ignoreHTTPSErrors: true });
}

async function blueprintCall<T = any>(
  token: string,
  path: string,
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' = 'GET',
  body?: any
): Promise<{ ok: boolean; status: number; data: T; text: string }> {
  const base = Services.Blueprint.API.replace(/\/$/, '');
  const url = `${base}${path}`;
  const ctx = await newContext();
  try {
    const res = await ctx.fetch(url, {
      method,
      headers: { Authorization: `Bearer ${token}` },
      data: body,
    });
    const text = await res.text();
    let data: any;
    try {
      data = text ? JSON.parse(text) : undefined;
    } catch {
      /* non-JSON */
    }
    return { ok: res.ok(), status: res.status(), data, text };
  } finally {
    await ctx.dispose();
  }
}

async function createUnit(
  token: string,
  name: string,
  shortName: string
): Promise<{ id: string; name: string; shortName: string }> {
  const r = await blueprintCall(token, '/api/units', 'POST', { name, shortName });
  if (!r.ok) {
    throw new Error(`createUnit failed (${r.status}): ${r.text}`);
  }
  return { id: r.data.id, name: r.data.name, shortName: r.data.shortName };
}

async function deleteUnit(token: string, unitId: string): Promise<void> {
  const r = await blueprintCall(token, `/api/units/${unitId}`, 'DELETE');
  if (!r.ok && r.status !== 404) {
    console.warn(`deleteUnit(${unitId}) returned ${r.status}: ${r.text}`);
  }
}

async function addUnitToMsel(
  token: string,
  mselId: string,
  unitId: string
): Promise<{ id: string }> {
  const r = await blueprintCall(token, '/api/mselunits', 'POST', { mselId, unitId });
  if (!r.ok) {
    throw new Error(`addUnitToMsel failed (${r.status}): ${r.text}`);
  }
  return { id: r.data.id };
}

async function removeMselUnit(token: string, mselUnitId: string): Promise<void> {
  const r = await blueprintCall(token, `/api/mselunits/${mselUnitId}`, 'DELETE');
  if (!r.ok && r.status !== 404) {
    console.warn(`removeMselUnit(${mselUnitId}) returned ${r.status}: ${r.text}`);
  }
}

test.describe('Contributors Management', () => {
  test('Remove Unit from MSEL', async ({ blueprintAuthenticatedPage: page }) => {
    const token = await getBlueprintToken();
    const mselName = tempBlueprintName('RemoveUnit');
    const unitName = tempBlueprintName('RemoveTestUnit');
    const unitShortName = 'RTU';

    // 1. Seed a MSEL and a Unit via API
    const createdMsel = await createMsel(token, {
      name: mselName,
      description: 'Test MSEL for unit removal',
    });

    const createdUnit = await createUnit(token, unitName, unitShortName);

    // 2. Add the unit to the MSEL via API
    const mselUnit = await addUnitToMsel(token, createdMsel.id, createdUnit.id);

    try {
      // 3. Navigate to the MSEL's Contributors section
      await navigateToMselSection(page, createdMsel.id, 'Contributors');

      // expect: Contributors section is visible
      await expect(page.locator('mat-list-item').filter({ hasText: 'Contributors' })).toBeVisible();

      // 4. Verify the unit appears in the contributors table
      const unitCell = page.locator('[role="cell"], td').filter({ hasText: unitShortName });
      await expect(unitCell).toBeVisible({ timeout: 10000 });

      // 5. Click the remove button for the unit
      const removeBtn = page.locator('button[title="Remove unit from MSEL"]').first();
      await expect(removeBtn).toBeVisible();
      await removeBtn.click();

      // 6. Confirm the removal dialog
      const confirmDialog = page.locator('[role="dialog"]').first();
      await expect(confirmDialog).toBeVisible({ timeout: 10000 });

      const yesBtn = confirmDialog.getByRole('button', { name: 'YES' });
      await expect(yesBtn).toBeVisible();
      await yesBtn.click();

      // 7. Verify the unit is no longer in the contributors table
      await expect(
        page.locator('[role="cell"], td').filter({ hasText: unitShortName })
      ).not.toBeVisible({ timeout: 10000 });
    } finally {
      // 8. Clean up: delete the mselUnit (if not already removed), MSEL, and unit
      // Try to remove via API in case the UI removal failed
      await removeMselUnit(token, mselUnit.id);
      await deleteMsel(token, createdMsel.id);
      await deleteUnit(token, createdUnit.id);
    }
  });
});
