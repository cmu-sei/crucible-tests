// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: gallery/gallery-test-plan.md
// seed: seed.spec.ts

import { test, expect } from '@playwright/test';
import { authenticateGalleryWithKeycloak, Services } from '../../fixtures';

test.describe('Admin Navigation and UI', () => {
  test('Exit Administration', async ({ page }) => {
    await authenticateGalleryWithKeycloak(page);
    await page.getByRole('button', { name: 'Administration' }).click();
    await expect(page).toHaveTitle('Gallery Admin');

    // 1. Click the 'Administration' link (with logo) at the top of the admin sidebar
    await page.getByRole('link', { name: 'Administration' }).click();

    // expect: User is navigated back to the My Exhibits home page
    await expect(page).toHaveTitle('Gallery');
    await expect(page.getByText('My Exhibits')).toBeVisible();

    // expect: URL changes to /
    await expect(page).toHaveURL(new RegExp(`${Services.Gallery.UI.replace('http://', '')}/?$`));
  });
});
