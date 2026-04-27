// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: player/player-test-plan.md
// seed: seed.spec.ts

import { test, expect, Services } from '../../fixtures';

test.describe('View Player Interface', () => {
  test('View Player Sidebar - Applications List', async ({ playerAuthenticatedPage: page }) => {
    // 1. Navigate to view player page
    await page.getByRole('link', { name: 'Project Lagoon TTX - Admin' }).click();

    // expect: Sidebar displays list of applications available in the view
    await expect(page).toHaveURL(/\/view\//, { timeout: 10000 });

    // The sidebar should contain the view name and navigation elements
    await expect(page.getByText('Project Lagoon TTX - Admin User')).toBeVisible();

    // expect: Each application shows name/icon
    // The sidebar contains the "Player" link and collapse/expand buttons
    await expect(page.getByRole('link', { name: 'Player' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Collapse to Icons Only' })).toBeVisible();
  });
});
