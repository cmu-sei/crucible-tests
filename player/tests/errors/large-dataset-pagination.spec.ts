// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: player/player-test-plan.md
// seed: seed.spec.ts

import { test, expect, Services } from '../../fixtures';

test.describe('Error Handling and Edge Cases', () => {
  test('Large Data Set Handling - Pagination', async ({ playerAuthenticatedPage: page }) => {
    // 1. Navigate to a list with items (e.g., admin users list with pagination)
    await page.getByRole('button', { name: 'Menu' }).click();
    await page.getByRole('menuitem', { name: 'Administration' }).click();
    await page.getByRole('button', { name: 'Users Users' }).click();

    // expect: List loads with pagination
    await expect(page.getByRole('columnheader', { name: 'Name' })).toBeVisible();
    await expect(page.getByText(/of \d+/)).toBeVisible();

    // 2. Navigate through pages or interact with pagination
    const itemsPerPage = page.getByRole('combobox', { name: 'Items per page:' });
    await expect(itemsPerPage).toBeVisible();

    // expect: Data loads smoothly without freezing
    // expect: Performance remains acceptable
    // expect: All items are accessible
    const nextButton = page.getByRole('button', { name: 'Next page' });
    await expect(nextButton).toBeVisible();
  });
});
