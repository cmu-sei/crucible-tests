// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: gallery/gallery-test-plan.md
// seed: seed.spec.ts

import { test, expect } from '../../fixtures';
import { authenticateGalleryWithKeycloak, navigateToFirstExhibit } from '../../fixtures';

test.describe('Archive Functionality', () => {
  test('Archive Navigation', async ({ page, seededExhibit }) => {
    await authenticateGalleryWithKeycloak(page);
    await expect(page.getByRole('table')).toBeVisible();

    // Navigate to an exhibit and the Archive view
    await navigateToFirstExhibit(page, seededExhibit.exhibitName);

    const archiveButton = page.getByRole('button', { name: 'Archive' });
    if (await archiveButton.isVisible().catch(() => false)) {
      await archiveButton.click();
    }
    await expect(page).toHaveTitle(/Gallery Archive/);

    // 1. Click the 'Wall' button from the Archive view
    await page.getByRole('button', { name: 'Wall' }).click();

    // expect: User is navigated to the Wall view for the same exhibit
    await expect(page).toHaveTitle('Gallery Wall');

    // Navigate back to Archive
    await page.getByRole('button', { name: 'Archive' }).click();
    await expect(page).toHaveTitle(/Gallery Archive/);

    // 2. Click the 'Administration' button from the Archive view
    await page.getByRole('button', { name: 'Administration' }).click();

    // expect: User is navigated to the admin section
    await expect(page).toHaveTitle('Gallery Admin');

    // 3. Click the Gallery logo in the top navigation to return home
    // The logo link contains an SVG icon (no alt text)
    const logoLink = page.locator('a[href="/"]').filter({ has: page.locator('mat-icon[svgicon="crucible-icon-gallery"]') }).first();
    await logoLink.click();

    // expect: User is navigated to the My Exhibits home page
    await expect(page).toHaveTitle('Gallery');
    await expect(page.getByText('My Exhibits')).toBeVisible();
  });
});
