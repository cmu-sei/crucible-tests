// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: player/player-test-plan.md
// seed: seed.spec.ts

import { test, expect, Services } from '../../fixtures';

test.describe('Navigation', () => {
  test('Breadcrumb Navigation', async ({ playerAuthenticatedPage: page }) => {
    // 1. Navigate to a nested page (e.g., admin view edit)
    await page.getByRole('button', { name: 'Menu' }).click();
    await page.getByRole('menuitem', { name: 'Administration' }).click();
    await expect(page).toHaveURL(/\/admin/, { timeout: 10000 });

    // Click on a view to open edit form
    await page.getByRole('button', { name: 'Project Lagoon TTX - Admin User' }).click();
    await expect(page.getByRole('heading', { name: /Edit View:/ })).toBeVisible();

    // expect: Breadcrumb trail is visible showing navigation path
    // The "Return" button and "Administration" link serve as breadcrumb
    await expect(page.getByRole('button', { name: 'Return' })).toBeVisible();

    // 2. Click on a breadcrumb link
    await page.getByRole('button', { name: 'Return' }).click();

    // expect: User navigates to the selected level in the hierarchy
    await expect(page.getByRole('heading', { name: 'Views' })).toBeVisible();

    // The "Administration" link navigates back to home
    await page.getByRole('link', { name: 'Administration' }).click();
    await expect(page).toHaveURL(/localhost:4301\/$/, { timeout: 10000 });
    await expect(page.getByText('My Views')).toBeVisible();
  });
});
