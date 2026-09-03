// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: player/player-test-plan.md
// seed: seed.spec.ts

import { test, expect, Services, seededPrimaryViewName, seededSteamfitterViewName, typeIntoSearch } from '../../fixtures';

test.describe('Home Page - My Views', () => {
  test('Search Views', async ({ playerAuthenticatedPage: page }) => {
    const primaryViewName = seededPrimaryViewName();
    const steamfitterViewName = seededSteamfitterViewName();

    // 1. Log in as admin user
    // expect: User is on the home page with views displayed
    await expect(page.getByText('My Views')).toBeVisible();
    await expect(page.getByRole('table')).toBeVisible();

    // 2. Enter a search term in the Search textbox
    const searchField = page.getByRole('textbox', { name: 'Search' });
    await searchField.click();
    await searchField.pressSequentially('Lagoon');

    // expect: The views list filters to show only matching views
    await expect(page.getByRole('link', { name: primaryViewName, exact: true })).toBeVisible();

    // expect: Non-matching views are hidden
    await expect(page.getByRole('link', { name: steamfitterViewName, exact: true })).not.toBeVisible();

    // 3. Clear the search field using the clear button
    await page.getByRole('button', { name: 'Clear Search' }).click();

    // expect: Both seeded views remain searchable after clearing
    await typeIntoSearch(searchField, primaryViewName);
    await expect(page.getByRole('link', { name: primaryViewName, exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Clear Search' }).click();
    await typeIntoSearch(searchField, 'Steamfitter');
    await expect(page.getByRole('link', { name: steamfitterViewName, exact: true })).toBeVisible();
  });
});
