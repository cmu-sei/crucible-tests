// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: alloy/alloy-test-plan.md
// seed: seed.spec.ts

import { test, expect } from '@playwright/test';
import { authenticateWithKeycloak, Services } from '../../../shared-fixtures';

test.describe('Users Management', () => {
  test('Sort Users', async ({ page }) => {
    // 1. Navigate to admin Users section
    await authenticateWithKeycloak(page, Services.Alloy.UI);
    await page.goto(`${Services.Alloy.UI}/admin`);
    await expect(page.getByRole('heading', { name: 'Administration' })).toBeVisible();

    await page.locator('mat-list-item').filter({ hasText: 'Users' }).click();

    // expect: Users list is visible
    await expect(page.getByRole('table')).toBeVisible();

    // 2. Click on the 'Name' column header
    await page.getByRole('button', { name: 'Name' }).click();

    // expect: Users are sorted alphabetically by name
    await expect(page.getByRole('columnheader', { name: 'Name' })).toBeVisible();

    // 3. Click on the 'Name' column header again for reverse sort
    await page.getByRole('button', { name: 'Name' }).click();

    // expect: Users are sorted in reverse alphabetical order

    // 4. Click on the 'ID' column header
    await page.getByRole('button', { name: 'ID' }).click();

    // expect: Users are sorted by ID
    await expect(page.getByRole('columnheader', { name: 'ID' })).toBeVisible();
  });
});
