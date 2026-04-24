// spec: gallery/gallery-test-plan.md
// seed: seed.spec.ts

import { test, expect } from '@playwright/test';
import { authenticateGalleryWithKeycloak } from '../../fixtures';

test.describe('User Management', () => {
  test('View Users List', async ({ page }) => {
    await authenticateGalleryWithKeycloak(page);
    await page.getByRole('button', { name: 'Administration' }).click();
    await expect(page).toHaveTitle('Gallery Admin');

    // 1. Navigate to admin section and click 'Users' in the sidebar
    await page.locator('mat-list-item').filter({ hasText: 'Users' }).getByRole('button').click();

    // expect: Users list page loads with a table showing ID, Name, Role columns
    await expect(page.getByRole('columnheader', { name: 'ID' })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'Name' })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'Role' })).toBeVisible();

    // expect: Each user row shows their UUID with a Copy button, full name, and role dropdown
    const firstUserRow = page.getByRole('row').filter({ hasText: 'Admin User' }).first();
    await expect(firstUserRow).toBeVisible();

    // expect: Role dropdown is visible
    await expect(firstUserRow.getByRole('combobox')).toBeVisible();

    // expect: Pagination controls with 'Items per page' selector (default: 20) are visible
    await expect(page.getByRole('combobox', { name: 'Items per page:' })).toBeVisible();

    // expect: Search field is visible
    await expect(page.getByRole('textbox', { name: 'Search' })).toBeVisible();

    // expect: Add User button is visible
    await expect(page.getByRole('button', { name: 'Add User' })).toBeVisible();
  });
});
