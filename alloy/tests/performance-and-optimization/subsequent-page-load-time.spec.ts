// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: alloy/alloy-test-plan.md
// seed: seed.spec.ts

import { test, expect } from '@playwright/test';
import { authenticateWithKeycloak, Services } from '../../../shared-fixtures';

test.describe('Performance and Optimization', () => {
  test('Subsequent Page Load Time', async ({ page }) => {
    // 1. After initial load, navigate to different sections
    await authenticateWithKeycloak(page, Services.Alloy.UI);
    await expect(page.getByText('My Events')).toBeVisible();

    // 2. Navigate to admin section
    const adminStart = Date.now();
    await page.goto(`${Services.Alloy.UI}/admin`);
    await expect(page.getByRole('heading', { name: 'Administration' })).toBeVisible();
    const adminLoadTime = Date.now() - adminStart;

    // expect: Page transitions are fast
    expect(adminLoadTime).toBeLessThan(30000);

    // 3. Navigate to Events section
    const eventsStart = Date.now();
    await page.locator('mat-list-item').filter({ hasText: 'Events' }).click();
    await expect(page.getByRole('columnheader', { name: 'Name' })).toBeVisible();
    const eventsLoadTime = Date.now() - eventsStart;

    // expect: Section transitions are fast
    expect(eventsLoadTime).toBeLessThan(10000);

    // 4. Navigate to Users section
    const usersStart = Date.now();
    await page.locator('mat-list-item').filter({ hasText: 'Users' }).click();
    await expect(page.getByRole('cell', { name: 'Admin User' })).toBeVisible();
    const usersLoadTime = Date.now() - usersStart;

    // expect: Section transitions are fast
    expect(usersLoadTime).toBeLessThan(10000);
  });
});
