// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: topomojo/topomojo-test-plan.md
// seed: tests/seed.spec.ts

import { test, expect } from '@playwright/test';
import { authenticateTopoMojoWithKeycloak, Services } from '../../fixtures';

test.use({ storageState: { cookies: [], origins: [] } });

test.describe('Workspace Management', () => {
  test('Create Workspace - Unauthorized User', async ({ page }) => {

    // 1. Log in as user without creator role (user1 has default-roles-crucible only, no Creator role)
    await authenticateTopoMojoWithKeycloak(page, 'user1', 'user1');

    // expect: User is on home page
    await expect(page).toHaveURL(/localhost:4201/);

    // expect: User is not an admin - no Admin button in nav
    const adminButton = page.getByRole('button', { name: 'Admin' });
    await expect(adminButton).not.toBeVisible();

    // 2. Verify the TopoMojo API enforces the creator role restriction.
    // The UI shows the "New Workspace" button to all authenticated users, but the API
    // returns 403 Forbidden when a user without the Creator role attempts to create one.
    const [response] = await Promise.all([
      page.waitForResponse(
        (res) => res.url().includes('/api/workspace') && res.request().method() === 'POST',
        { timeout: 15000 }
      ),
      // Click the New Workspace button to trigger the API call
      page.getByRole('button', { name: /new workspace/i }).click(),
    ]);

    // expect: API returns 403 Forbidden for non-creator user
    expect(response.status()).toBe(403);
  });
});
