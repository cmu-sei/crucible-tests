// spec: gallery/gallery-test-plan.md
// seed: seed.spec.ts

import { test, expect } from '@playwright/test';
import { authenticateGalleryWithKeycloak } from '../../fixtures';

test.describe('Authentication and Authorization', () => {
  test('Dark Theme Toggle', async ({ page }) => {
    // 1. Log in and click 'Admin User' button in the top navigation
    await authenticateGalleryWithKeycloak(page);
    await page.getByRole('button', { name: 'Admin User' }).click();

    // expect: User menu dropdown appears with a 'Dark Theme' switch
    const darkThemeSwitch = page.getByRole('switch', { name: 'Dark Theme' });
    await expect(darkThemeSwitch).toBeVisible();

    // 2. Toggle the 'Dark Theme' switch on
    await darkThemeSwitch.click();

    // expect: The application switches to dark theme
    // expect: Background colors change to dark tones
    const body = page.locator('body');
    await expect(body).toHaveClass(/darkMode/);

    // Close the menu
    await page.keyboard.press('Escape');

    // 3. Toggle the 'Dark Theme' switch off
    await page.getByRole('button', { name: 'Admin User' }).click();
    await darkThemeSwitch.click();

    // expect: The application switches back to light theme
    await expect(body).not.toHaveClass(/darkMode/);
  });
});
