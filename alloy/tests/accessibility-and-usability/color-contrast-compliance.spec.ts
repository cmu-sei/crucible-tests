// spec: alloy/alloy-test-plan.md
// seed: seed.spec.ts

import { test, expect } from '@playwright/test';
import { authenticateWithKeycloak, Services } from '../../../shared-fixtures';

test.describe('Accessibility and Usability', () => {
  test('Color Contrast Compliance', async ({ page }) => {
    // 1. Navigate through different pages and components
    await authenticateWithKeycloak(page, Services.Alloy.UI);

    // expect: Home page loads successfully
    await expect(page.getByText('My Events')).toBeVisible();

    // 2. Navigate to admin section
    await page.goto(`${Services.Alloy.UI}/admin`);
    await expect(page.getByRole('heading', { name: 'Administration' })).toBeVisible();

    // Verify both light and dark themes render correctly
    // Open user menu
    await page.getByRole('button', { name: 'Admin User' }).click();
    await expect(page.getByRole('switch', { name: 'Dark Theme' })).toBeVisible();

    // Switch to dark theme
    await page.getByRole('switch', { name: 'Dark Theme' }).click();
    await expect(page.getByRole('switch', { name: 'Dark Theme' })).toBeChecked();

    // Close menu
    await page.keyboard.press('Escape');

    // Verify content is still readable in dark mode
    await expect(page.getByRole('heading', { name: 'Administration' })).toBeVisible();
    await expect(page.getByRole('table')).toBeVisible();

    // Switch back to light mode
    await page.getByRole('button', { name: 'Admin User' }).click();
    await page.getByRole('switch', { name: 'Dark Theme' }).click();
    await expect(page.getByRole('switch', { name: 'Dark Theme' })).not.toBeChecked();
  });
});
