// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: player/player-test-plan.md
// seed: seed.spec.ts

import { test, expect, Services } from '../../fixtures';

test.describe('View Player Interface', () => {
  test('View Player Sidebar - Collapse/Expand', async ({ playerAuthenticatedPage: page }) => {
    // 1. Navigate to view player page with sidebar expanded
    await page.getByRole('link', { name: 'Project Lagoon TTX - Admin' }).click();
    await expect(page).toHaveURL(/\/view\//, { timeout: 10000 });

    // expect: Sidebar is fully visible with application names
    await expect(page.getByRole('button', { name: 'Collapse to Icons Only' })).toBeVisible();

    // 2. Click the collapse button (chevron-double-left icon)
    await page.getByRole('button', { name: 'Collapse to Icons Only' }).click();

    // expect: Sidebar collapses to mini mode showing only icons
    // expect: More space is available for main content

    // 3. Click the expand button (chevron-double-right icon)
    // After collapsing, the button changes to expand
    const expandButton = page.getByRole('button', { name: /Expand/ });
    await expect(expandButton).toBeVisible();
    await expandButton.click();

    // expect: Sidebar expands back to full width
    // expect: Application names are visible again
    await expect(page.getByRole('button', { name: 'Collapse to Icons Only' })).toBeVisible();
  });
});
