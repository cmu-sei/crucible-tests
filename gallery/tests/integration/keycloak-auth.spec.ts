// spec: gallery/gallery-test-plan.md
// seed: seed.spec.ts

import { test, expect } from '@playwright/test';
import { Services } from '../../fixtures';

test.describe('Integration and API', () => {
  test('Keycloak Authentication Integration', async ({ page }) => {
    // 1. Navigate to http://localhost:4723
    await page.goto(Services.Gallery.UI);

    // expect: Application redirects to Keycloak login page
    await page.waitForURL(/localhost:8443.*realms\/crucible/, { timeout: 15000 });
    await page.getByRole('button', { name: 'Sign In' }).waitFor({ state: 'visible' });

    // 2. Enter valid credentials and submit
    await page.getByRole('textbox', { name: 'Username or email' }).fill('admin');
    await page.getByRole('textbox', { name: 'Password' }).fill('admin');
    await page.getByRole('button', { name: 'Sign In' }).click();

    // expect: Keycloak authenticates the user
    // expect: User is redirected back to Gallery via auth-callback
    // expect: User lands on the My Exhibits page
    await expect(page).toHaveTitle('Gallery');
    await expect(page.getByText('My Exhibits')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Admin User' })).toBeVisible();
  });
});
