// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: alloy/alloy-test-plan.md
// seed: seed.spec.ts

import { test, expect } from '@playwright/test';
import { authenticateWithKeycloak, Services } from '../../../shared-fixtures';

test.describe('Events Management', () => {
  test('View Event Details', async ({ page }) => {
    // 1. Navigate to admin Events section
    await authenticateWithKeycloak(page, Services.Alloy.UI);
    await page.goto(`${Services.Alloy.UI}/admin`);
    await expect(page.getByRole('heading', { name: 'Administration' })).toBeVisible();

    await page.locator('mat-list-item').filter({ hasText: 'Events' }).click();

    // expect: Events list is visible
    await expect(page.getByRole('table')).toBeVisible();

    // expect: Events table columns are displayed
    await expect(page.getByRole('columnheader', { name: 'Name' })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'User' })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'Status', exact: true })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'Status Date' })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'Launch Date' })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'Expiration Date' })).toBeVisible();

    // 2. If events exist, verify event details are accessible
    // Check the filter checkboxes for event status filtering
    await expect(page.getByRole('checkbox', { name: 'Active' })).toBeVisible();
    await expect(page.getByRole('checkbox', { name: 'Ended' })).toBeVisible();
    await expect(page.getByRole('checkbox', { name: 'Failed' })).toBeVisible();
  });
});
