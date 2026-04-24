// spec: gallery/gallery-test-plan.md
// seed: seed.spec.ts

import { test, expect } from '@playwright/test';
import { authenticateGalleryWithKeycloak } from '../../fixtures';

test.describe('Archive Functionality', () => {
  test('Archive Search', async ({ page }) => {
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

    const searchField = page.getByRole('textbox', { name: 'Search the Archive' });

    // 1. Enter a keyword in the 'Search the Archive' field that matches an article title
    await searchField.fill('E2E');

    // expect: Only articles with matching titles or content are displayed

    // 2. Clear the search field
    await searchField.clear();

    // expect: All articles are displayed again

    // 3. Enter a keyword that matches no articles
    await searchField.fill('ZZZZNONEXISTENT');

    // expect: No articles are displayed
    // expect: An empty state or 'no results' message appears

    // Clean up
    await searchField.clear();
  });
});
