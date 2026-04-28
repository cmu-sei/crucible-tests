// spec: alloy/alloy-test-plan.md
// seed: seed.spec.ts

import { test, expect } from '@playwright/test';
import { authenticateWithKeycloak, Services } from '../../../shared-fixtures';

test.describe('Home Page and Navigation', () => {
  test('User Menu Theme Toggle', async ({ page }) => {
    // 1. Log in and navigate to the home page
    await authenticateWithKeycloak(page, Services.Alloy.UI);

    // expect: Application loads successfully
    await expect(page.getByRole('button', { name: 'Admin User' })).toBeVisible();

    // 2. Click on the user menu button in the topbar (showing username)
    await page.getByRole('button', { name: 'Admin User' }).click();

    // expect: User menu dropdown appears
    // expect: Menu contains "Administration", "Logout", and "Dark Theme" toggle
    await expect(page.getByRole('menuitem', { name: 'Administration' })).toBeVisible();
    await expect(page.getByRole('menuitem', { name: 'Logout' })).toBeVisible();
    await expect(page.getByRole('switch', { name: 'Dark Theme' })).toBeVisible();

    // 3. Click on the "Dark Theme" toggle switch in the menu
    await page.getByRole('switch', { name: 'Dark Theme' }).click();

    // expect: The application theme switches to dark mode
    await expect(page.getByRole('switch', { name: 'Dark Theme' })).toBeChecked();

    // 4. Click the toggle switch again
    await page.getByRole('switch', { name: 'Dark Theme' }).click();

    // expect: The application theme switches back to light mode
    await expect(page.getByRole('switch', { name: 'Dark Theme' })).not.toBeChecked();
  });
});
