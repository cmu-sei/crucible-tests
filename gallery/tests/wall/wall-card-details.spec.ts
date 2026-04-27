// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: gallery/gallery-test-plan.md
// seed: seed.spec.ts

import { test, expect } from '@playwright/test';
import { authenticateGalleryWithKeycloak } from '../../fixtures';

test.describe('Wall View Functionality', () => {
  test('Wall Card Details Navigation', async ({ page }) => {
    await authenticateGalleryWithKeycloak(page);
    await expect(page.getByRole('table')).toBeVisible();

    // Navigate to an exhibit's Wall view
    const exhibitLink = page.getByRole('cell').getByRole('link').first();
    await exhibitLink.click();
    await expect(page).toHaveURL(/\?exhibit=/);

    // Navigate to Wall if not there already
    const wallButton = page.getByRole('button', { name: 'Wall' });
    if (await wallButton.isVisible().catch(() => false)) {
      await wallButton.click();
    }
    await expect(page).toHaveTitle('Gallery Wall');

    // 1. Click the 'Details' button on a card
    const detailsButton = page.getByRole('button', { name: 'Details' }).first();
    await expect(detailsButton).toBeVisible();
    await detailsButton.click();

    // expect: Card details are displayed showing associated articles
    // expect: Article information is visible
    // After clicking Details, the view should expand or show article information
    await expect(page.locator('text=/unread article/i').or(page.locator('text=/article/i')).first()).toBeVisible();
  });
});
