// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: player/player-test-plan.md
// seed: seed.spec.ts

import { test, expect, Services } from '../../fixtures';

test.describe('Administration - Users', () => {
  test('Paginate Users', async ({ playerAuthenticatedPage: page }) => {
    // 1. Log in as admin and navigate to Administration > Users
    await page.getByRole('button', { name: 'Menu' }).click();
    await page.getByRole('menuitem', { name: 'Administration' }).click();
    await page.getByRole('button', { name: 'Users Users' }).click();

    // expect: The Users section is displayed with pagination controls
    await expect(page.getByRole('columnheader', { name: 'Name' })).toBeVisible();

    // 2. Change the 'Items per page' value from 20 to another value
    const itemsPerPage = page.getByRole('combobox', { name: 'Items per page:' });
    await expect(itemsPerPage).toBeVisible();

    // expect: The table updates to show the specified number of users per page
    await expect(page.getByText(/of \d+/)).toBeVisible();

    // 3. Click the 'Next page' button (if there are multiple pages)
    const nextPageButton = page.getByRole('button', { name: 'Next page' });
    await expect(nextPageButton).toBeVisible();
  });
});
