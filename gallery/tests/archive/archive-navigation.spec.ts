// spec: gallery/gallery-test-plan.md
// seed: seed.spec.ts

import { test, expect } from '@playwright/test';
import { authenticateGalleryWithKeycloak } from '../../fixtures';

test.describe('Archive Functionality', () => {
  test('Archive Navigation', async ({ page }) => {
    await authenticateGalleryWithKeycloak(page);
    await expect(page.getByRole('table')).toBeVisible();

    // Navigate to an exhibit and the Archive view
    const exhibitLink = page.getByRole('cell').getByRole('link').first();
    await exhibitLink.click();
    await expect(page).toHaveURL(/\?exhibit=/);

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

    // 3. Click the Gallery logo in the top navigation
    // On the admin page, the logo link is labeled "Administration" and navigates to home.
    await page.getByRole('link', { name: 'Administration' }).click();

    // expect: User is navigated to the My Exhibits home page
    await expect(page).toHaveTitle('Gallery');
    await expect(page.getByText('My Exhibits')).toBeVisible();
  });
});
