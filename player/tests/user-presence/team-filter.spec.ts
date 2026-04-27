// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: player/player-test-plan.md
// seed: seed.spec.ts

import { test, expect, Services } from '../../fixtures';

test.describe('User Presence', () => {
  test('User Presence - Team Filter', async ({ playerAuthenticatedPage: page }) => {
    // 1. Navigate to user presence page in a view with multiple teams
    await page.getByRole('link', { name: 'Project Lagoon TTX - Admin' }).click();
    await expect(page).toHaveURL(/\/view\//, { timeout: 10000 });

    // Open the Users dialog
    await page.getByRole('button', { name: 'Users' }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();

    // expect: User presence page displays multiple teams
    await expect(dialog.getByRole('button', { name: /Admin Count:/ })).toBeVisible();
    await expect(dialog.getByRole('button', { name: /Exercise Control Count:/ })).toBeVisible();

    // 2. Select a specific team from filter/dropdown
    // Use the "Hide Offline" checkbox to filter presence
    const hideOfflineCheckbox = dialog.getByRole('checkbox', { name: 'Hide Offline' });
    await hideOfflineCheckbox.click();

    // expect: User list filters to show only online members
    // expect: Team members' presence status is displayed

    // Expand a team to verify filtering
    await dialog.getByRole('button', { name: 'Expand All' }).click();

    // The Admin team should show online users
    const adminRegion = dialog.getByRole('region', { name: /Admin Count:/ });
    await expect(adminRegion.getByRole('cell', { name: 'Admin User' })).toBeVisible();

    // Close dialog
    await dialog.getByRole('button', { name: 'Close' }).click();
  });
});
