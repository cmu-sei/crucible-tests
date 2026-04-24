// spec: gallery/gallery-test-plan.md
// seed: seed.spec.ts

import { test, expect } from '@playwright/test';
import { authenticateGalleryWithKeycloak, Services } from '../../fixtures';

test.describe('Authentication and Authorization', () => {
  test('Session Logout', async ({ page }) => {
    // 1. Log in successfully and verify the user's session
    await authenticateGalleryWithKeycloak(page);

    // expect: User is logged in and can see the My Exhibits page
    await expect(page.getByText('My Exhibits')).toBeVisible();

    // 2. Click 'Admin User' button in the top navigation to open the user menu
    await page.getByRole('button', { name: 'Admin User' }).click();

    // expect: A dropdown menu appears with 'Administration', 'Logout', and 'Dark Theme' options
    await expect(page.getByRole('menuitem', { name: 'Administration' })).toBeVisible();
    await expect(page.getByRole('menuitem', { name: 'Logout' })).toBeVisible();
    await expect(page.getByText('Dark Theme')).toBeVisible();

    // 3. Click the 'Logout' menu item
    await page.getByRole('menuitem', { name: 'Logout' }).click();

    // expect: User is logged out and redirected to Keycloak login page or public landing page
    // The OIDC logout redirects asynchronously, so we need to wait for the Keycloak URL first
    await page.waitForURL(/localhost:8443.*realms\/crucible/, { timeout: 30000 });
    await page.getByRole('button', { name: 'Sign In' }).waitFor({ state: 'visible' });

    // 4. Attempt to access http://localhost:4723 after logout
    await page.goto(Services.Gallery.UI);

    // expect: User is redirected to Keycloak login page
    await page.waitForURL(/localhost:8443.*realms\/crucible/, { timeout: 30000 });
    await page.getByRole('button', { name: 'Sign In' }).waitFor({ state: 'visible' });
    await expect(page).toHaveURL(/localhost:8443.*realms\/crucible/);
  });
});
