// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: gallery/gallery-test-plan.md
// seed: seed.spec.ts

import {
  test,
  expect,
  gotoGalleryAdmin,
  gotoAdminSection,
  GALLERY_THEMES,
  setGalleryTheme,
} from '../../fixtures';
import type { Page } from '@playwright/test';

/**
 * Pick a collection out of the Exhibits-section dropdown by name.
 *
 * API-seeded collections reach the admin UI either through the initial
 * `collectionDataService.load()` or through the `CollectionCreated` SignalR
 * message, so the option can take a moment to render — hence the explicit
 * visible-wait rather than an immediate click.
 */
async function selectCollection(page: Page, collectionName: string): Promise<void> {
  await page.getByRole('combobox', { name: 'Select a Collection' }).click();
  const option = page.getByRole('option', { name: collectionName });
  await expect(option).toBeVisible({ timeout: 20000 });
  await option.click();
}

for (const theme of GALLERY_THEMES) {
  test.describe(`${theme} theme › Exhibit Management`, () => {
    test('View Exhibits List', async ({ galleryAuthenticatedPage: page, seededCollection }) => {
      await setGalleryTheme(page, theme);

      await gotoGalleryAdmin(page);

      // 1. Navigate to admin section and click 'Exhibits' in the sidebar
      await gotoAdminSection(page, 'Exhibits');

      // expect: Exhibits section loads with a 'Select a Collection' dropdown
      const collectionDropdown = page.getByRole('combobox', { name: 'Select a Collection' });
      await expect(collectionDropdown).toBeVisible();

      // 2. Select a collection from the dropdown
      await selectCollection(page, seededCollection.collectionName);

      // expect: Exhibits for the selected collection are displayed in a table
      const exhibitRow = page.locator('tr.element-row').filter({ hasText: seededCollection.exhibitName });
      await expect(exhibitRow).toBeVisible();

      // expect: Table shows columns: Name, Created, User, Move, Inject
      await expect(page.getByRole('columnheader', { name: 'Name' })).toBeVisible();
      await expect(page.getByRole('columnheader', { name: 'Created' })).toBeVisible();
      await expect(page.getByRole('columnheader', { name: 'User' })).toBeVisible();
      await expect(page.getByRole('columnheader', { name: 'Move' })).toBeVisible();
      await expect(page.getByRole('columnheader', { name: 'Inject' })).toBeVisible();

      // expect: Add Exhibit and Upload Exhibit buttons appear in the header
      await expect(page.getByRole('button', { name: 'Add Exhibit' })).toBeVisible();
      await expect(page.getByRole('button', { name: 'Upload Exhibit' })).toBeVisible();
    });
  });
}
