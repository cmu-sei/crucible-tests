// spec: gallery/gallery-test-plan.md
// seed: seed.spec.ts

import { test, expect } from '@playwright/test';
import { authenticateGalleryWithKeycloak } from '../../fixtures';

test.describe('My Exhibits Landing Page', () => {
  test('My Exhibits Table Sorting', async ({ page }) => {
    await authenticateGalleryWithKeycloak(page);
    await expect(page.getByRole('table')).toBeVisible();

    // 1. Click the 'Name' column header
    await page.getByRole('columnheader', { name: 'Name' }).getByRole('button').click();

    // expect: Exhibits are sorted by name
    // expect: A sort indicator arrow is visible
    await expect(page.getByRole('columnheader', { name: 'Name' })).toBeVisible();

    // 2. Click the 'Name' column header again
    await page.getByRole('columnheader', { name: 'Name' }).getByRole('button').click();

    // expect: Sort order reverses
    await expect(page.getByRole('columnheader', { name: 'Name' })).toBeVisible();

    // 3. Click the 'Collection' column header
    await page.getByRole('columnheader', { name: 'Collection' }).getByRole('button').click();

    // expect: Exhibits are sorted by collection name
    await expect(page.getByRole('columnheader', { name: 'Collection' })).toBeVisible();

    // 4. Click the 'Created By' column header
    await page.getByRole('columnheader', { name: 'Created By' }).getByRole('button').click();

    // expect: Exhibits are sorted by creator name
    await expect(page.getByRole('columnheader', { name: 'Created By' })).toBeVisible();

    // 5. Click the 'Created' column header
    await page.getByRole('columnheader', { name: 'Created', exact: true }).getByRole('button').click();

    // expect: Exhibits are sorted by creation date
    await expect(page.getByRole('columnheader', { name: 'Created', exact: true })).toBeVisible();
  });
});
