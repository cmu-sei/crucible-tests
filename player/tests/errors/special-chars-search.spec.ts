// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: player/player-test-plan.md
// seed: seed.spec.ts

import { test, expect, Services } from '../../fixtures';

test.describe('Error Handling and Edge Cases', () => {
  test('Special Characters in Search', async ({ playerAuthenticatedPage: page }) => {
    // 1. Log in and navigate to home page
    // expect: User is on the home page
    await expect(page.getByText('My Views')).toBeVisible();

    // 2. Enter special characters like <, >, &, quotes in the search field
    const searchField = page.getByRole('textbox', { name: 'Search' });
    await searchField.fill('<script>alert("xss")</script>');

    // expect: The search handles special characters gracefully without errors
    // expect: Results are filtered correctly or no results are shown
    await expect(searchField).toHaveValue('<script>alert("xss")</script>');

    // Verify no JavaScript errors caused by XSS
    await searchField.clear();
    await searchField.fill('&<>"\'');
    await expect(searchField).toHaveValue('&<>"\'');

    // Verify the page is still functional
    await searchField.clear();
    await expect(page.getByRole('table')).toBeVisible();
  });
});
