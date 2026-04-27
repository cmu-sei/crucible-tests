// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: player/player-test-plan.md
// seed: seed.spec.ts

import { test, expect, Services } from '../../fixtures';

test.describe('Home Page - My Views', () => {
  test('Sort Views by Name', async ({ playerAuthenticatedPage: page }) => {
    // 1. Log in as admin user
    // expect: User is on the home page with multiple views displayed
    await expect(page.getByText('My Views')).toBeVisible();
    await expect(page.getByRole('table')).toBeVisible();

    // expect: Views are initially sorted by name in ascending order
    const firstCell = page.getByRole('row').nth(1).getByRole('cell').first();
    const lastCell = page.getByRole('row').nth(2).getByRole('cell').first();
    await expect(firstCell).toContainText('Project Lagoon');
    await expect(lastCell).toContainText('Steamfitter');

    // 2. Click the 'Name' column header to toggle sort to descending
    await page.getByRole('button', { name: 'Name' }).click();

    // expect: Views are sorted by name in descending order
    await expect(firstCell).toContainText('Steamfitter');
    await expect(lastCell).toContainText('Project Lagoon');
  });
});
