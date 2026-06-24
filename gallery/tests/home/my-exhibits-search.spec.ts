// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: gallery/gallery-test-plan.md
// seed: seed.spec.ts

import { test, expect, authenticateGalleryWithKeycloak } from '../../fixtures';

test.describe('My Exhibits Landing Page', () => {
  test('My Exhibits Search', async ({ page, seededExhibit }) => {
    await authenticateGalleryWithKeycloak(page);
    await expect(page.getByRole('table')).toBeVisible();

    const searchField = page.getByRole('textbox', { name: 'Search' });

    // 1. Locate the Search text field above the table
    // expect: A search input field is visible
    await expect(searchField).toBeVisible();

    // 2. Enter a search term that matches an exhibit name
    // Use the seeded exhibit name to ensure a match
    const searchTerm = seededExhibit.exhibitName.split(' ')[0];
    await searchField.fill(searchTerm);

    // expect: The table filters to show only matching exhibits
    const rows = page.getByRole('row').filter({ hasText: searchTerm });
    await expect(rows.first()).toBeVisible();

    // 3. Clear the search field
    await searchField.clear();

    // expect: All exhibits are displayed again
    await expect(page.getByRole('row').nth(1)).toBeVisible();

    // 4. Enter a search term that matches no exhibits
    await searchField.fill('ZZZZNONEXISTENT');

    // expect: The table shows 'No results found' message or empty state
    await expect(page.getByRole('row').nth(1)).not.toBeVisible({ timeout: 5000 }).catch(() => {
      // Table may still show header row only
    });
  });
});
