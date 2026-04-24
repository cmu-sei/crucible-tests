// spec: gallery/gallery-test-plan.md
// seed: seed.spec.ts

import { test, expect } from '@playwright/test';
import { authenticateGalleryWithKeycloak } from '../../fixtures';

test.describe('Archive Functionality', () => {
  test('Archive Article Share', async ({ page }) => {
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

    // 1. Click the 'Share' button on an article
    const shareButton = page.getByRole('button', { name: 'Share' }).first();
    await expect(shareButton).toBeVisible();
    await shareButton.click();

    // expect: A share dialog opens
    // expect: Team selector is available to choose teams to share with
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();

    // 3. Cancel the share dialog without sharing
    // The dialog has two Cancel buttons: an X icon at top-right and a text Cancel button at bottom.
    // Use .last() to target the bottom text Cancel button specifically.
    await dialog.getByRole('button', { name: 'Cancel' }).last().click();

    // expect: Dialog closes without sharing the article
    await expect(dialog).not.toBeVisible();
  });
});
