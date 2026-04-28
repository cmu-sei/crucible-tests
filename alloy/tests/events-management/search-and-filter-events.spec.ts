// spec: alloy/alloy-test-plan.md
// seed: seed.spec.ts

import { test, expect } from '@playwright/test';
import { authenticateWithKeycloak, Services } from '../../../shared-fixtures';

test.describe('Events Management', () => {
  test('Search and Filter Events', async ({ page }) => {
    // 1. Navigate to admin Events section
    await authenticateWithKeycloak(page, Services.Alloy.UI);
    await page.goto(`${Services.Alloy.UI}/admin`);
    await expect(page.getByRole('heading', { name: 'Administration' })).toBeVisible();

    await page.locator('mat-list-item').filter({ hasText: 'Events' }).click();

    // expect: Events list is visible
    await expect(page.getByRole('table')).toBeVisible();

    // 2. Enter a search term in the search box
    const searchBox = page.getByRole('textbox', { name: 'Search' });
    await searchBox.fill('test');

    // 3. Clear the search box
    await searchBox.fill('');

    // 4. Apply status filter - verify Active is checked by default
    await expect(page.getByRole('checkbox', { name: 'Active' })).toBeChecked();

    // 5. Check Ended filter
    await page.getByRole('checkbox', { name: 'Ended' }).check();
    await expect(page.getByRole('checkbox', { name: 'Ended' })).toBeChecked();

    // 6. Check Failed filter
    await page.getByRole('checkbox', { name: 'Failed' }).check();
    await expect(page.getByRole('checkbox', { name: 'Failed' })).toBeChecked();

    // Clear filters - uncheck all
    await page.getByRole('checkbox', { name: 'Ended' }).uncheck();
    await page.getByRole('checkbox', { name: 'Failed' }).uncheck();
  });
});
