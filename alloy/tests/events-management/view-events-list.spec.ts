// spec: alloy/alloy-test-plan.md
// seed: seed.spec.ts

import { test, expect } from '@playwright/test';
import { authenticateWithKeycloak, Services } from '../../../shared-fixtures';

test.describe('Events Management', () => {
  test('View Events List', async ({ page }) => {
    // 1. Navigate to http://localhost:4403/admin
    await authenticateWithKeycloak(page, Services.Alloy.UI);
    await page.goto(`${Services.Alloy.UI}/admin`);
    await expect(page.getByRole('heading', { name: 'Administration' })).toBeVisible();

    // 2. Click on 'Events' in the sidebar
    await page.locator('mat-list-item').filter({ hasText: 'Events' }).click();

    // expect: Events list is displayed
    await expect(page.getByRole('table')).toBeVisible();

    // expect: Each event shows: name, status, user, dates
    await expect(page.getByRole('columnheader', { name: 'Name' })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'User' })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'Status', exact: true })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'Status Date' })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'Launch Date' })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'Expiration Date' })).toBeVisible();

    // expect: Events display filter checkboxes for status
    await expect(page.getByRole('checkbox', { name: 'Active' })).toBeVisible();
    await expect(page.getByRole('checkbox', { name: 'Ended' })).toBeVisible();
    await expect(page.getByRole('checkbox', { name: 'Failed' })).toBeVisible();
  });
});
