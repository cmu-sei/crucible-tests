// spec: gallery/gallery-test-plan.md
// seed: seed.spec.ts

import { test, expect } from '@playwright/test';
import { Services } from '../../fixtures';

test.describe('Authentication and Authorization', () => {
  test('Unauthorized Access Prevention', async ({ page }) => {
    // 1. Without authentication, attempt to access http://localhost:4723
    await page.goto(Services.Gallery.UI);

    // expect: The application redirects to Keycloak login page
    // The Angular OIDC client redirects asynchronously, so we need to wait for the Keycloak URL first
    await page.waitForURL(/localhost:8443.*realms\/crucible/, { timeout: 30000 });
    await page.getByRole('button', { name: 'Sign In' }).waitFor({ state: 'visible' });
    await expect(page).toHaveURL(/localhost:8443.*realms\/crucible/);

    // 2. Without authentication, attempt to access http://localhost:4723/admin
    await page.goto(`${Services.Gallery.UI}/admin`);

    // expect: The application redirects to Keycloak login page
    await page.waitForURL(/localhost:8443.*realms\/crucible/, { timeout: 30000 });
    await page.getByRole('button', { name: 'Sign In' }).waitFor({ state: 'visible' });
    await expect(page).toHaveURL(/localhost:8443.*realms\/crucible/);
  });
});
