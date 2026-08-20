// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: gallery/gallery-test-plan.md
// seed: seed.spec.ts

import { test, expect, gotoGalleryAdmin, gotoAdminSection } from '../../fixtures';

test.describe('Group Management', () => {
  test('View Groups List', async ({ galleryAuthenticatedPage: page }) => {
    await gotoGalleryAdmin(page);

    // 1. Navigate to admin section and click 'Groups' in the sidebar
    await gotoAdminSection(page, 'Groups');

    // expect: Groups list page loads with a table showing 'Group Name' column
    await expect(page.getByRole('columnheader', { name: 'Group Name' })).toBeVisible();

    // expect: A 'Search Groups' text field is visible
    await expect(page.getByRole('textbox', { name: 'Search Groups' })).toBeVisible();

    // expect: A 'Clear Search' button is visible (disabled when no search term)
    const clearSearch = page.getByRole('button', { name: 'Clear Search' });
    await expect(clearSearch).toBeVisible();
    // `[disabled]="!filterString"` in admin-groups.component.html — with an empty
    // search box the button must be inert, which is the half of this expectation
    // that a bare visibility check would miss.
    await expect(clearSearch).toBeDisabled();

    // expect: An Add Group button (plus icon) is visible
    // The Groups toolbar buttons carry `matTooltip` ("Add New Group"), which Angular
    // Material renders as aria-describedby rather than an accessible name, so
    // getByRole({ name }) cannot reach them (the Collections admin uses `title` and
    // therefore can). Target the actions column header structurally instead.
    const addGroupButton = page.locator('app-admin-groups th.mat-column-actions button').first();
    await expect(addGroupButton).toBeVisible();
    // Admin holds ManageGroups, so the control must also be usable — a disabled
    // plus icon would still satisfy a visibility-only assertion.
    await expect(addGroupButton).toBeEnabled();
  });
});
