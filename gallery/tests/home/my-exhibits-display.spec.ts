// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: gallery/gallery-test-plan.md
// seed: seed.spec.ts

import { test, expect } from '@playwright/test';
import { authenticateGalleryWithKeycloak } from '../../fixtures';

test.describe('My Exhibits Landing Page', () => {
  test('My Exhibits Table Display', async ({ page }) => {
    // 1. Log in and navigate to http://localhost:4723
    await authenticateGalleryWithKeycloak(page);

    // expect: The My Exhibits page loads with the Gallery logo and title
    await expect(page.getByText('Gallery - Exercise Information Sharing')).toBeVisible();

    // expect: A table is displayed with columns: Name, Collection, Created By, Created
    await expect(page.getByRole('table')).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'Name' })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'Collection' })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'Created By' })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'Created', exact: true })).toBeVisible();

    // expect: Each row shows an exhibit with its name as a clickable link
    const firstRow = page.getByRole('row').nth(1);
    await expect(firstRow.getByRole('link')).toBeVisible();

    // 2. Observe the Administration button (gear icon) above the table
    // expect: The Administration button is visible for admin users
    await expect(page.getByRole('button', { name: 'Administration' })).toBeVisible();
  });
});
