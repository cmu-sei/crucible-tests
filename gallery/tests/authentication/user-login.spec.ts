// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: gallery/gallery-test-plan.md
// seed: seed.spec.ts

import { test, expect } from '@playwright/test';
import { Services } from '../../fixtures';

test.describe('Authentication and Authorization', () => {
  test('User Login and Session Management', async ({ page }) => {
    // 1. Navigate to http://localhost:4723
    await page.goto(Services.Gallery.UI);

    // expect: The application redirects to Keycloak login page
    // The Angular OIDC client redirects asynchronously, so we need to wait for the Keycloak URL first
    await page.waitForURL(/localhost:8443.*realms\/crucible/, { timeout: 30000 });
    await page.getByRole('button', { name: 'Sign In' }).waitFor({ state: 'visible' });

    // 2. Enter valid credentials (admin/admin) and click Sign In
    await page.getByRole('textbox', { name: 'Username or email' }).fill('admin');
    await page.getByRole('textbox', { name: 'Password' }).fill('admin');
    await page.getByRole('button', { name: 'Sign In' }).click();

    // expect: User is authenticated and redirected to the Gallery home page
    await expect(page).toHaveTitle('Gallery');

    // expect: The 'My Exhibits' table is visible
    await expect(page.getByRole('table')).toBeVisible();

    // expect: User's name 'Admin User' appears in the top navigation bar
    await expect(page.getByRole('button', { name: 'Admin User' })).toBeVisible();

    // expect: The application title is displayed
    await expect(page.getByText('Gallery - Exercise Information Sharing')).toBeVisible();

    // 3. Verify the home page loads the My Exhibits table with columns: Name, Collection, Created By, Created
    await expect(page.getByRole('columnheader', { name: 'Name' })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'Collection' })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'Created By' })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'Created', exact: true })).toBeVisible();

    // expect: Exhibit names are clickable links
    const firstExhibitLink = page.getByRole('cell').getByRole('link').first();
    await expect(firstExhibitLink).toBeVisible();
  });
});
