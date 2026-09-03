// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: gallery/gallery-test-plan.md
// seed: seed.spec.ts

import { test, expect, gotoGalleryAdmin, gotoAdminSection } from '../../fixtures';

test.describe('Admin Navigation and UI', () => {
  test('Admin Sidebar Navigation', async ({ galleryAuthenticatedPage: page }) => {
    // 1. Navigate to admin section
    await gotoGalleryAdmin(page);

    // expect: The admin page has a left sidebar with sections.
    // Scope to the sidebar's mat-list-item entries rather than a bare
    // getByText(...).first() so these can't be satisfied by, say, a
    // "Collections" column header or a "Collection Roles" tab elsewhere.
    for (const section of ['Collections', 'Exhibits', 'Users', 'Roles', 'Groups']) {
      await expect(
        page.locator('mat-list-item').filter({ hasText: section }).getByRole('button')
      ).toBeVisible();
    }

    // expect: A 'Versions: UI x.x.x, API x.x.x' label is displayed at the bottom of the sidebar
    await expect(page.getByText(/Versions: UI .+, API .+/)).toBeVisible();

    // expect: The heading 'Administration' is visible at the top
    await expect(page.getByRole('heading', { name: 'Administration', level: 2 })).toBeVisible();

    // 2. Click 'Collections' in the sidebar
    await gotoAdminSection(page, 'Collections');
    // expect: Collections admin view loads
    await expect(page.getByRole('button', { name: 'Add Collection' })).toBeVisible();

    // 3. Click 'Exhibits' in the sidebar
    await gotoAdminSection(page, 'Exhibits');
    // expect: Exhibits admin view loads with Collection dropdown
    await expect(page.getByRole('combobox', { name: 'Select a Collection' })).toBeVisible();

    // 4. Click 'Users' in the sidebar
    await gotoAdminSection(page, 'Users');
    // expect: Users admin view loads
    await expect(page.getByRole('columnheader', { name: 'Role' })).toBeVisible();

    // 5. Click 'Roles' in the sidebar
    await gotoAdminSection(page, 'Roles');
    // expect: Roles admin view loads with three tabs
    await expect(page.getByRole('tab', { name: 'Roles', exact: true })).toBeVisible();
    await expect(page.getByRole('tab', { name: 'Collection Roles' })).toBeVisible();
    await expect(page.getByRole('tab', { name: 'Exhibit Roles' })).toBeVisible();

    // 6. Click 'Groups' in the sidebar
    await gotoAdminSection(page, 'Groups');
    // expect: Groups admin view loads
    await expect(page.getByRole('textbox', { name: 'Search Groups' })).toBeVisible();
  });
});
