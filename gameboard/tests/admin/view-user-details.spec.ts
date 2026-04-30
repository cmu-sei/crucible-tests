// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: gameboard/gameboard-test-plan.md
// seed: seed.spec.ts

import { test, expect, Services } from '../../fixtures';
import { getAdminToken } from '../../api-helpers';
import {
  getKeycloakAdminToken,
  createKeycloakUser,
  deleteKeycloakUser,
  tempUsername,
  getUserToken,
} from '../../../keycloak-admin';
import { APIRequestContext, request as playwrightRequest } from '@playwright/test';

// Creates a temporary Keycloak user, provisions them in Gameboard, then
// verifies GET /api/user/{id} returns the expected details.
test.describe('Admin - Users', () => {
  let gbToken: string;
  let kcAdmin: string;
  let kcUserId: string | null = null;

  test.beforeEach(async () => {
    gbToken = await getAdminToken();
    kcAdmin = await getKeycloakAdminToken();
  });

  test.afterEach(async () => {
    if (kcUserId) await deleteKeycloakUser(kcAdmin, kcUserId);
  });

  test('View User Details and Activity', async ({ gameboardAuthenticatedPage: page }) => {
    const username = tempUsername('viewUser');
    const u = await createKeycloakUser(kcAdmin, { username, password: 'pw' });
    kcUserId = u.id;
    const userToken = await getUserToken(username, 'pw');

    const ctx: APIRequestContext = await playwrightRequest.newContext({ ignoreHTTPSErrors: true });
    try {
      // Provision the Gameboard user record.
      await ctx.fetch('http://localhost:5002/api/user', {
        method: 'POST',
        headers: { Authorization: `Bearer ${userToken}`, 'Content-Type': 'application/json' },
        data: { id: u.id },
      });

      // Admin fetches details.
      const res = await ctx.fetch(`http://localhost:5002/api/user/${u.id}`, {
        headers: { Authorization: `Bearer ${gbToken}` },
      });
      expect(res.ok()).toBe(true);
      const detail = await res.json();
      expect(detail.id).toBe(u.id);
    } finally {
      await ctx.dispose();
    }

    await page.goto(Services.Gameboard.UI + '/admin/registrar/users', { waitUntil: 'networkidle' });
    await expect(page.getByRole('heading', { name: 'Users' })).toBeVisible();
  });
});
