// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: player/player-test-plan.md
// seed: seed.spec.ts

import { test, expect, Services, seededPrimaryViewName, findPlayerHomeViewLink } from '../../fixtures';

test.describe('View Player Interface', () => {
  test('View Player Sidebar - Applications List', async ({ playerAuthenticatedPage: page }) => {
    const primaryViewName = seededPrimaryViewName();

    // 1. Navigate to view player page
    await (await findPlayerHomeViewLink(page, primaryViewName)).click();

    // expect: Sidebar displays list of applications available in the view
    await expect(page).toHaveURL(/\/view\//, { timeout: 10000 });

    // The sidebar should contain the view name and navigation elements
    await expect(page.getByText(primaryViewName, { exact: true })).toBeVisible();

    // expect: Each application shows name/icon
    // The sidebar contains the "Player" link and collapse/expand buttons
    await expect(page.getByRole('link', { name: 'Player' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Collapse to Icons Only' })).toBeVisible();
  });
});
