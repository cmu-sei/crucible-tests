// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: alloy/alloy-test-plan.md
// seed: seed.spec.ts

import { test, expect } from '@playwright/test';
import { authenticateWithKeycloak, Services } from '../../../shared-fixtures';

test.describe('Events Management', () => {
  test('Event Lifecycle - Failed State Handling', async ({ page }) => {
    // Note: This test verifies the Failed event filter in the admin Events section.

    // 1. Navigate to admin Events section
    await authenticateWithKeycloak(page, Services.Alloy.UI);
    await page.goto(`${Services.Alloy.UI}/admin`);
    await expect(page.getByRole('heading', { name: 'Administration' })).toBeVisible();

    await page.locator('mat-list-item').filter({ hasText: 'Events' }).click();

    // expect: Events list is visible
    await expect(page.getByRole('table')).toBeVisible();

    // 2. Verify Failed filter exists
    const failedCheckbox = page.getByRole('checkbox', { name: 'Failed' });
    await expect(failedCheckbox).toBeVisible();

    // 3. Enable Failed filter to show failed events
    await failedCheckbox.check();
    await expect(failedCheckbox).toBeChecked();

    // expect: Status column is visible
    await expect(page.getByRole('columnheader', { name: 'Status', exact: true })).toBeVisible();

    // Restore filter
    await failedCheckbox.uncheck();
  });
});
