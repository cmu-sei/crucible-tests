// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: gallery/gallery-test-plan.md
// seed: seed.spec.ts

import { test, expect } from '@playwright/test';
import { authenticateGalleryWithKeycloak } from '../../fixtures';

test.describe('Wall View Functionality', () => {
  test('Wall Unread Article Count', async ({ page }) => {
    await authenticateGalleryWithKeycloak(page);
    await expect(page.getByRole('table')).toBeVisible();

    // Navigate to an exhibit's view
    const exhibitLink = page.getByRole('cell').getByRole('link').first();
    await exhibitLink.click();
    await expect(page).toHaveURL(/\?exhibit=/);

    // Navigate to Wall view
    const wallButton = page.getByRole('button', { name: 'Wall' });
    if (await wallButton.isVisible().catch(() => false)) {
      await wallButton.click();
    }
    await expect(page).toHaveTitle('Gallery Wall');

    // 1. Navigate to the Wall view and observe unread article counts on cards
    // expect: Cards with unread articles display the count prominently
    const unreadCount = page.getByRole('heading', { level: 3 }).filter({ hasText: /unread article/ });
    await expect(unreadCount.first()).toBeVisible();

    // 2. Navigate to the Archive view and mark an article as 'Read' using the Read button
    await page.getByRole('button', { name: 'Archive' }).click();
    await expect(page).toHaveTitle(/Gallery Archive/);

    const readButton = page.getByRole('button', { name: 'Read' }).first();
    await expect(readButton).toBeVisible();
    await readButton.click();

    // expect: The Read button toggles to indicate the article has been read

    // 3. Navigate back to the Wall view
    await page.getByRole('button', { name: 'Wall' }).click();
    await expect(page).toHaveTitle('Gallery Wall');

    // expect: The unread article count on the corresponding card may have changed
    await expect(page.getByText(/unread article/).first()).toBeVisible();
  });
});
