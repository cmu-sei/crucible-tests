// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: alloy/alloy-test-plan.md
// seed: seed.spec.ts

import { test, expect } from '@playwright/test';
import { authenticateWithKeycloak, Services } from '../../../shared-fixtures';

test.describe('Groups Management', () => {
  test('View Groups List', async ({ page }) => {
    // 1. Navigate to http://localhost:4403/admin
    await authenticateWithKeycloak(page, Services.Alloy.UI);
    await page.goto(`${Services.Alloy.UI}/admin`);
    await expect(page.getByRole('heading', { name: 'Administration' })).toBeVisible();

    // 2. Click on 'Groups' in the sidebar
    await page.locator('mat-list-item').filter({ hasText: 'Groups' }).click();

    // expect: Groups list is displayed
    await expect(page.getByRole('link', { name: 'Groups' })).toBeVisible();
    await expect(page.getByRole('table')).toBeVisible();

    // expect: Table has Group Name column
    await expect(page.getByRole('columnheader', { name: 'Group Name' })).toBeVisible();

    // expect: Search box is available
    await expect(page.getByRole('textbox', { name: 'Search Groups' })).toBeVisible();
  });
});
