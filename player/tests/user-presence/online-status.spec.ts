// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: player/player-test-plan.md
// seed: seed.spec.ts

import { test, expect, Services } from '../../fixtures';

test.describe('User Presence', () => {
  test('User Presence - Online Status', async ({ playerAuthenticatedPage: page }) => {
    // 1. Navigate to a view and check user presence via Users dialog
    await page.getByRole('link', { name: 'Project Lagoon TTX - Admin' }).click();
    await expect(page).toHaveURL(/\/view\//, { timeout: 10000 });

    // Open the Users dialog to see online status
    await page.getByRole('button', { name: 'Users' }).click();

    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();

    // Expand a team to see user status
    await dialog.getByRole('button', { name: /Admin Count:/ }).click();

    // expect: User presence list displays
    // expect: Current user appears as online/present
    const adminRegion = dialog.getByRole('region', { name: /Admin Count:/ });
    await expect(adminRegion.getByRole('cell', { name: 'Admin User' })).toBeVisible();

    // expect: Online status indicator is visible
    await expect(adminRegion.getByText('Online')).toBeVisible();

    // Close dialog
    await dialog.getByRole('button', { name: 'Close' }).click();
  });
});
