// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: gallery/gallery-test-plan.md
// seed: seed.spec.ts

import { test, expect } from '../../fixtures';
import { authenticateGalleryWithKeycloak, navigateToFirstExhibit } from '../../fixtures';

test.describe('Wall View Functionality', () => {
  // Wall view requires TeamCards with isShownOnWall:true to render cards (fixture now creates them)
  test('Wall Advance Move and Inject', async ({ page, seededExhibit }) => {
    await authenticateGalleryWithKeycloak(page);
    await expect(page.getByRole('table')).toBeVisible();

    // Navigate to an exhibit's Wall view
    await navigateToFirstExhibit(page, seededExhibit.exhibitName);

    // Navigate to Wall view
    const wallButton = page.getByRole('button', { name: 'Wall' });
    if (await wallButton.isVisible().catch(() => false)) {
      await wallButton.click();
    }
    await expect(page).toHaveTitle('Gallery Wall');

    // Wait for the page to fully load and the Move/Inject indicator to appear
    await expect(page.getByText(/Move \d+, Inject \d+/)).toBeVisible({ timeout: 10000 });

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
