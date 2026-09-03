// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: gallery/gallery-test-plan.md
// seed: seed.spec.ts

import { test, expect, gotoGalleryAdmin, gotoAdminSection } from '../../fixtures';

test.describe('Role and Permission Management', () => {
  test('Exhibit Roles Tab', async ({ galleryAuthenticatedPage: page }) => {
    await gotoGalleryAdmin(page);

    // Navigate to Roles section
    await gotoAdminSection(page, 'Roles');

    // 1. Click the 'Exhibit Roles' tab
    await page.getByRole('tab', { name: 'Exhibit Roles' }).click();

    // expect: Exhibit Roles tab content is displayed
    // expect: A permission matrix shows Exhibit-level roles: Manager, Member, Observer
    await expect(page.getByRole('columnheader', { name: 'Manager' })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'Member' })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'Observer' })).toBeVisible();

    // expect: Permission rows
    await expect(page.getByRole('cell', { name: 'All', exact: true }).first()).toBeVisible();
    await expect(page.getByRole('cell', { name: 'ViewExhibit', exact: true }).first()).toBeVisible();
    await expect(page.getByRole('cell', { name: 'EditExhibit', exact: true }).first()).toBeVisible();
    await expect(page.getByRole('cell', { name: 'ManageExhibit', exact: true }).first()).toBeVisible();
  });
});
