// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: gallery/gallery-test-plan.md
// seed: seed.spec.ts

import { test, expect } from '@playwright/test';
import { authenticateGalleryWithKeycloak } from '../../fixtures';

test.describe('Archive Functionality', () => {
  test('Archive Card Filtering', async ({ page }) => {
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

    // 1. Click the 'All Cards' dropdown
    const cardFilter = page.getByRole('combobox', { name: 'All Cards' });
    await cardFilter.click();

    // expect: A list of available cards is displayed
    const options = page.getByRole('option');
    await expect(options.first()).toBeVisible();

    // 2. Select a specific card from the dropdown
    await options.first().click();

    // expect: Only articles belonging to the selected card are displayed

    // 3. Select 'All Cards' or clear the filter
    await cardFilter.click();
    const allCardsOption = page.getByRole('option', { name: 'All Cards' });
    if (await allCardsOption.isVisible().catch(() => false)) {
      await allCardsOption.click();
    } else {
      await page.keyboard.press('Escape');
    }

    // expect: All articles are displayed again
  });
});
