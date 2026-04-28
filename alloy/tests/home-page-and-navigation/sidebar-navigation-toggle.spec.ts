// spec: alloy/alloy-test-plan.md
// seed: seed.spec.ts

import { test, expect } from '@playwright/test';
import { authenticateWithKeycloak, Services } from '../../../shared-fixtures';

test.describe('Home Page and Navigation', () => {
  test('Sidebar Navigation Toggle', async ({ page }) => {
    // 1. Navigate to http://localhost:4403/admin
    await authenticateWithKeycloak(page, Services.Alloy.UI);
    await page.goto(`${Services.Alloy.UI}/admin`);

    // expect: Admin page loads with sidebar visible
    await expect(page.getByRole('heading', { name: 'Administration' })).toBeVisible();
    await expect(page.locator('mat-list').getByText('Event Templates')).toBeVisible();
    await expect(page.locator('mat-list').getByText('Events')).toBeVisible();

    // 2. Click the "Exit Administration" link to toggle back to home
    await page.getByRole('link', { name: 'Administration' }).click();

    // expect: The sidebar collapses and user returns to home page
    await expect(page).toHaveURL(/localhost:4403/);
    await expect(page.getByText('My Events')).toBeVisible();

    // Navigate back to admin using the "Show Administration Page" button
    await page.getByRole('button', { name: 'Show Administration Page' }).click();

    // expect: The admin sidebar expands and is visible again
    await expect(page.getByRole('heading', { name: 'Administration' })).toBeVisible();
    await expect(page.locator('mat-list').getByText('Event Templates')).toBeVisible();
  });
});
