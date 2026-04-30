// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: gameboard/gameboard-test-plan.md
// seed: seed.spec.ts

import { test, expect, Services } from '../../fixtures';
import {
  getKeycloakAdminToken,
  createKeycloakUser,
  deleteKeycloakUser,
  tempUsername,
  getUserToken,
} from '../../../keycloak-admin';
import { getAdminToken } from '../../api-helpers';
import { APIRequestContext, request as playwrightRequest } from '@playwright/test';

// Creates a fresh Keycloak user, logs in once to provision a Gameboard user
// record, then promotes them to "Support" role via the Gameboard PUT /api/user
// endpoint. We verify the role assignment by reading the user back.
test.describe('Admin - Users', () => {
  let kcAdminToken: string;
  let kcUserId: string | null = null;
  let username = '';
  const password = 'assignrole-pass';

  test.beforeEach(async () => {
    kcAdminToken = await getKeycloakAdminToken();
    username = tempUsername('roleuser');
    const u = await createKeycloakUser(kcAdminToken, { username, password });
    kcUserId = u.id;
  });

  test.afterEach(async () => {
    if (kcUserId) await deleteKeycloakUser(kcAdminToken, kcUserId);
  });

  test('Assign User Roles - Promote to Support', async ({ gameboardAuthenticatedPage: page }) => {
    // Step 1: Provision the Gameboard user record by calling POST /api/user
    // with the Keycloak user's bearer token. Gameboard uses this as its
    // registration endpoint (invoked by the Angular OIDC client after login).
    const newUserToken = await getUserToken(username, password);
    const ctx: APIRequestContext = await playwrightRequest.newContext({ ignoreHTTPSErrors: true });
    try {
      const createRes = await ctx.fetch('http://localhost:5002/api/user', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${newUserToken}`,
          'Content-Type': 'application/json',
        },
        data: { id: kcUserId },
      });
      expect(createRes.ok(), `TryCreate status: ${createRes.status()}`).toBe(true);

      // Step 2: As admin, locate the new user and promote to 'support'.
      const adminToken = await getAdminToken();
      // Fetch the user directly by id rather than listing all users (which
      // may paginate and exclude non-elevated accounts).
      const userRes = await ctx.fetch(`http://localhost:5002/api/user/${kcUserId}`, {
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      expect(userRes.ok(), `GET /api/user/${kcUserId} should return 200`).toBe(true);
      const target = await userRes.json();
      expect(target.id).toBe(kcUserId);

      const putRes = await ctx.fetch('http://localhost:5002/api/user', {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${adminToken}`,
          'Content-Type': 'application/json',
        },
        data: { id: target.id, role: 'support' },
      });
      expect(putRes.ok()).toBe(true);

      // Verify the role is set. The API returns "appRole" either as the raw
      // enum value (e.g., "support") or the pretty-printed role name
      // (e.g., "Support"). Match case-insensitively.
      const reRes = await ctx.fetch(`http://localhost:5002/api/user/${target.id}`, {
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      const updated = await reRes.json();
      const role = (updated.appRole ?? updated.role ?? '').toString().toLowerCase();
      expect(role, `user returned: ${JSON.stringify(updated)}`).toContain('support');
    } finally {
      await ctx.dispose();
    }

    // UI sanity check — admin users page is reachable.
    await page.goto(Services.Gameboard.UI + '/admin/registrar/users', { waitUntil: 'networkidle' });
    await expect(page.getByRole('heading', { name: 'Users' })).toBeVisible({ timeout: 15000 });
  });
});
