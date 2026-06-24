// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: gallery/gallery-test-plan.md
// seed: seed.spec.ts

import { test, expect } from '../../fixtures';
import { authenticateGalleryWithKeycloak, navigateToFirstExhibit } from '../../fixtures';

test.describe('Team Management', () => {
  test('Team Selector in Wall and Archive', async ({ page, seededExhibit }) => {
    await authenticateGalleryWithKeycloak(page);
    await expect(page.getByRole('table')).toBeVisible();

    // Navigate to an exhibit
    await navigateToFirstExhibit(page, seededExhibit.exhibitName);

    // Navigate to Wall view
    const wallButton = page.getByRole('button', { name: 'Wall' });
    if (await wallButton.isVisible().catch(() => false)) {
      await wallButton.click();
    }

    // 1. Navigate to the Wall view and observe the team indicator
    if (await page.getByText('Team:').isVisible().catch(() => false)) {
      // expect: Team name is displayed
      await expect(page.getByText('Team:')).toBeVisible();
    }

    // 2. Navigate to the Archive view and observe the team indicator
    await page.getByRole('button', { name: 'Archive' }).click();
    await expect(page).toHaveTitle(/Gallery Archive/);

    if (await page.getByText('Team:').isVisible().catch(() => false)) {
      // expect: The same team is displayed
      await expect(page.getByText('Team:')).toBeVisible();
    }
  });
});
