// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: specs/blueprint-test-plan.md
// seed: tests/seed.spec.ts

import { test, expect, Services } from '../../fixtures';
import {
  getKeycloakAdminToken,
  createKeycloakUser,
  deleteKeycloakUser,
  tempUsername,
  getUserToken,
} from '../../../keycloak-admin';
import { getBlueprintToken, createMsel, deleteMsel } from '../../test-helpers';

test.describe('Error Handling and Validation', () => {
  test.describe('Unauthorized Action Handling', () => {
    // Override storageState for this describe block - non-admin user needs fresh login
    test.use({ storageState: { cookies: [], origins: [] } });

    let adminToken: string;
    let nonAdminUserId: string;
    let nonAdminUsername: string;
    let nonAdminPassword: string;
    let mselId: string;

    test.beforeEach(async () => {
      // Create a non-admin Keycloak user (no Administrator role)
      adminToken = await getKeycloakAdminToken();
      nonAdminUsername = tempUsername('blueprinttest');
      nonAdminPassword = 'TestPassword123!';
      const user = await createKeycloakUser(adminToken, {
        username: nonAdminUsername,
        password: nonAdminPassword,
        email: `${nonAdminUsername}@test.local`,
        realmRoles: [], // No roles - regular user
      });
      nonAdminUserId = user.id;

      // Seed a MSEL using admin token for the non-admin user to attempt to access
      const blueprintAdminToken = await getBlueprintToken();
      const msel = await createMsel(blueprintAdminToken);
      mselId = msel.id;
    });

    test.afterEach(async () => {
      // Clean up: delete the non-admin user and the MSEL
      if (nonAdminUserId) {
        await deleteKeycloakUser(adminToken, nonAdminUserId);
      }
      if (mselId) {
        const blueprintAdminToken = await getBlueprintToken();
        await deleteMsel(blueprintAdminToken, mselId);
      }
    });

    test('Non-admin user receives 403 Forbidden on admin API calls', async ({ page, context }) => {
      // Authenticate as non-admin user via Keycloak
      await page.goto(Services.Blueprint.UI);
      const usernameField = page.getByRole('textbox', { name: /username/i });
      await expect(usernameField).toBeVisible({ timeout: 20000 });
      await usernameField.fill(nonAdminUsername);
      await page.getByRole('textbox', { name: /password/i }).fill(nonAdminPassword);
      await page.getByRole('button', { name: /sign in/i }).click();

      // Wait for redirect back to Blueprint
      const appShell = page.locator('app-root mat-toolbar').first();
      await expect(appShell).toBeVisible({ timeout: 30000 });

      // Verify user landed on Blueprint home
      await expect(page).toHaveURL(Services.Blueprint.UI, { timeout: 10000 });

      // Attempt to navigate to the admin page directly and wait for initial API call
      const forbiddenResponsePromise = page.waitForResponse(
        response => response.url().includes('/api/') && response.status() === 403,
        { timeout: 10000 }
      );

      await page.goto(`${Services.Blueprint.UI}/admin`);

      // expect: At least one API call returns 403 Forbidden
      const forbiddenResponse = await forbiddenResponsePromise;
      expect(forbiddenResponse.status()).toBe(403);

      // expect: The page shows the Administration heading (UI renders even though API blocks data)
      const adminHeading = page.getByRole('heading', { name: 'Administration' });
      await expect(adminHeading).toBeVisible({ timeout: 5000 });

      // This demonstrates correct authorization: the UI router allows the page to render,
      // but the API enforces role-based access control and returns 403 for unauthorized requests.
      // The non-admin user sees the page shell but cannot load admin data.
    });
  });
});
