// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: caster/caster-test-plan.md
// seed: seed.spec.ts

import {
  test,
  expect,
  casterApi,
  gotoCasterGroupsAdmin,
  CASTER_THEMES,
  setCasterTheme,
} from '../../fixtures';

for (const theme of CASTER_THEMES) {
  test.describe(`${theme} theme › Groups Management`, () => {
    // Mutator: seeds its own groups per test and deletes them in afterEach.
    let seededGroupIds: string[] = [];

    test.afterEach(async ({ casterAuthenticatedPage: page }) => {
      for (const id of seededGroupIds) {
        const res = await casterApi(page, 'DELETE', `groups/${id}`);
        if (res.status !== 204 && res.status !== 200 && res.status !== 404) {
          throw new Error(`DELETE /api/groups/${id} returned ${res.status}`);
        }
      }
      seededGroupIds = [];
    });

    test('Sort Groups', async ({ casterAuthenticatedPage: page }, testInfo) => {
      await setCasterTheme(page, theme);

      // Unique per test so concurrent workers and repeats never see each other's groups
      // once the list is filtered to the prefix.
      const prefix = `E2E Sort ${theme} ${testInfo.repeatEachIndex} ${Date.now().toString(36)}`;
      // Seeded out of order so neither the API's order nor creation order passes for sorted.
      const suffixes = ['bravo', 'charlie', 'alpha'];
      for (const suffix of suffixes) {
        const res = await casterApi(page, 'POST', 'groups', { name: `${prefix} ${suffix}` });
        expect(res.status, JSON.stringify(res.body)).toBe(201);
        seededGroupIds.push(res.body.id);
      }
      const ascending = ['alpha', 'bravo', 'charlie'].map((s) => `${prefix} ${s}`);

      // 1. Navigate to Groups admin section and filter to the seeded groups
      await gotoCasterGroupsAdmin(page);
      // The search box filters on keyup, so type the term rather than fill() it.
      await page.getByRole('textbox', { name: 'Search Groups' }).pressSequentially(prefix);
      const nameCells = page.locator('tbody tr.element-row td.mat-column-name');
      await expect(nameCells).toHaveCount(3);

      // Scoped to the column header and matched exactly: an unscoped
      // getByRole('button', { name: 'Group Name' }) also matches a row's
      // "Delete <group>" button whenever another test's group name contains "Group Name".
      const header = page.getByRole('columnheader', { name: 'Group Name', exact: true });
      const sortButton = header.getByRole('button');

      // 2. Click on the Group Name column header
      await sortButton.click();
      // expect: Groups are sorted alphabetically ascending
      await expect(header).toHaveAttribute('aria-sort', 'ascending');
      await expect(nameCells).toHaveText(ascending);

      // 3. Click on the Group Name column header again
      await sortButton.click();
      // expect: Groups are sorted descending
      await expect(header).toHaveAttribute('aria-sort', 'descending');
      await expect(nameCells).toHaveText([...ascending].reverse());
    });
  });
}
