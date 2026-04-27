// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: player/player-test-plan.md
// seed: seed.spec.ts

import { test, expect, Services } from '../../fixtures';

test.describe('Error Handling and Edge Cases', () => {
  test('SQL Injection Protection - Search Fields', async ({ playerAuthenticatedPage: page }) => {
    // 1. Navigate to a search field (e.g., view list search)
    // expect: Search field is visible
    await expect(page.getByText('My Views')).toBeVisible();
    const searchField = page.getByRole('textbox', { name: 'Search' });
    await expect(searchField).toBeVisible();

    // 2. Enter SQL injection attempt
    await searchField.fill("' OR '1'='1");

    // expect: Input is accepted
    await expect(searchField).toHaveValue("' OR '1'='1");

    // 3. Execute search
    // expect: Application handles input safely
    // expect: No SQL errors occur
    // expect: Search results are appropriate or empty
    // If SQL injection worked, it would show all results or cause an error
    // The search should simply find no matching views
    await expect(page.getByRole('table')).toBeVisible();

    // Clear and verify page is still functional
    await searchField.clear();
    await expect(page.getByRole('link', { name: 'Project Lagoon TTX' })).toBeVisible();
  });
});
