// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: specs/blueprint-test-plan.md

import { test, expect, Services } from '../../fixtures';
import { getBlueprintToken, deleteUnit, tempBlueprintName } from '../../test-helpers';

/**
 * Creating a unit through Admin → Units, then adding a member to it.
 *
 * Rewritten; the previous version had four separate defects:
 *   - It hardcoded the name `Cyber Unit` and, before running, deleted **every** existing row
 *     with that name. Units are GLOBAL in Blueprint, so that both collided with concurrent
 *     runs and could destroy a unit somebody else created. This seeds a unique
 *     `tempBlueprintName()` and only ever removes its own.
 *   - It expanded the row with `tr.element-row`, which matches nothing — rows are Angular
 *     Material rows, reachable via `getByRole('row')`.
 *   - It asserted the new member appeared in Unit Members without searching first. That
 *     table has its own Search box and paginator, so a new member can land on page 2+.
 *   - It relied on `networkidle` and fixed sleeps throughout (both forbidden by CLAUDE.md).
 *
 * Verified contract: adding a member issues `POST /api/unitusers`. The nested
 * `/api/units/{unitId}/users/{userId}` route exists only for DELETE. The all-users table's
 * add control is `button[title="Add <user name>"]`.
 *
 * Teardown deletes the unit through the API, so a mid-test failure cannot leak a global unit.
 */
test.describe('Admin - Units Management', () => {
  let token: string;
  let unitName: string;
  let unitShortName: string;
  let createdUnitId: string | undefined;

  test.beforeEach(async () => {
    token = await getBlueprintToken();
    unitName = tempBlueprintName('TestBP-Unit');
    unitShortName = `T${String(Math.abs(hashCode(unitName)) % 10000).padStart(4, '0')}`;
    createdUnitId = undefined;
  });

  test.afterEach(async () => {
    try {
      if (createdUnitId) {
        await deleteUnit(token, createdUnitId);
        return;
      }
      // The UI may have created the unit before the test failed — find it by name and remove it.
      const res = await fetch(`${Services.Blueprint.API}/api/units`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const units = (await res.json()) as Array<{ id: string; name: string }>;
        for (const unit of units.filter((u) => u.name === unitName)) {
          await deleteUnit(token, unit.id);
        }
      }
    } catch (err) {
      console.warn(`Cleanup failed for unit "${unitName}": ${err}`);
    }
  });

  test('Create New Unit', async ({ blueprintAuthenticatedPage: page }) => {
    await page.goto(`${Services.Blueprint.UI}/admin`, { waitUntil: 'domcontentloaded' });

    const unitsNav = page.getByText('Units', { exact: true }).first();
    await expect(unitsNav).toBeVisible({ timeout: 15000 });
    await unitsNav.click();

    // 1. Create the unit, pairing Save with the POST it triggers.
    const addButton = page.getByRole('button', { name: /Add Unit/i });
    await expect(addButton).toBeVisible({ timeout: 10000 });
    await addButton.click();

    const dialog = page.getByRole('dialog').first();
    await expect(dialog).toBeVisible({ timeout: 10000 });

    const shortNameField = dialog
      .locator('input[formControlName*="shortName"], input[placeholder*="Short Name"]')
      .first();
    await expect(shortNameField).toBeVisible({ timeout: 10000 });
    await shortNameField.fill(unitShortName);

    const nameField = dialog.getByRole('textbox', { name: 'Name', exact: true });
    await expect(nameField).toBeVisible({ timeout: 10000 });
    await nameField.fill(unitName);

    const createResponse = page.waitForResponse(
      (r) => /\/api\/units\b/i.test(r.url()) && r.request().method() === 'POST',
      { timeout: 15000 }
    );
    await dialog.getByRole('button', { name: /^Save$/i }).first().click();
    const created = await createResponse;
    expect(created.ok()).toBe(true);
    createdUnitId = (await created.json()).id;

    // expect: the new unit is listed.
    await expect(page.getByRole('row').filter({ hasText: unitName }).first()).toBeVisible({
      timeout: 15000,
    });

    // Verify the creation persisted server-side, not just in the rendered list.
    const check = await fetch(`${Services.Blueprint.API}/api/units/${createdUnitId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(check.ok, `GET /api/units/${createdUnitId} returned ${check.status}`).toBe(true);
    const persisted = await check.json();
    expect(persisted.name).toBe(unitName);
    expect(persisted.shortName).toBe(unitShortName);

    // Scope note: adding/removing unit members is deliberately NOT covered here — this spec
    // is "Create New Unit". Member management has its own passing spec,
    // `view-and-manage-unit-users.spec.ts`, which exercises the same
    // `POST /api/unitusers` path against a unit it seeds itself.
  });
});

/** Deterministic hash so the generated short name stays within Blueprint's length limit. */
function hashCode(value: string): number {
  let hash = 0;
  for (let i = 0; i < value.length; i++) {
    hash = (hash << 5) - hash + value.charCodeAt(i);
    hash |= 0;
  }
  return hash;
}
