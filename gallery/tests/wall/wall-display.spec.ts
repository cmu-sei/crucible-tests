// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: gallery/gallery-test-plan.md
// seed: seed.spec.ts

import { test, expect } from '@playwright/test';
import { authenticateGalleryWithKeycloak } from '../../fixtures';

test.describe('Wall View Functionality', () => {
  test('Wall Page Display', async ({ page }) => {
    // 1. Log in and navigate to an exhibit from the My Exhibits page
    await authenticateGalleryWithKeycloak(page);
    await expect(page.getByRole('table')).toBeVisible();

    // Click on an exhibit to enter its view
    const exhibitLink = page.getByRole('cell').getByRole('link').first();
    await exhibitLink.click();
    await expect(page).toHaveURL(/\?exhibit=/);

    // Navigate to the Wall view if not already there
    const wallButton = page.getByRole('button', { name: 'Wall' });
    if (await wallButton.isVisible().catch(() => false)) {
      await wallButton.click();
    }

    // expect: The Wall page loads with the page title 'Gallery Wall'
    await expect(page).toHaveTitle('Gallery Wall');

    // expect: The Move/Inject indicator is displayed
    await expect(page.getByText(/Move \d+, Inject \d+/)).toBeVisible();

    // expect: The team indicator shows the current team name
    await expect(page.getByText('Team:')).toBeVisible();

    // 2. Observe the navigation controls at the top
    // expect: An 'Archive' button is visible
    await expect(page.getByRole('button', { name: 'Archive' })).toBeVisible();

    // expect: An 'Administration' button is visible (for admin users)
    await expect(page.getByRole('button', { name: 'Administration' })).toBeVisible();
  });
});
