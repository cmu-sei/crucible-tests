// spec: alloy/alloy-test-plan.md
// seed: seed.spec.ts

import { test, expect } from '@playwright/test';
import { authenticateWithKeycloak, Services } from '../../../shared-fixtures';

test.describe('Events Management', () => {
  test('Sort Events', async ({ page }) => {
    // 1. Navigate to admin Events section
    await authenticateWithKeycloak(page, Services.Alloy.UI);
    await page.goto(`${Services.Alloy.UI}/admin`);
    await expect(page.getByRole('heading', { name: 'Administration' })).toBeVisible();

    await page.locator('mat-list-item').filter({ hasText: 'Events' }).click();

    // expect: Events list is visible
    await expect(page.getByRole('table')).toBeVisible();

    // 2. Click on the 'Name' column header
    await page.getByRole('button', { name: 'Name' }).click();

    // expect: Events are sorted alphabetically by name

    // 3. Click on the 'Status' column header
    await page.getByRole('button', { name: 'Status' }).first().click();

    // expect: Events are sorted by status

    // 4. Click on the 'Launch Date' column header
    await page.getByRole('button', { name: 'Launch Date' }).click();

    // expect: Events are sorted by launch date
    await expect(page.getByRole('columnheader', { name: 'Launch Date' })).toBeVisible();
  });
});
