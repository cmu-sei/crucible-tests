// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: alloy/alloy-test-plan.md
// seed: seed.spec.ts

import { test, expect } from '@playwright/test';
import { authenticateWithKeycloak, Services } from '../../../shared-fixtures';

test.describe('Roles and Permissions Management', () => {
  test('View Event Roles', async ({ page }) => {
    // 1. Navigate to admin Roles section
    await authenticateWithKeycloak(page, Services.Alloy.UI);
    await page.goto(`${Services.Alloy.UI}/admin`);
    await expect(page.getByRole('heading', { name: 'Administration' })).toBeVisible();

    await page.locator('mat-list-item').filter({ hasText: 'Roles' }).click();

    // expect: Roles section is displayed
    await expect(page.getByRole('tab', { name: 'Roles', exact: true })).toBeVisible();

    // 2. Click on 'Event Roles' tab
    await page.getByRole('tab', { name: 'Event Roles', exact: true }).click();

    // expect: Event roles list is displayed
    await expect(page.getByRole('tab', { name: 'Event Roles', exact: true })).toHaveAttribute('aria-selected', 'true');
  });
});
