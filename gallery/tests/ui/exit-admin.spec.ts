// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: gallery/gallery-test-plan.md
// seed: seed.spec.ts

import { test, expect, gotoGalleryAdmin, Services , GALLERY_THEMES, applyGalleryTheme} from '../../fixtures';

for (const theme of GALLERY_THEMES) {
  test.describe(`${theme} theme › Admin Navigation and UI`, () => {
  test('Exit Administration', async ({ galleryAuthenticatedPage: page }) => {
    await applyGalleryTheme(page, theme);
    await gotoGalleryAdmin(page);

    // 1. Click the 'Exit Administration' area (with logo) at the top of the admin sidebar
    // The exit element is a clickable area with the gallery icon that links to '/'
    await page.locator('a.nolink', { has: page.locator('h2:text("Administration")') }).click();

    // expect: User is navigated back to the My Exhibits home page
    await expect(page).toHaveTitle('Gallery');
    await expect(page.getByText('My Exhibits')).toBeVisible();

    // expect: URL changes to /
    await expect(page).toHaveURL(new RegExp(`${Services.Gallery.UI.replace('http://', '')}/?$`));
  });
});
}
