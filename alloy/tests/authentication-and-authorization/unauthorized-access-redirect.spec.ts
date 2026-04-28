// spec: alloy/alloy-test-plan.md
// seed: seed.spec.ts

import { test, expect } from '@playwright/test';

test.describe('Authentication and Authorization', () => {
  test('Unauthorized Access Redirect', async ({ page }) => {
    // 1. Clear all browser cookies and local storage
    await page.context().clearCookies();

    // 2. Navigate to http://localhost:4403
    // Note: The root URL triggers the OIDC redirect to Keycloak for unauthenticated users.
    // The /admin route renders the Angular app shell without triggering the redirect.
    await page.goto('http://localhost:4403');

    // expect: The application redirects to the Keycloak login page
    // The OIDC redirect may happen asynchronously after the Angular app initializes
    await expect(page.getByText('Sign in to your account')).toBeVisible({ timeout: 30000 });
    await expect(page).toHaveURL(/localhost:8443\/realms\/crucible/);
  });
});
