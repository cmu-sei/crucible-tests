// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: player/player-test-plan.md
// seed: seed.spec.ts

import { test, expect, Services, seededPrimaryViewName, findPlayerHomeViewLink } from '../../fixtures';

test.describe('Error Handling and Edge Cases', () => {
  test('Long View Names Display', async ({ playerAuthenticatedPage: page }) => {
    const primaryViewName = seededPrimaryViewName();

    // 1. Log in and view a list containing views
    await expect(page.getByText('My Views')).toBeVisible();

    // expect: The table layout remains intact
    await expect(page.getByRole('table')).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'Name' })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'Description' })).toBeVisible();

    // Verify that the existing long view name displays correctly
    // The seeded fixture name remains long enough to verify table layout.
    await findPlayerHomeViewLink(page, primaryViewName);

    // The fixture description remains associated with the view in its own row.
    const viewRow = page.getByRole('row').filter({ hasText: primaryViewName });
    await expect(viewRow.getByRole('cell').nth(1)).toContainText('E2E fixture data');
  });
});
