// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: gallery/gallery-test-plan.md
// seed: seed.spec.ts

import { test, expect } from '@playwright/test';
import { authenticateGalleryWithKeycloak } from '../../fixtures';

test.describe('Archive Functionality', () => {
  test('Archive Combined Filters', async ({ page }) => {
    await authenticateGalleryWithKeycloak(page);
    await expect(page.getByRole('table')).toBeVisible();

    // Navigate to an exhibit and the Archive view
    const exhibitLink = page.getByRole('cell').getByRole('link').first();
    await exhibitLink.click();
    await expect(page).toHaveURL(/\?exhibit=/);

    const archiveButton = page.getByRole('button', { name: 'Archive' });
    if (await archiveButton.isVisible().catch(() => false)) {
      await archiveButton.click();
    }
    await expect(page).toHaveTitle(/Gallery Archive/);

    const searchField = page.getByRole('textbox', { name: 'Search the Archive' });

    // 1. Enter a search term AND select a source type filter button
    await searchField.fill('E2E');
    await page.getByRole('button', { name: 'News' }).click();

    // expect: Only articles matching both the search term and source type are displayed

    // 2. Additionally select a specific card from the dropdown
    const cardFilter = page.getByRole('combobox', { name: 'All Cards' });
    await cardFilter.click();
    const cardOptions = page.getByRole('option');
    if (await cardOptions.first().isVisible().catch(() => false)) {
      await cardOptions.first().click();
    } else {
      await page.keyboard.press('Escape');
    }

    // expect: Articles are further filtered to match all three criteria

    // 3. Clear all filters one by one
    // Clear search
    await searchField.clear();

    // Clear source type filter
    await page.getByRole('button', { name: 'News' }).click();

    // Reset card filter
    await cardFilter.click();
    const allCardsOption = page.getByRole('option', { name: 'All Cards' });
    if (await allCardsOption.isVisible().catch(() => false)) {
      await allCardsOption.click();
    } else {
      await page.keyboard.press('Escape');
    }

    // expect: All articles show when all filters are cleared
  });
});
