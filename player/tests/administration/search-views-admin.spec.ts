// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: player/player-test-plan.md
// seed: seed.spec.ts

import { test, expect, Services, seededPrimaryViewName, seededSteamfitterViewName, typeIntoSearch } from '../../fixtures';

test.describe('Administration - Views', () => {
  test('Search Views in Admin', async ({ playerAuthenticatedPage: page }) => {
    const primaryViewName = seededPrimaryViewName();
    const steamfitterViewName = seededSteamfitterViewName();

    // 1. Log in as admin and navigate to Administration > Views
    await page.getByRole('button', { name: 'Menu' }).click();
    await page.getByRole('menuitem', { name: 'Administration' }).click();
    await expect(page).toHaveURL(/\/admin/, { timeout: 10000 });

    // expect: The Views admin section is displayed
    await expect(page.getByRole('heading', { name: 'Views' })).toBeVisible();

    // 2. Enter a search term in the Search field
    const searchField = page.getByRole('textbox', { name: 'Search' });
    await typeIntoSearch(searchField, 'Lagoon');

    // expect: The search field accepts input
    await expect(searchField).toHaveValue('Lagoon');

    // expect: A clear search button appears
    await expect(page.getByRole('button', { name: 'Clear Search' })).toBeVisible();

    // expect: The matching view is visible
    await expect(page.getByRole('button', { name: primaryViewName, exact: true })).toBeVisible();

    // 3. Clear the search field
    await page.getByRole('button', { name: 'Clear Search' }).click();

    // expect: Search field is cleared
    await expect(searchField).toHaveValue('');

    // expect: The primary fixture view is still visible after clearing search
    await expect(page.getByRole('button', { name: primaryViewName, exact: true })).toBeVisible();

    // 4. Search for the secondary seeded view directly
    await typeIntoSearch(searchField, 'Steamfitter');

    // expect: The secondary fixture view is searchable as well
    await expect(searchField).toHaveValue('Steamfitter');
    await expect(page.getByRole('button', { name: steamfitterViewName, exact: true })).toBeVisible();
  });
});
