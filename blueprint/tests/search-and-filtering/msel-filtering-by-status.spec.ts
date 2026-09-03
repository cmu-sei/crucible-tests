// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: specs/blueprint-test-plan.md
// seed: tests/seed.spec.ts

import {
  test,
  expect,
  Services,
  serviceUrlPattern,
  selectMatSelectOption,
} from '../../fixtures';
import {
  getBlueprintToken,
  createMsel,
  deleteMsel,
  tempBlueprintName,
  findMselRowByName,
} from '../../test-helpers';

test.describe('Search and Filtering', () => {
  let token: string;
  let pendingMselId: string;
  let approvedMselId: string;
  let pendingName: string;
  let approvedName: string;

  test.beforeEach(async () => {
    token = await getBlueprintToken();
    pendingName = tempBlueprintName('Pending');
    approvedName = tempBlueprintName('Approved');

    const pending = await createMsel(token, {
      name: pendingName,
      description: 'Test MSEL with Pending status',
      status: 'Pending',
    });
    pendingMselId = pending.id;

    const approved = await createMsel(token, {
      name: approvedName,
      description: 'Test MSEL with Approved status',
      status: 'Approved',
    });
    approvedMselId = approved.id;
  });

  test.afterEach(async () => {
    try {
      if (pendingMselId) await deleteMsel(token, pendingMselId);
      if (approvedMselId) await deleteMsel(token, approvedMselId);
    } catch (err) {
      console.warn(`Cleanup failed: ${err}`);
    }
  });

  test('MSEL Filtering by Status', async ({ blueprintAuthenticatedPage: page }) => {
    // 1. Navigate to MSELs list
    await page.goto(`${Services.Blueprint.UI}/build`);
    await expect(page.getByRole('table')).toBeVisible({ timeout: 15000 });

    // 2. Filter by Pending status - this should show the Pending MSEL and exclude the Approved one
    // The status combobox's accessible name is its CURRENT selection ("All Statuses",
    // then "Pending", then "Approved", ...), so it must not be located by that name — the
    // locator would go stale the moment a filter is applied. The MSEL list renders exactly
    // two comboboxes: type first, then status.
    // Each selection goes through selectMatSelectOption: clicking a mat-select trigger does
    // not reliably leave the panel open (Material's overlay teardown can swallow the click),
    // so the helper reopens and reissues rather than waiting longer on a panel that is gone.
    const statusFilter = page.getByRole('combobox').nth(1);
    await expect(statusFilter).toBeVisible({ timeout: 10000 });

    await selectMatSelectOption(
      page,
      statusFilter,
      page.getByRole('option', { name: 'Pending', exact: true })
    );

    // expect: Only the Pending MSEL is visible
    const pendingRow = await findMselRowByName(page, pendingName);
    await expect(pendingRow).toBeVisible({ timeout: 10000 });

    // The Approved MSEL should NOT be visible
    // Search for it - it should not appear in results
    const searchBox = page.getByRole('textbox', { name: /search/i });
    await searchBox.fill(approvedName);
    const approvedRow = page.getByRole('row').filter({ hasText: approvedName });
    await expect(approvedRow).toHaveCount(0, { timeout: 10000 });

    // 3. Clear search and switch to Approved filter
    await searchBox.clear();
    await searchBox.fill('');

    await selectMatSelectOption(
      page,
      statusFilter,
      page.getByRole('option', { name: 'Approved', exact: true })
    );

    // expect: Only the Approved MSEL is visible
    const approvedRowVisible = await findMselRowByName(page, approvedName);
    await expect(approvedRowVisible).toBeVisible({ timeout: 10000 });

    // The Pending MSEL should NOT be visible
    await searchBox.fill(pendingName);
    const pendingRowFiltered = page.getByRole('row').filter({ hasText: pendingName });
    await expect(pendingRowFiltered).toHaveCount(0, { timeout: 10000 });

    // 4. Reset filter to "All Statuses"
    await searchBox.clear();
    await selectMatSelectOption(
      page,
      statusFilter,
      page.getByRole('option', { name: /All Statuses/i })
    );

    // expect: Both MSELs are visible now
    await searchBox.fill(pendingName);
    const pendingRowRestored = await findMselRowByName(page, pendingName);
    await expect(pendingRowRestored).toBeVisible({ timeout: 10000 });

    await searchBox.clear();
    await searchBox.fill(approvedName);
    const approvedRowRestored = await findMselRowByName(page, approvedName);
    await expect(approvedRowRestored).toBeVisible({ timeout: 10000 });
  });
});
