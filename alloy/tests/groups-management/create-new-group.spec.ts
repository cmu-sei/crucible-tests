// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: alloy/alloy-test-plan.md
// seed: seed.spec.ts

import { test, expect } from '@playwright/test';
import { authenticateWithKeycloak, Services } from '../../../shared-fixtures';

test.describe('Groups Management', () => {
  test('Create New Group', async ({ page }) => {
    // 1. Navigate to admin Groups section
    await authenticateWithKeycloak(page, Services.Alloy.UI);
    await page.goto(`${Services.Alloy.UI}/admin`);
    await expect(page.getByRole('heading', { name: 'Administration' })).toBeVisible();

    await page.locator('mat-list-item').filter({ hasText: 'Groups' }).click();

    // expect: Groups list is visible
    await expect(page.getByRole('table')).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'Group Name' })).toBeVisible();

    // 2. Verify search box is available
    await expect(page.getByRole('textbox', { name: 'Search Groups' })).toBeVisible();
  });
});
