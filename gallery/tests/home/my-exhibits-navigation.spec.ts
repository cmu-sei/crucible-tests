// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: gallery/gallery-test-plan.md
// seed: seed.spec.ts

import { test, expect } from '@playwright/test';
import { authenticateGalleryWithKeycloak } from '../../fixtures';

test.describe('My Exhibits Landing Page', () => {
  test('My Exhibits Navigation to Exhibit', async ({ page }) => {
    await authenticateGalleryWithKeycloak(page);
    await expect(page.getByRole('table')).toBeVisible();

    // 1. Click on an exhibit name link in the table
    const firstExhibitLink = page.getByRole('cell').getByRole('link').first();
    await expect(firstExhibitLink).toBeVisible();
    await firstExhibitLink.click();

    // expect: User is navigated to the exhibit's view
    // expect: URL updates to include '?exhibit={exhibitId}'
    await expect(page).toHaveURL(/\?exhibit=[0-9a-f-]+/);

    // expect: The view shows exhibit content (either Wall or Archive)
    const pageTitle = await page.title();
    expect(pageTitle).toMatch(/Gallery (Wall|Archive)/);
  });
});
