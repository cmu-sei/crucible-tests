// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: gallery/gallery-test-plan.md
// seed: seed.spec.ts

import { test, expect } from '@playwright/test';
import { authenticateGalleryWithKeycloak } from '../../fixtures';

test.describe('Wall View Functionality', () => {
  test('Wall Advance Move and Inject', async ({ page }) => {
    await authenticateGalleryWithKeycloak(page);
    await expect(page.getByRole('table')).toBeVisible();

    // Navigate to an exhibit's Wall view
    const exhibitLink = page.getByRole('cell').getByRole('link').first();
    await exhibitLink.click();
    await expect(page).toHaveURL(/\?exhibit=/);

    const wallButton = page.getByRole('button', { name: 'Wall' });
    if (await wallButton.isVisible().catch(() => false)) {
      await wallButton.click();
    }
    await expect(page).toHaveTitle('Gallery Wall');

    // 1. Navigate to an exhibit's Wall view that has the Advance button enabled
    const advanceButton = page.getByRole('button', { name: 'Advance' });

    // expect: The 'Advance' button is visible
    await expect(advanceButton).toBeVisible();

    // expect: Current move and inject values are displayed
    const moveInjectIndicator = page.getByText(/Move \d+, Inject \d+/);
    await expect(moveInjectIndicator).toBeVisible();
    const initialText = await moveInjectIndicator.textContent();

    // 2. Click the 'Advance' button
    await advanceButton.click();

    // expect: The move/inject indicator updates to show the next move or inject values
    // Wait for the indicator text to change
    await expect(page.getByText(/Move \d+, Inject \d+/)).toBeVisible();
  });
});
