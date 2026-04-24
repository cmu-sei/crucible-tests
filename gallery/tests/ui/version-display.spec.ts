// spec: gallery/gallery-test-plan.md
// seed: seed.spec.ts

import { test, expect } from '@playwright/test';
import { authenticateGalleryWithKeycloak } from '../../fixtures';

test.describe('Admin Navigation and UI', () => {
  test('Version Display', async ({ page }) => {
    await authenticateGalleryWithKeycloak(page);

    // 1. Navigate to the admin section
    await page.getByRole('button', { name: 'Administration' }).click();
    await expect(page).toHaveTitle('Gallery Admin');

    // expect: Version information is displayed at the bottom of the sidebar
    await expect(page.getByText(/Versions: UI .+, API .+/)).toBeVisible();
  });
});
