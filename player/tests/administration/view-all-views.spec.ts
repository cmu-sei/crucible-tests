// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: player/player-test-plan.md
// seed: seed.spec.ts

import { test, expect, Services } from '../../fixtures';

test.describe('Administration - Views', () => {
  test('View All Views as Admin', async ({ playerAuthenticatedPage: page }) => {
    // 1. Log in as admin and navigate to Administration
    await page.getByRole('button', { name: 'Menu' }).click();
    await page.getByRole('menuitem', { name: 'Administration' }).click();

    // expect: The Administration page is displayed with Views section active
    await expect(page).toHaveURL(/\/admin/, { timeout: 10000 });

    // 2. Observe the Views table
    // expect: A table displays all views with columns: checkbox, View Name, Description, Status
    await expect(page.getByRole('columnheader', { name: 'View Name' })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'Description' })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'Status' })).toBeVisible();

    // expect: Each view has a copy button for the view ID
    const copyButton = page.getByRole('button', { name: /^Copy:/ }).first();
    await expect(copyButton).toBeVisible();

    // expect: Each view shows its status (Active/Inactive)
    await expect(page.getByRole('cell', { name: 'Active' }).first()).toBeVisible();

    // expect: Views marked as TEMPLATE are indicated
    await expect(page.getByText('TEMPLATE', { exact: true })).toBeVisible();
  });
});
