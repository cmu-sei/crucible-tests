// spec: gallery/gallery-test-plan.md
// seed: seed.spec.ts

import { test, expect } from '@playwright/test';
import { authenticateGalleryWithKeycloak } from '../../fixtures';

test.describe('Wall View Functionality', () => {
  test('Wall Navigation to Archive', async ({ page }) => {
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

    // 1. Click the 'Archive' button on the Wall page
    await page.getByRole('button', { name: 'Archive' }).click();

    // expect: User is navigated to the Archive view for the same exhibit
    // expect: The page title changes to 'Gallery Archive'
    await expect(page).toHaveTitle(/Gallery Archive/);

    // Navigate back to Wall
    await page.getByRole('button', { name: 'Wall' }).click();
    await expect(page).toHaveTitle('Gallery Wall');

    // 2. Click the 'Administration' button on the Wall page
    await page.getByRole('button', { name: 'Administration' }).click();

    // expect: User is navigated to the admin section
    await expect(page).toHaveTitle('Gallery Admin');
  });
});
