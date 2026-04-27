// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: player/player-test-plan.md
// seed: seed.spec.ts

import { test, expect, Services } from '../../fixtures';

test.describe('View Details', () => {
  test('Expand/Collapse All Teams', async ({ playerAuthenticatedPage: page }) => {
    // 1. Log in and navigate to a view, then open the Users dialog
    await page.getByRole('link', { name: 'Project Lagoon TTX - Admin' }).click();
    await expect(page).toHaveURL(/\/view\//, { timeout: 10000 });
    await page.getByRole('button', { name: 'Users' }).click();

    // expect: The Users dialog is open showing multiple teams
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole('button', { name: /Admin Count:/ })).toBeVisible();

    // 2. Click the 'Expand All' button
    await dialog.getByRole('button', { name: 'Expand All' }).click();

    // expect: All teams expand to show their user lists
    // Verify the Admin team is expanded by checking for the region
    await expect(dialog.getByRole('button', { name: /Admin Count:/ })).toHaveAttribute('aria-expanded', 'true');

    // 3. Click the 'Collapse All' button
    await dialog.getByRole('button', { name: 'Collapse All' }).click();

    // expect: All teams collapse to hide their user lists
    // expect: Only team names and counts are visible
    await expect(dialog.getByRole('button', { name: /Admin Count:/ })).toHaveAttribute('aria-expanded', 'false');

    // Close dialog
    await dialog.getByRole('button', { name: 'Close' }).click();
    await expect(dialog).not.toBeVisible();
  });
});
