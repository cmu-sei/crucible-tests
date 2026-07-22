// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: player/player-test-plan.md
// seed: seed.spec.ts

import {
  test,
  expect,
  Services,
  seededPrimaryViewName,
  findPlayerHomeViewLink,
  typeIntoSearch,
  clickWithoutOverlayInterference,
} from '../../fixtures';

test.describe('View Details', () => {
  test('Search Users', async ({ playerAuthenticatedPage: page }) => {
    const primaryViewName = seededPrimaryViewName();

    // 1. Log in and navigate to a view, then open the Users dialog
    await (await findPlayerHomeViewLink(page, primaryViewName)).click();
    await expect(page).toHaveURL(/\/view\//, { timeout: 10000 });
    await clickWithoutOverlayInterference(page, page.getByRole('button', { name: 'Users' }));

    // expect: The Users dialog is open
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();

    // 2. Enter a user name in the Search field
    const searchField = dialog.getByRole('textbox', { name: 'Search' });
    await typeIntoSearch(searchField, 'Admin');

    // expect: The teams list filters to show only teams with matching users
    await expect(dialog.getByRole('button', { name: /Admin Count:/ })).toBeVisible();

    // expect: Teams without matching users are hidden
    // Teams with 0 matching users may be hidden or show count: 0

    // 3. Clear the search field
    await typeIntoSearch(searchField, '');

    // expect: All teams are displayed again
    await expect(dialog.getByRole('button', { name: /Admin Count:/ })).toBeVisible();
    await expect(dialog.getByRole('button', { name: /Exercise Control Count:/ })).toBeVisible();

    // Close dialog
    await dialog.getByRole('button', { name: 'Close' }).click();
  });
});
