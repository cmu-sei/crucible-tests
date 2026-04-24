// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: gallery/gallery-test-plan.md
// seed: seed.spec.ts

import { test, expect } from '@playwright/test';
import { authenticateGalleryWithKeycloak } from '../../fixtures';

test.describe('Archive Functionality', () => {
  test('Archive Source Type Filtering', async ({ page }) => {
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

    // 1. Click the 'News' source type filter button (using News since test data has a News article)
    const newsButton = page.getByRole('button', { name: 'News' });
    await newsButton.click();

    // expect: Only articles with News source type are displayed
    // expect: The News button appears selected/active

    // 3. Click the active filter button again to deselect it
    await newsButton.click();

    // expect: All articles are displayed again

    // Test other source type buttons
    const sourceTypes = ['Intel', 'Reporting', 'Orders', 'Social', 'Phone', 'Email'];
    for (const sourceType of sourceTypes) {
      const button = page.getByRole('button', { name: sourceType });
      await expect(button).toBeVisible();
      await button.click();
      // Click again to deselect
      await button.click();
    }
  });
});
