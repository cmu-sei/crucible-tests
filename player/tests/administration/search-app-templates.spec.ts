// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: player/player-test-plan.md
// seed: seed.spec.ts

import { test, expect, Services } from '../../fixtures';

test.describe('Administration - Application Templates', () => {
  test('Search Application Templates', async ({ playerAuthenticatedPage: page }) => {
    // 1. Log in as admin and navigate to Administration > Application Templates
    await page.getByRole('button', { name: 'Menu' }).click();
    await page.getByRole('menuitem', { name: 'Administration' }).click();
    await page.getByRole('button', { name: 'Application Templates' }).click();

    // expect: The Application Templates section is displayed
    await expect(page.getByRole('columnheader', { name: 'Template Name' })).toBeVisible();

    // 2. Enter a search term in the Search field
    const searchField = page.getByRole('textbox', { name: 'Search' });
    await searchField.fill('Dashboard');

    // expect: The search field accepts input
    await expect(searchField).toHaveValue('Dashboard');

    // expect: A clear search button appears
    await expect(page.getByRole('button', { name: 'Clear Search' })).toBeVisible();

    // expect: The Dashboard template is still visible
    await expect(page.getByRole('cell', { name: /Dashboard/ }).first()).toBeVisible();

    // 3. Clear the search field
    await page.getByRole('button', { name: 'Clear Search' }).click();

    // expect: Search field is cleared
    await expect(searchField).toHaveValue('');
  });
});
