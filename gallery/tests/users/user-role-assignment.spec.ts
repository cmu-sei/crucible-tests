// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: gallery/gallery-test-plan.md
// seed: seed.spec.ts

import {
  test,
  expect,
  gotoGalleryAdmin,
  gotoAdminSection,
  openMatSelect,
  Services,
} from '../../fixtures';
import { request as pwRequest, APIRequestContext } from '@playwright/test';
import { randomUUID } from 'crypto';

/**
 * This spec used to mutate the **admin** user's role and revert it inline. A
 * mid-test failure left admin with a changed role, which can strip the
 * permissions every later test depends on. Instead, seed a disposable user
 * (`POST /api/users` takes an arbitrary id/name — see
 * Gallery.Api/Services/UserService.CreateAsync) and mutate that.
 */
async function galleryApi<T>(fn: (ctx: APIRequestContext, token: string) => Promise<T>): Promise<T> {
  const ctx = await pwRequest.newContext({ ignoreHTTPSErrors: true });
  try {
    const tokenRes = await ctx.post(`${Services.Keycloak}/realms/crucible/protocol/openid-connect/token`, {
      form: {
        grant_type: 'password',
        client_id: 'gallery.ui',
        username: 'admin',
        password: 'admin',
        scope: 'openid profile gallery',
      },
    });
    if (!tokenRes.ok()) {
      throw new Error(`Failed to get Gallery API token: ${tokenRes.status()} ${await tokenRes.text()}`);
    }
    return await fn(ctx, (await tokenRes.json()).access_token);
  } finally {
    await ctx.dispose();
  }
}

async function createGalleryUser(id: string, name: string): Promise<void> {
  await galleryApi(async (ctx, token) => {
    const res = await ctx.post(`${Services.Gallery.API}/api/users`, {
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      data: { id, name },
    });
    if (!res.ok()) {
      throw new Error(`Failed to seed Gallery user ${name}: ${res.status()} ${await res.text()}`);
    }
  });
}

async function deleteGalleryUser(id: string): Promise<void> {
  await galleryApi(async (ctx, token) => {
    const res = await ctx.delete(`${Services.Gallery.API}/api/users/${id}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok() && res.status() !== 404) {
      console.warn(`Cleanup: failed to delete Gallery user ${id}: ${res.status()}`);
    }
  });
}

/** Read the user's currently-assigned system role id straight from the API. */
async function getGalleryUserRoleId(id: string): Promise<string | null> {
  return galleryApi(async (ctx, token) => {
    const res = await ctx.get(`${Services.Gallery.API}/api/users/${id}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok()) {
      throw new Error(`Failed to read Gallery user ${id}: ${res.status()}`);
    }
    return (await res.json()).roleId ?? null;
  });
}

test.describe('User Management', () => {
  let userId: string;
  let userName: string;

  test.beforeEach(async () => {
    userId = randomUUID();
    userName = `RoleAssignTest ${Date.now()}${Math.floor(Math.random() * 1e6)}`;
    await createGalleryUser(userId, userName);
  });

  // Deleting the disposable user removes the role assignment with it, so this
  // single teardown covers every mid-test failure point.
  test.afterEach(async () => {
    await deleteGalleryUser(userId);
  });

  test('User Role Assignment', async ({ galleryAuthenticatedPage: page }) => {
    await gotoGalleryAdmin(page);

    // Navigate to Users section
    await gotoAdminSection(page, 'Users');
    await expect(page.getByRole('columnheader', { name: 'Role' })).toBeVisible();

    // The list paginates at 20 rows, so filter down to the seeded user first.
    // The search input filters on `keyup`, so fill() alone would not apply it.
    const searchField = page.getByRole('textbox', { name: 'Search' });
    await searchField.fill(userName);
    await searchField.press('End');

    const userRow = page.getByRole('row').filter({ hasText: userName });
    await expect(userRow).toHaveCount(1);

    // 1. Observe the Role dropdown for the user (a freshly-seeded user has no
    //    local role, so it shows 'None Locally')
    const roleDropdown = userRow.getByRole('combobox');
    await expect(roleDropdown).toHaveText('None Locally');
    expect(await getGalleryUserRoleId(userId)).toBeNull();

    // 2. Click the Role dropdown for the user
    // openMatSelect rather than a bare click: the reopen in step 4 would otherwise race
    // this panel's exit animation, and its options — still in the DOM through that
    // animation — would make the page-scoped `listbox` lookup ambiguous. See the helper.
    const listbox = await openMatSelect(roleDropdown);

    // expect: Available roles are listed, including the built-in system roles
    await expect(listbox.getByRole('option', { name: 'None Locally' })).toBeVisible();
    await expect(listbox.getByRole('option', { name: 'Administrator' })).toBeVisible();

    // 3. Select a different role ('Content Developer')
    await listbox.getByRole('option', { name: 'Content Developer' }).click();

    // expect: The user's role is updated, both in the UI and server-side
    await expect(roleDropdown).toHaveText('Content Developer');
    expect(await getGalleryUserRoleId(userId)).not.toBeNull();

    // 4. Change the role back to 'None Locally'
    const listbox2 = await openMatSelect(roleDropdown);
    await listbox2.getByRole('option', { name: 'None Locally' }).click();
    await expect(listbox2).toHaveCount(0);

    // expect: The user's role is reverted
    await expect(roleDropdown).toHaveText('None Locally');
    expect(await getGalleryUserRoleId(userId)).toBeNull();
  });
});
