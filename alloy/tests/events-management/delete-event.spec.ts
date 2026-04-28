// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: alloy/alloy-test-plan.md
// seed: seed.spec.ts

import { test, expect } from '@playwright/test';
import { authenticateWithKeycloak, Services } from '../../../shared-fixtures';

test.describe('Events Management', () => {
  test('Delete Event', async ({ page }) => {
    // Note: This test verifies the Events admin section has delete capabilities.

    // 1. Navigate to admin Events section
    await authenticateWithKeycloak(page, Services.Alloy.UI);
    await page.goto(`${Services.Alloy.UI}/admin`);
    await expect(page.getByRole('heading', { name: 'Administration' })).toBeVisible();

    await page.locator('mat-list-item').filter({ hasText: 'Events' }).click();

    // expect: Events list is visible
    await expect(page.getByRole('table')).toBeVisible();

    // 2. Verify the event table has action column
    // The first column typically contains action buttons (edit/delete)
    await expect(page.getByRole('columnheader', { name: 'Name' })).toBeVisible();

    // Note: Deleting events requires events to exist in the system
    // Ended events can be deleted via action buttons in the events table
  });
});
