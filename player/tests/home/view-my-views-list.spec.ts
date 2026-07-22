// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: player/player-test-plan.md
// seed: seed.spec.ts

import { test, expect, Services, seededPrimaryViewName, seededSteamfitterViewName, typeIntoSearch } from '../../fixtures';

test.describe('Home Page - My Views', () => {
  test('View My Views List', async ({ playerAuthenticatedPage: page }) => {
    const primaryViewName = seededPrimaryViewName();
    const steamfitterViewName = seededSteamfitterViewName();

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
    expect(await rows.count()).toBeGreaterThanOrEqual(3); // header + fixture views
    const searchField = page.getByRole('textbox', { name: 'Search' });
    await typeIntoSearch(searchField, primaryViewName);
    await expect(page.getByRole('link', { name: primaryViewName, exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Clear Search' }).click();
    await typeIntoSearch(searchField, 'Steamfitter');
    await expect(page.getByRole('link', { name: steamfitterViewName, exact: true })).toBeVisible();

    // expect: Each view is clickable to navigate to the view details
    const firstViewLink = page.getByRole('cell').getByRole('link').first();
    await expect(firstViewLink).toBeVisible();
  });
});
