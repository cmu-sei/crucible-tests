// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: gameboard/gameboard-test-plan.md
// seed: seed.spec.ts

import { test, expect, Services } from '../../fixtures';
import { getAdminToken } from '../../api-helpers';
import { getUserToken } from '../../../keycloak-admin';
import { APIRequestContext, request as playwrightRequest } from '@playwright/test';

// Takes one of this worker's pool users, registers them in Gameboard, then verifies
// GET /api/user/{id} returns the expected details.
test.describe('Admin - Users', () => {
  let gbToken: string;

  test.beforeEach(async () => {
    gbToken = await getAdminToken();
  });

  // Nothing to reset: the POST below is the idempotent first-login registration, and
  // the pool user's Gameboard row belongs to the worker fixture.
  test('View User Details and Activity', async ({ gameboardAuthenticatedPage: page, nonAdminUser: u }) => {
    const userToken = await getUserToken(u.username, u.password);

    const ctx: APIRequestContext = await playwrightRequest.newContext({ ignoreHTTPSErrors: true });
    try {
      // Provision the Gameboard user record.
      await ctx.fetch(`${Services.Gameboard.API}/api/user`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${userToken}`, 'Content-Type': 'application/json' },
        data: { id: u.userId },
      });

      // Admin fetches details.
      const res = await ctx.fetch(`${Services.Gameboard.API}/api/user/${u.userId}`, {
        headers: { Authorization: `Bearer ${gbToken}` },
      });
      expect(res.ok()).toBe(true);
      const detail = await res.json();
      expect(detail.id).toBe(u.userId);
    } finally {
      await ctx.dispose();
    }

    await page.goto(Services.Gameboard.UI + '/admin/registrar/users', { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('heading', { name: 'Users' })).toBeVisible();
  });
});
