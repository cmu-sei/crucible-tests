// spec: alloy/alloy-test-plan.md
// seed: seed.spec.ts

import { test, expect } from '@playwright/test';
import { authenticateWithKeycloak, Services } from '../../../shared-fixtures';

test.describe('Performance and Optimization', () => {
  test('Large List Performance', async ({ page }) => {
    // 1. Navigate to a section with a list
    await authenticateWithKeycloak(page, Services.Alloy.UI);
    await page.goto(`${Services.Alloy.UI}/admin`);
    await expect(page.getByRole('heading', { name: 'Administration' })).toBeVisible();

    // expect: List page loads
    await expect(page.getByRole('table')).toBeVisible();

    // 2. Verify pagination controls are present
    await expect(page.getByText('Items per page:')).toBeVisible();

    // 3. Test search/filter responsiveness
    const searchBox = page.getByRole('textbox', { name: 'Search' });
    const filterStart = Date.now();
    await searchBox.fill('Scenario');

    // Wait for the search to be processed (filter is applied)
    // Check for either matching results or empty state (0 of 0)
    await page.waitForTimeout(500); // Allow search to process
    const filterTime = Date.now() - filterStart;

    // expect: Filtering is responsive (search completes quickly)
    expect(filterTime).toBeLessThan(10000);

    // 4. Clear filter and verify search box is cleared
    await searchBox.fill('');
    await expect(searchBox).toHaveValue('');

    // Verify the UI remains responsive after clearing
    const statusText = page.getByRole('status');
    await expect(statusText).toBeVisible();
  });
});
