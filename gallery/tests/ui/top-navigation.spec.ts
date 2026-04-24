// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: gallery/gallery-test-plan.md
// seed: seed.spec.ts

import { test, expect } from '@playwright/test';
import { authenticateGalleryWithKeycloak } from '../../fixtures';

test.describe('Admin Navigation and UI', () => {
  test('Top Navigation Bar', async ({ page }) => {
    await authenticateGalleryWithKeycloak(page);

    // 1. Log in and observe the top navigation bar
    // expect: Gallery logo/icon is visible on the left as a clickable link
    const logoLink = page.locator('a[href="/"]').first();
    await expect(logoLink).toBeVisible();

    // expect: Application title 'Gallery - Exercise Information Sharing' is displayed
    await expect(page.getByText('Gallery - Exercise Information Sharing')).toBeVisible();

    // expect: 'Admin User' button is visible on the right
    await expect(page.getByRole('button', { name: 'Admin User' })).toBeVisible();

    // 2. Click the Gallery logo
    // First navigate to admin so we can test the logo link
    await page.getByRole('button', { name: 'Administration' }).click();
    await expect(page).toHaveTitle('Gallery Admin');

    // Click logo to go back to home
    await page.locator('a[href="/"]').first().click();

    // expect: User is navigated to the My Exhibits home page
    await expect(page).toHaveTitle('Gallery');
    await expect(page.getByText('My Exhibits')).toBeVisible();

    // 3. Click 'Admin User' button
    await page.getByRole('button', { name: 'Admin User' }).click();

    // expect: Dropdown menu appears with 'Administration', 'Logout', and 'Dark Theme' toggle
    await expect(page.getByRole('menuitem', { name: 'Administration' })).toBeVisible();
    await expect(page.getByRole('menuitem', { name: 'Logout' })).toBeVisible();
    await expect(page.getByText('Dark Theme')).toBeVisible();

    // Close the menu
    await page.keyboard.press('Escape');
  });
});
