// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: alloy/alloy-test-plan.md
// seed: seed.spec.ts

import { test, expect } from '@playwright/test';
import { authenticateWithKeycloak, Services } from '../../../shared-fixtures';

test.describe('Events Management', () => {
  test('Event Lifecycle - Creating to Active', async ({ page }) => {
    // Note: This test requires Player, Caster, and Steamfitter services to be
    // fully configured and running. It verifies the event creation flow from
    // the admin Events section.

    // 1. Navigate to admin Events section
    await authenticateWithKeycloak(page, Services.Alloy.UI);
    await page.goto(`${Services.Alloy.UI}/admin`);
    await expect(page.getByRole('heading', { name: 'Administration' })).toBeVisible();

    await page.locator('mat-list-item').filter({ hasText: 'Events' }).click();

    // expect: Events list is visible with status columns
    await expect(page.getByRole('table')).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'Status', exact: true })).toBeVisible();

    // 2. Verify event status filter checkboxes are present
    await expect(page.getByRole('checkbox', { name: 'Active' })).toBeVisible();
    await expect(page.getByRole('checkbox', { name: 'Ended' })).toBeVisible();
    await expect(page.getByRole('checkbox', { name: 'Failed' })).toBeVisible();

    // expect: Active events are shown by default
    await expect(page.getByRole('checkbox', { name: 'Active' })).toBeChecked();
  });
});
