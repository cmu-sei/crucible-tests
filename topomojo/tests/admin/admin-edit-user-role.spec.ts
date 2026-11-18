// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: topomojo/topomojo-test-plan.md
// seed: tests/seed.spec.ts

import { test, expect, topomojoNavLink } from '../../fixtures';
import {
  createTopoMojoUser,
  deleteTopoMojoUser,
  getTopoMojoAdminToken,
  getTopoMojoUser,
} from '../../../topomojo-helpers';

test.describe('Admin Panel', () => {
  let userId: string | undefined;
  const userName = `E2E Role User ${Date.now()}`;

  test.beforeEach(async () => {
    // A TopoMojo user record of its own (no Keycloak account), created the way the user
    // browser's "create" link does, so changing its role touches no real account.
    userId = (await createTopoMojoUser(await getTopoMojoAdminToken(), userName)).id;
  });

  test.afterEach(async () => {
    if (userId) await deleteTopoMojoUser(await getTopoMojoAdminToken(), userId);
    userId = undefined;
  });

  test('Admin - Edit User Role', async ({ topomojoAuthenticatedPage: page }) => {
    // 1. Navigate to admin user browser
    // expect: User list displays
    // Pending upstream: a full page load of /admin can read the OIDC token before the app's
    // settings have loaded and bounce to the home page, so open admin from the top bar.
    await topomojoNavLink(page, 'Admin').click();
    await page.locator('app-admin').getByRole('link', { name: 'Users', exact: true }).click();
    const browser = page.locator('app-user-browser');
    await browser.getByRole('searchbox', { name: 'Search users' }).fill(userName);
    // Each user is a row that shows the user's id; scope to the seeded user's row so other
    // users still listed while the search is debounced don't matter.
    const row = browser.locator('div.row', { hasText: userId! });
    await expect(row.getByText(userName, { exact: true })).toBeVisible();

    // 2. View the user's details
    // expect: User details form opens
    // expect: The role buttons show the user's current role (new users are Users)
    await row.getByRole('button', { name: 'Expand to view user details and role settings.' }).click();
    const roles = row.locator('#role-input');
    await expect(roles.locator('label.active')).toHaveText('User');

    // 3. Change the role to Creator; the role buttons save as soon as one is clicked
    // expect: Role selection accepts the change
    // expect: The change is saved to the user's role
    // expect: The change is reflected in the user list: the row takes the creator highlight
    const saved = page.waitForResponse(
      (r) => r.request().method() === 'POST' && new URL(r.url()).pathname.endsWith('/api/user'),
    );
    await roles.getByText('Creator', { exact: true }).click();
    expect((await saved).ok()).toBe(true);
    await expect(roles.locator('label.active')).toHaveText('Creator');
    await expect(row).toHaveClass(/pop-secondary/);
    const stored = await getTopoMojoUser(await getTopoMojoAdminToken(), userId!);
    expect(stored.role.toLowerCase()).toBe('creator');
  });
});
