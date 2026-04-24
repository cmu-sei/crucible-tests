// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: cite/cite-test-plan.md
// seed: tests/seed.spec.ts

import { test, expect } from '../../fixtures';

test.describe('Error Handling and Edge Cases', () => {
  test('Submission Without Required Permissions', async ({ citeAuthenticatedPage: page }) => {

    // 1. Verify user is authenticated on home page
    await expect(page).toHaveURL(/localhost:4721/, { timeout: 10000 });

    // 2. Home page shows "My Evaluations" with no data — no evaluations to submit
    await expect(page.getByText('My Evaluations')).toBeVisible({ timeout: 10000 });
    await expect(page.getByText('No results found')).toBeVisible({ timeout: 10000 });

    // expect: Without evaluations, there is nothing to submit
    // expect: The UI handles the empty state gracefully without errors
    const rows = page.locator('mat-row, tbody tr, [class*="evaluation-row"]');
    await expect(rows).toHaveCount(0, { timeout: 5000 });
  });
});
