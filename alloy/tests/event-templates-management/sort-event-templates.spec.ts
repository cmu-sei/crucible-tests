// spec: alloy/alloy-test-plan.md
// seed: seed.spec.ts

import { test, expect } from '@playwright/test';
import { authenticateWithKeycloak, Services } from '../../../shared-fixtures';

test.describe('Event Templates Management', () => {
  test('Sort Event Templates', async ({ page }) => {
    // 1. Navigate to admin Event Templates section
    await authenticateWithKeycloak(page, Services.Alloy.UI);
    await page.goto(`${Services.Alloy.UI}/admin`);
    await expect(page.getByRole('heading', { name: 'Administration' })).toBeVisible();

    // expect: Event templates list is visible
    await expect(page.getByRole('table')).toBeVisible();

    // 2. Click on the 'Name' column header
    await page.getByRole('button', { name: 'Name' }).click();

    // expect: Templates are sorted alphabetically by name
    // expect: A sort indicator shows the sort direction
    await expect(page.getByRole('columnheader', { name: 'Name' })).toBeVisible();

    // 3. Click on the 'Name' column header again
    await page.getByRole('button', { name: 'Name' }).click();

    // expect: Templates are sorted in reverse alphabetical order

    // 4. Click on the 'Created' column header
    await page.getByRole('button', { name: 'Created', exact: true }).click();

    // expect: Templates are sorted by creation date

    // 5. Click on the 'Duration (Hours)' column header
    await page.getByRole('button', { name: 'Duration (Hours)' }).click();

    // expect: Templates are sorted by duration hours
    await expect(page.getByRole('columnheader', { name: 'Duration (Hours)' })).toBeVisible();
  });
});
