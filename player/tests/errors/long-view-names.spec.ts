// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: player/player-test-plan.md
// seed: seed.spec.ts

import { test, expect, Services } from '../../fixtures';

test.describe('Error Handling and Edge Cases', () => {
  test('Long View Names Display', async ({ playerAuthenticatedPage: page }) => {
    // 1. Log in and view a list containing views
    await expect(page.getByText('My Views')).toBeVisible();

    // expect: The table layout remains intact
    await expect(page.getByRole('table')).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'Name' })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'Description' })).toBeVisible();

    // Verify that the existing long view name displays correctly
    // "Project Lagoon TTX - Admin" is a reasonably long name
    await expect(page.getByRole('link', { name: 'Project Lagoon TTX - Admin', exact: true })).toBeVisible();

    // The fixture description remains associated with the view in its own row.
    const viewRow = page.getByRole('row').filter({ hasText: 'Project Lagoon TTX - Admin' });
    await expect(viewRow.getByRole('cell').nth(1)).toContainText('E2E fixture data');
  });
});
