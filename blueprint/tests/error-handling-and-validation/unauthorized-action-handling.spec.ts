// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: specs/blueprint-test-plan.md
// seed: tests/seed.spec.ts
//
// What a signed-in user with no Blueprint permissions *sees*. That the API refuses them
// (401/403 per route) is Blueprint.Api.Tests' job — RouteAuthorizationTests tables every route —
// so this spec asserts only the UI's gating: the controls a permission-less user is shown, and
// the ones withheld. A fresh Keycloak user with no realm roles has an empty
// `/api/me/systempermissions`, so every permission-gated control must be absent or disabled.

import { test, expect, Services } from '../../fixtures';
import {
  getKeycloakAdminToken,
  createKeycloakUser,
  deleteKeycloakUser,
  tempUsername,
} from '../../../keycloak-admin';

test.describe('Error Handling and Validation', () => {
  test.describe('Unauthorized Action Handling', () => {
    // Unauthorized-access specs own their browser context — the shared storage state is admin.
    test.use({ storageState: { cookies: [], origins: [] } });

    let adminToken: string;
    let userId: string | undefined;
    let username: string;
    const password = 'TestPassword123!';

    test.beforeEach(async () => {
      adminToken = await getKeycloakAdminToken();
      username = tempUsername('blueprinttest');
      const user = await createKeycloakUser(adminToken, {
        username,
        password,
        email: `${username}@test.local`,
        realmRoles: [],
      });
      userId = user.id;
    });

    test.afterEach(async () => {
      if (userId) await deleteKeycloakUser(adminToken, userId);
    });

    test('User without permissions is shown no privileged controls', async ({ page }) => {
      // 1. Sign in as the permission-less user.
      await page.goto(Services.Blueprint.UI);
      const usernameField = page.getByRole('textbox', { name: /username/i });
      await expect(usernameField).toBeVisible({ timeout: 20000 });
      await usernameField.fill(username);
      await page.getByRole('textbox', { name: /password/i }).fill(password);

      // The topbar's Administration item is decided by this response, so it is awaited before
      // the menu is opened: an absent item is then a gating decision, not a load still pending.
      const permissionsLoaded = page.waitForResponse(
        (r) => r.url().includes('/api/me/systempermissions') && r.ok(),
        { timeout: 60000 }
      );
      await page.getByRole('button', { name: /sign in/i }).click();
      await expect(page.locator('app-root mat-toolbar').first()).toBeVisible({ timeout: 30000 });
      await permissionsLoaded;

      // expect: the dashboard offers nothing to do — no Join/Start/Manage card.
      await expect(page.getByText('Nothing to see here!')).toBeVisible({ timeout: 15000 });
      await expect(page.getByText('Manage an Event')).toHaveCount(0);
      await expect(page.getByText('Start an Event')).toHaveCount(0);
      await expect(page.getByText('Join an Event')).toHaveCount(0);

      // expect: the user menu has Logout but no Administration entry.
      await page.locator('app-root mat-toolbar button strong').first().click();
      await expect(page.getByRole('menuitem', { name: 'Logout' })).toBeVisible({ timeout: 5000 });
      await expect(page.getByRole('menuitem', { name: 'Administration' })).toHaveCount(0);
      await page.keyboard.press('Escape');

      // 2. Go to /admin directly — the route has no guard, so the shell renders.
      const adminPermissions = page.waitForResponse(
        (r) => r.url().includes('/api/me/systempermissions') && r.ok(),
        { timeout: 30000 }
      );
      await page.goto(`${Services.Blueprint.UI}/admin`);
      await adminPermissions;
      await expect(page.getByRole('heading', { name: 'Administration' })).toBeVisible({
        timeout: 15000,
      });
      await expect(page.locator('div.app-versions')).toContainText('Versions:');

      // expect: the sidebar lists no sections, and no section's content is rendered — every
      // entry and every section body is gated on its own View* permission.
      await expect(page.locator('.appitems-container mat-list-item')).toHaveCount(0);
      await expect(page.locator('mat-sidenav-content table')).toHaveCount(0);
      await expect(page.locator('mat-sidenav-content app-admin-units')).toHaveCount(0);

      // 3. The /build list: the create and upload controls are disabled without CreateMsels.
      await page.goto(`${Services.Blueprint.UI}/build`);
      await expect(page.getByRole('button', { name: 'Add blank MSEL' })).toBeDisabled({
        timeout: 15000,
      });
      await expect(
        page.getByRole('button', { name: 'Upload a new MSEL from a file' })
      ).toBeDisabled();
    });
  });
});
