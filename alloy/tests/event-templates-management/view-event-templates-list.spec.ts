// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: alloy/alloy-test-plan.md
// seed: seed.spec.ts

import { test, expect } from '@playwright/test';
import { authenticateWithKeycloak, Services } from '../../../shared-fixtures';

test.describe('Event Templates Management', () => {
  test('View Event Templates List', async ({ page }) => {
    // 1. Navigate to http://localhost:4403/admin
    await authenticateWithKeycloak(page, Services.Alloy.UI);
    await page.goto(`${Services.Alloy.UI}/admin`);

    // expect: Admin page loads with Event Templates section visible
    await expect(page.getByRole('heading', { name: 'Administration' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Event Templates' })).toBeVisible();

    // 2. Click on 'Event Templates' in the sidebar
    await page.locator('mat-list-item').filter({ hasText: 'Event Templates' }).click();

    // expect: Event templates list is displayed
    await expect(page.getByRole('table')).toBeVisible();

    // expect: Each template shows: name, description, duration, creation date
    await expect(page.getByRole('columnheader', { name: 'Name' })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'Description' })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'Duration (Hours)' })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'Created' })).toBeVisible();
  });
});
