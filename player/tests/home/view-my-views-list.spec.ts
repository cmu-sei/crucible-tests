// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: player/player-test-plan.md
// seed: seed.spec.ts

import { test, expect, Services } from '../../fixtures';

test.describe('Home Page - My Views', () => {
  test('View My Views List', async ({ playerAuthenticatedPage: page }) => {
    // 1. Log in as admin user
    // expect: User is on the home page
    await expect(page.getByText('My Views')).toBeVisible();

    // 2. Observe the 'My Views' section
    // expect: A table is displayed with columns 'Name' and 'Description'
    await expect(page.getByRole('table')).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'Name' })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'Description' })).toBeVisible();

    // expect: The table shows views the user has access to
    const rows = page.getByRole('row');
    await expect(rows).toHaveCount(3, { timeout: 10000 }); // header + 2 views

    // expect: Each view is clickable to navigate to the view details
    const firstViewLink = page.getByRole('cell').getByRole('link').first();
    await expect(firstViewLink).toBeVisible();
  });
});
