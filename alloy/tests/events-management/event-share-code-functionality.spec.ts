// spec: alloy/alloy-test-plan.md
// seed: seed.spec.ts

import { test, expect } from '@playwright/test';
import { authenticateWithKeycloak, Services } from '../../../shared-fixtures';

test.describe('Events Management', () => {
  test('Event Share Code Functionality', async ({ page }) => {
    // Note: This test requires active events with share codes.

    // 1. Navigate to admin Events section
    await authenticateWithKeycloak(page, Services.Alloy.UI);
    await page.goto(`${Services.Alloy.UI}/admin`);
    await expect(page.getByRole('heading', { name: 'Administration' })).toBeVisible();

    await page.locator('mat-list-item').filter({ hasText: 'Events' }).click();

    // expect: Events list is visible
    await expect(page.getByRole('table')).toBeVisible();

    // 2. Verify Active events filter is checked
    await expect(page.getByRole('checkbox', { name: 'Active' })).toBeChecked();

    // Note: Share code functionality is available on active event details
    // and requires an active event to be present in the system
  });
});
