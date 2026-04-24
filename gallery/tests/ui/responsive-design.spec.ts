// spec: gallery/gallery-test-plan.md
// seed: seed.spec.ts

import { test, expect } from '@playwright/test';
import { authenticateGalleryWithKeycloak } from '../../fixtures';

test.describe('Responsive Design and Accessibility', () => {
  test('Responsive Design', async ({ page }) => {
    await authenticateGalleryWithKeycloak(page);

    // 1. Resize the browser window to mobile dimensions (e.g., 375x667)
    await page.setViewportSize({ width: 375, height: 667 });

    // expect: Application layout adjusts to mobile view
    // expect: Content is readable without horizontal scrolling
    await expect(page.getByText('My Exhibits')).toBeVisible();

    // 2. Navigate through My Exhibits on mobile
    await expect(page.getByRole('table')).toBeVisible();

    // 3. Resize back to desktop dimensions
    await page.setViewportSize({ width: 1920, height: 1080 });

    // expect: Application returns to desktop layout
    await expect(page.getByText('Gallery - Exercise Information Sharing')).toBeVisible();
    await expect(page.getByRole('table')).toBeVisible();
  });
});
