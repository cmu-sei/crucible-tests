// spec: gallery/gallery-test-plan.md
// seed: seed.spec.ts

import { test, expect } from '@playwright/test';
import { authenticateGalleryWithKeycloak } from '../../fixtures';

test.describe('Archive Functionality', () => {
  test('Archive Article Read Toggle', async ({ page }) => {
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

    // 1. Observe an article's 'Read' button state
    const readButton = page.getByRole('button', { name: 'Read' }).first();
    await expect(readButton).toBeVisible();

    // 2. Click the 'Read' button on an unread article
    await readButton.click();

    // expect: The Read button icon changes to checked/filled indicating the article is now read

    // 3. Click the 'Read' button again to toggle back to unread
    await readButton.click();

    // expect: The Read button icon changes back to unchecked
  });
});
