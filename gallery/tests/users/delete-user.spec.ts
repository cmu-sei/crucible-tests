// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: gallery/gallery-test-plan.md
// seed: seed.spec.ts

import { test, expect, gotoGalleryAdmin, gotoAdminSection, Services } from '../../fixtures';
import { request as pwRequest } from '@playwright/test';
import { randomUUID } from 'crypto';

/**
 * Gallery mirrors identity-provider users into its own `users` table, and
 * `POST /api/users` accepts an arbitrary id/name pair (see
 * Gallery.Api/Services/UserService.CreateAsync — it just persists the entity).
 * That means a disposable subject can be seeded straight through the Gallery API
 * without provisioning a Keycloak account and logging in as it first, which is
 * what would otherwise be required for the user to appear in this list.
 */
async function galleryApi<T>(fn: (ctx: import('@playwright/test').APIRequestContext, token: string) => Promise<T>): Promise<T> {
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

/** Delete the seeded user. Safe when the test already deleted it through the UI. */
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

test.describe('User Management', () => {
  let userId: string;
  let userName: string;

  test.beforeEach(async () => {
    // Own the subject of the test outright — never delete a pre-existing user or
    // depend on the current shape of the users table.
    userId = randomUUID();
    userName = `DeleteUserTest ${Date.now()}${Math.floor(Math.random() * 1e6)}`;
    await createGalleryUser(userId, userName);
  });

  // Runs even when the test body throws before/instead of the UI deletion.
  test.afterEach(async () => {
    await deleteGalleryUser(userId);
  });

  test('Delete User', async ({ galleryAuthenticatedPage: page }) => {
    await gotoGalleryAdmin(page);

    // Navigate to Users section
    await gotoAdminSection(page, 'Users');
    await expect(page.getByRole('columnheader', { name: 'Name' })).toBeVisible();

    // The list paginates at 20 rows, so filter down to the seeded user first.
    // The search input filters on `keyup`, so fill() alone would not apply it.
    const searchField = page.getByRole('textbox', { name: 'Search' });
    await searchField.fill(userName);
    await searchField.press('End');

    const userRow = page.getByRole('row').filter({ hasText: userName });
    await expect(userRow).toHaveCount(1);

    // 1. Click the 'Delete User' button (trash icon) on the seeded user's row
    await userRow.getByRole('button', { name: 'Delete User' }).click();

    // expect: A confirmation dialog appears naming the user
    const confirmDialog = page.getByRole('dialog');
    await expect(confirmDialog).toBeVisible();
    await expect(confirmDialog).toContainText(userName);

    // 2. Cancel first — the user must survive a declined confirmation
    await confirmDialog.getByRole('button', { name: 'Cancel' }).click();
    await expect(confirmDialog).not.toBeVisible();
    await expect(userRow).toHaveCount(1);

    // 3. Delete again and confirm
    await userRow.getByRole('button', { name: 'Delete User' }).click();
    const confirmDialog2 = page.getByRole('dialog');
    await expect(confirmDialog2).toBeVisible();
    await confirmDialog2.getByRole('button', { name: 'Delete' }).click();
    await expect(confirmDialog2).not.toBeVisible();

    // expect: User is removed from the list
    await expect(page.getByRole('row').filter({ hasText: userName })).toHaveCount(0);

    // expect: The deletion is persisted server-side, not just dropped from the
    // client-side store.
    const stillExists = await galleryApi(async (ctx, token) => {
      const res = await ctx.get(`${Services.Gallery.API}/api/users/${userId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      return res.ok();
    });
    expect(stillExists).toBe(false);
  });
});
