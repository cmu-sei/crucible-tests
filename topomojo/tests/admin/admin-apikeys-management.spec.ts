// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: topomojo/topomojo-test-plan.md
// seed: tests/seed.spec.ts

import { test, expect, topomojoNavLink } from '../../fixtures';

test.describe('Admin Panel', () => {
  test('Admin - API Keys Management', async ({ topomojoAuthenticatedPage: page }) => {

    // 1. Navigate to the admin Users section. TopoMojo has no separate API-keys page:
    // each user's keys are managed in that user's expanded detail.
    // A deep link into /admin lands on the home page before the admin guard has the
    // user's role, so navigate in-app through the Admin link as the other admin specs do.
    await topomojoNavLink(page, 'Admin').click();
    await expect(page.getByRole('heading', { name: 'Admin Dashboard' })).toBeVisible();
    await page.getByRole('link', { name: 'Users' }).click();
    await expect(page).toHaveURL(/\/admin\/users/);
    await expect(page.getByRole('heading', { name: 'Users', level: 4 })).toBeVisible();

    // 2. Expand a user (the list always holds at least the signed-in admin)
    const viewButtons = page.getByRole('button', { name: 'Expand to view user details and role settings.' });
    await expect(viewButtons.first()).toBeVisible();
    await viewButtons.first().click();

    // expect: The user's API keys section loads with its Generate control
    await expect(page.getByText('ApiKeys', { exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Generate' })).toBeVisible();
  });
});
