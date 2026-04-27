// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: player/player-test-plan.md
// seed: seed.spec.ts

import { test, expect, Services } from '../../fixtures';

test.describe('View Details', () => {
  test('View Users by Team', async ({ playerAuthenticatedPage: page }) => {
    // 1. Log in and navigate to a view
    await page.getByRole('link', { name: 'Project Lagoon TTX - Admin' }).click();

    // expect: User is on the view details page
    await expect(page).toHaveURL(/\/view\//, { timeout: 10000 });

    // 2. Click the 'Users' button
    await page.getByRole('button', { name: 'Users' }).click();

    // expect: A dialog opens showing all teams in the view
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible({ timeout: 5000 });

    // expect: Each team shows its name and user count
    // expect: Teams are displayed as expandable sections

    // 3. Click on a team to expand it
    // Look for a team name in the dialog and click it
    const teamSection = dialog.locator('mat-expansion-panel').first();
    await teamSection.click();

    // expect: The team expands to show a table of users
    // expect: The table displays user names and their online/offline status

    // 5. Click 'Close' button
    const closeButton = dialog.getByRole('button', { name: /close/i });
    await closeButton.click();

    // expect: The dialog closes
    await expect(dialog).not.toBeVisible();

    // expect: User returns to the view details page
    await expect(page).toHaveURL(/\/view\//);
  });
});
