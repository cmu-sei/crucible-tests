// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: cite/cite-test-plan.md
// seed: tests/seed.spec.ts

import { test, expect, Services } from '../../fixtures';
import { navigateToAdminSection } from '../../test-helpers';

test.describe('Administration - Submissions', () => {
  test('View Submission Details', async ({ citeAuthenticatedPage: page }) => {

    await navigateToAdminSection(page, 'Submissions');

    const table = page.locator('table');
    await expect(table).toBeVisible({ timeout: 10000 });

    // Verify the submissions table structure
    const nameHeader = page.getByRole('columnheader', { name: 'Name' });
    await expect(nameHeader).toBeVisible({ timeout: 5000 });

    const typeHeader = page.getByRole('columnheader', { name: 'Type' });
    await expect(typeHeader).toBeVisible({ timeout: 5000 });
  });
});
