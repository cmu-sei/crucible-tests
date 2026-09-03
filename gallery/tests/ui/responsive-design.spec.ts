// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: gallery/gallery-test-plan.md
// seed: seed.spec.ts

import { test, expect, gotoGalleryAdmin, gotoAdminSection } from '../../fixtures';

test.describe('Responsive Design and Accessibility', () => {
  test('Responsive Design', async ({ galleryAuthenticatedPage: page }) => {
    /**
     * Width of the document's horizontal overflow beyond the viewport, in CSS
     * pixels. 0 means the page fits and needs no horizontal scrollbar.
     */
    const horizontalOverflow = () =>
      page.evaluate(() => {
        const doc = document.documentElement;
        return Math.max(0, doc.scrollWidth - doc.clientWidth);
      });

    // 1. Resize the browser window to mobile dimensions (e.g., 375x667)
    await page.setViewportSize({ width: 375, height: 667 });

    // expect: Application layout adjusts to mobile view
    await expect(page.getByText('My Exhibits')).toBeVisible();
    // The layout must reflow to the narrow viewport, not just render offscreen.
    await expect
      .poll(() => page.viewportSize()?.width, { message: 'viewport did not resize' })
      .toBe(375);

    // expect: Content is readable without horizontal scrolling.
    // Assert the document itself does not overflow the viewport. (An inner
    // scrollable table region is allowed; a page-level horizontal scrollbar is not.)
    await expect
      .poll(horizontalOverflow, {
        message: 'page overflows the mobile viewport horizontally',
        timeout: 10000,
      })
      .toBe(0);

    // 2. Navigate through My Exhibits and Admin on mobile
    // expect: All pages are accessible and functional on mobile
    await expect(page.getByRole('table')).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'Name' })).toBeVisible();

    await gotoGalleryAdmin(page);
    await gotoAdminSection(page, 'Collections');
    await expect(page.getByRole('button', { name: 'Add Collection' })).toBeVisible();
    await expect
      .poll(horizontalOverflow, {
        message: 'admin view overflows the mobile viewport horizontally',
        timeout: 10000,
      })
      .toBe(0);

    // Return to the home page for the desktop check.
    await page.locator('a.nolink', { has: page.locator('h2:text("Administration")') }).click();
    await expect(page).toHaveTitle('Gallery');

    // 3. Resize back to desktop dimensions
    await page.setViewportSize({ width: 1920, height: 1080 });

    // expect: Application returns to desktop layout
    await expect(page.getByText('Gallery - Exercise Information Sharing')).toBeVisible();
    await expect(page.getByRole('table')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Admin User' })).toBeVisible();
    await expect
      .poll(horizontalOverflow, {
        message: 'page overflows the desktop viewport horizontally',
        timeout: 10000,
      })
      .toBe(0);
  });
});
