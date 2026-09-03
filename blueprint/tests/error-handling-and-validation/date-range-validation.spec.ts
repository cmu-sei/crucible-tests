// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: specs/blueprint-test-plan.md

import { test, expect } from '../../fixtures';
import {
  getBlueprintToken,
  createMsel,
  deleteMsel,
  getMsel,
  updateMsel,
  navigateToMsel,
} from '../../test-helpers';

/**
 * A MSEL's exercise window must not end before it starts.
 *
 * Rewritten. The previous version drove the Material datepicker (open calendar → click a day
 * button matched by `aria-label*="2026"` → save a nested dialog) which was brittle and broke
 * on `mat-calendar` never appearing. Worse, its own comments conceded the app "does NOT block
 * the save operation", so it asserted only that Save stayed enabled — a test that passes
 * precisely *because* validation is missing, which is inverted coverage.
 *
 * Blueprint stores the window as `startTime` + `durationSeconds`, so "end before start" is
 * exactly a negative `durationSeconds`. That is checked directly here instead of through the
 * calendar widget: it's the same invariant, expressed where it can be asserted reliably.
 */
test.describe('Error Handling and Validation', () => {
  let token: string;
  let mselId: string;

  test.beforeEach(async () => {
    token = await getBlueprintToken();
    const msel = await createMsel(token);
    mselId = msel.id;
  });

  test.afterEach(async () => {
    try {
      if (mselId) await deleteMsel(token, mselId);
    } catch (err) {
      console.warn(`Cleanup failed for MSEL ${mselId}: ${err}`);
    }
  });

  test('Date Range Validation', async ({ blueprintAuthenticatedPage: page }) => {
    const startTime = '2026-06-01T12:00:00Z';

    // An end time before the start must be rejected by the API.
    await expect(
      updateMsel(token, mselId, { startTime, durationSeconds: -86_400 })
    ).rejects.toThrow();

    // ...and must not have been persisted. Coerce first: the API's `JsonIntegerConverter`
    // serializes every int as a JSON *string*, so `durationSeconds` arrives as e.g. "3600".
    const afterInvalid = await getMsel(token, mselId);
    expect(Number(afterInvalid.durationSeconds ?? 0)).toBeGreaterThanOrEqual(0);

    // A valid window still works, proving the guard rejects only the invalid case.
    await updateMsel(token, mselId, { startTime, durationSeconds: 86_400 });
    const afterValid = await getMsel(token, mselId);
    expect(Number(afterValid.durationSeconds)).toBe(86_400);

    // The Config tab shows the date/time fields for that window.
    await navigateToMsel(page, mselId);

    const setStartTimeCheckbox = page.getByRole('checkbox', { name: 'Set a Start Time' });
    await expect(setStartTimeCheckbox).toBeVisible({ timeout: 15000 });
    await expect(setStartTimeCheckbox).toBeChecked();

    await expect(
      page.locator('mat-form-field').filter({ hasText: 'Start Date / Time' })
    ).toBeVisible({ timeout: 10000 });
    await expect(
      page.locator('mat-form-field').filter({ hasText: 'End Date / Time' })
    ).toBeVisible({ timeout: 10000 });
  });
});
