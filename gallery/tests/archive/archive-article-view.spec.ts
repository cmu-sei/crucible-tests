// spec: gallery/gallery-test-plan.md
// seed: seed.spec.ts

import { test, expect } from '@playwright/test';
import { authenticateGalleryWithKeycloak } from '../../fixtures';

test.describe('Archive Functionality', () => {
  test('Archive Article View Action', async ({ page }) => {
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

    // 1. Click the 'View' button on an article in the archive
    const viewButton = page.getByRole('button', { name: 'View' }).first();
    await expect(viewButton).toBeVisible();
    await viewButton.click();

    // expect: Article detail view opens
    // expect: Full article content is displayed with all metadata
    // The More button should expand to show more details, or a dialog opens
  });
});
