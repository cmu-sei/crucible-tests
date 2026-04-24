// spec: gallery/gallery-test-plan.md
// seed: seed.spec.ts

import { test, expect } from '@playwright/test';
import { authenticateGalleryWithKeycloak } from '../../fixtures';

test.describe('Archive Functionality', () => {
  test('Archive Page Display', async ({ page }) => {
    await authenticateGalleryWithKeycloak(page);
    await expect(page.getByRole('table')).toBeVisible();

    // 1. Log in and navigate to an exhibit, then click the 'Archive' button
    const exhibitLink = page.getByRole('cell').getByRole('link').first();
    await exhibitLink.click();
    await expect(page).toHaveURL(/\?exhibit=/);

    // Navigate to Archive if on Wall
    const archiveButton = page.getByRole('button', { name: 'Archive' });
    if (await archiveButton.isVisible().catch(() => false)) {
      await archiveButton.click();
    }

    // expect: The Archive page loads with the title 'Gallery Archive (N)'
    await expect(page).toHaveTitle(/Gallery Archive/);

    // expect: Source type filter buttons are visible
    await expect(page.getByRole('button', { name: 'Intel' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Reporting' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Orders' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'News' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Social' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Phone' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Email' })).toBeVisible();

    // expect: A search field 'Search the Archive' is visible
    await expect(page.getByRole('textbox', { name: 'Search the Archive' })).toBeVisible();

    // expect: A card filter dropdown 'All Cards' is visible
    await expect(page.getByRole('combobox', { name: 'All Cards' })).toBeVisible();

    // expect: Team indicator shows current team name
    await expect(page.getByText('Team:')).toBeVisible();

    // expect: Articles are displayed with action buttons
    await expect(page.getByRole('button', { name: 'View' }).first()).toBeVisible();
    await expect(page.getByRole('button', { name: 'Read' }).first()).toBeVisible();
    await expect(page.getByRole('button', { name: 'Share' }).first()).toBeVisible();
  });
});
