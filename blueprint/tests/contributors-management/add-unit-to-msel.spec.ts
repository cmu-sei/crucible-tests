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
  test('Add Unit to MSEL', async ({ blueprintAuthenticatedPage: page }) => {
    const token = await getBlueprintToken();
    const mselName = tempBlueprintName('UnitTest');
    const unitName = tempBlueprintName('TestUnit');
    const unitShortName = 'TU';

    // 1. Seed a MSEL and a Unit via API
    const createdMsel = await createMsel(token, {
      name: mselName,
      description: 'Test MSEL for unit addition',
    });

    const createdUnit = await createUnit(token, unitName, unitShortName);

    let mselUnitId: string | null = null;

    try {
      // 2. Add the unit to the MSEL via API
      const mselUnit = await addUnitToMsel(token, createdMsel.id, createdUnit.id);
      mselUnitId = mselUnit.id;

      // 3. Navigate to the MSEL's Contributors section
      await navigateToMselSection(page, createdMsel.id, 'Contributors');

      // expect: Contributors section is visible
      await expect(page.locator('mat-list-item').filter({ hasText: 'Contributors' })).toBeVisible();

      // 4. Verify the unit appears in the contributors table
      // The contributors table shows units with their short name
      const unitCell = page.locator('[role="cell"], td').filter({ hasText: unitShortName }).first();
      await expect(unitCell).toBeVisible({ timeout: 10000 });
    } finally {
      // 5. Clean up: delete the mselUnit, MSEL, and unit
      if (mselUnitId) {
        await removeMselUnit(token, mselUnitId);
      }
      await deleteMsel(token, createdMsel.id);
      await deleteUnit(token, createdUnit.id);
    }
  });
});
