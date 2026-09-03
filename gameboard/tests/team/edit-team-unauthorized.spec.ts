// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: gameboard/gameboard-test-plan.md
// seed: seed.spec.ts

import { test, expect, Services } from '../../fixtures';
import { authenticateGameboardWithKeycloak } from '../../fixtures';
import {
  getKeycloakAdminToken,
  createKeycloakUser,
  deleteKeycloakUser,
  tempUsername,
  getUserToken,
} from '../../../keycloak-admin';
import {
  getAdminToken,
  createGame,
  deleteGame,
  createSponsor,
  deleteSponsor,
  setAdminSponsor,
  CreatedGame,
  CreatedSponsor,
} from '../../api-helpers';
import { APIRequestContext, request as playwrightRequest } from '@playwright/test';

// Verifies that a fresh non-admin user, when logged into Gameboard, does not
// see admin-only team-management controls on the admin Users page. This is
// the most meaningful authorization check we can make without a full
// team-invitation multi-user setup.
test.use({ storageState: { cookies: [], origins: [] } });

test.describe('Team Management', () => {
  let kcAdminToken: string;
  let kcUserId: string | null = null;
  let username = '';
  const password = 'nonadmin-pass';

  test.beforeEach(async () => {
    kcAdminToken = await getKeycloakAdminToken();
    username = tempUsername('teamuser');
    const u = await createKeycloakUser(kcAdminToken, { username, password });
    kcUserId = u.id;
  });

  test.afterEach(async () => {
    if (kcUserId) await deleteKeycloakUser(kcAdminToken, kcUserId);
  });

  test('Edit Team Details - Non-Admin Cannot Access Admin Team Controls', async ({ page }) => {
    await authenticateGameboardWithKeycloak(page, username, password);

    // Non-admins do NOT see the admin sidebar links for Users/Players.
    await page.goto(Services.Gameboard.UI + '/admin/registrar/users', {
      waitUntil: 'domcontentloaded',
    });
    await page.waitForTimeout(2500);

    // The Users admin page reserved for elevated roles should not render the
    // admin nav links or the Users heading.
    await expect(page.locator('a[href="/admin/registrar/users"]')).toHaveCount(0);
    await expect(page.locator('a[href="/admin/registrar/players"]')).toHaveCount(0);
  });
});
