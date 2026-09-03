// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: gallery/gallery-test-plan.md
// seed: seed.spec.ts

import { test, expect, gotoGalleryAdmin, gotoAdminSection, apiDeleteGroupByName } from '../../fixtures';

test.describe('Group Management', () => {
  // Two groups: the filter is only meaningful if there is something for it to hide,
  // so the spec seeds both a match and a non-match. Names are registered before the
  // create actions and removed in afterEach.
  let targetName: string | undefined;
  let otherName: string | undefined;

  test.afterEach(async () => {
    for (const name of [targetName, otherName]) {
      if (name) {
        await apiDeleteGroupByName(name);
      }
    }
    targetName = undefined;
    otherName = undefined;
  });

  test('Search Groups', async ({ galleryAuthenticatedPage: page }) => {
    await gotoGalleryAdmin(page);
    await gotoAdminSection(page, 'Groups');
    await expect(page.getByRole('columnheader', { name: 'Group Name' })).toBeVisible();

    const suffix = `${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
    targetName = `Search Group Alpha ${suffix}`;
    otherName = `Search Group Beta ${suffix}`;

    // Setup: create the two groups through the UI. matTooltip does not produce an
    // accessible name for these toolbar buttons, hence the structural locator.
    const addGroupButton = page.locator('app-admin-groups th.mat-column-actions button').first();
    for (const name of [targetName, otherName]) {
      await addGroupButton.click();
      const createDialog = page.getByRole('dialog');
      await expect(createDialog).toBeVisible();
      await createDialog.getByRole('textbox').fill(name);
      await createDialog.getByRole('button', { name: 'Save' }).click();
      await expect(createDialog).not.toBeVisible();
      await expect(page.getByRole('cell', { name })).toBeVisible();
    }

    const searchField = page.getByRole('textbox', { name: 'Search Groups' });
    const clearButton = page.getByRole('button', { name: 'Clear Search' });

    // Baseline: no filter, so both seeded rows are present and Clear is inert.
    await expect(clearButton).toBeDisabled();
    await expect(page.getByRole('cell', { name: targetName })).toBeVisible();
    await expect(page.getByRole('cell', { name: otherName })).toBeVisible();

    // 1. Enter a search term in the 'Search Groups' field
    await searchField.fill(targetName);
    // The input filters on (keyup) (`(keyup)="applyFilter($event.target.value)"` in
    // admin-groups.component.html), so fill() by itself sets the value without
    // filtering — a key event is required to apply it.
    await searchField.press('End');

    // expect: Groups list filters to show only matching groups.
    // toHaveCount(0) on the non-match rather than not.toBeVisible(): the row is
    // removed from the DOM by the filter, and a count assertion cannot pass
    // vacuously.
    await expect(page.getByRole('cell', { name: targetName })).toBeVisible();
    await expect(page.getByRole('cell', { name: otherName })).toHaveCount(0);
    await expect(page.locator('app-admin-groups tr.element-row')).toHaveCount(1);

    // expect: Clear Search button becomes enabled
    await expect(clearButton).toBeEnabled();

    // 2. Click the 'Clear Search' button
    await clearButton.click();

    // expect: Search field is cleared
    await expect(searchField).toHaveValue('');

    // expect: All groups are displayed again
    await expect(page.getByRole('cell', { name: targetName })).toBeVisible();
    await expect(page.getByRole('cell', { name: otherName })).toBeVisible();

    // expect: Clear Search button becomes disabled
    await expect(clearButton).toBeDisabled();
  });
});
