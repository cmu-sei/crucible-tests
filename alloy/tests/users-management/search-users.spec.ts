// spec: alloy/alloy-test-plan.md
// seed: seed.spec.ts

import { test, expect } from '@playwright/test';
import { authenticateWithKeycloak, Services } from '../../../shared-fixtures';

test.describe('Users Management', () => {
  test('Search Users', async ({ page }) => {
    // 1. Navigate to admin Users section
    await authenticateWithKeycloak(page, Services.Alloy.UI);
    await page.goto(`${Services.Alloy.UI}/admin`);
    await expect(page.getByRole('heading', { name: 'Administration' })).toBeVisible();

    await page.locator('mat-list-item').filter({ hasText: 'Users' }).click();

    // expect: Users list is visible
    await expect(page.getByRole('table')).toBeVisible();

    // 2. Enter a search term (username or name) in the search box
    const searchBox = page.getByRole('textbox', { name: 'Search' });
    await searchBox.clear();
    await searchBox.pressSequentially('Admin');

    // expect: The list filters to show only matching users
    await expect(page.getByRole('cell', { name: 'Admin User' })).toBeVisible();

    // 3. Search for non-existent user
    await searchBox.clear();
    await searchBox.pressSequentially('XyZzZyNoMatch123');

    // expect: No matching users shown (wait for the filter to be applied)
    await expect(page.locator('tbody tr')).toHaveCount(0);
    await expect(page.getByRole('cell', { name: 'Admin User' })).not.toBeVisible();

    // 4. Clear the search box
    await searchBox.clear();

    // expect: All users are displayed again
    await expect(page.getByRole('cell', { name: 'Admin User' })).toBeVisible();
  });
});
