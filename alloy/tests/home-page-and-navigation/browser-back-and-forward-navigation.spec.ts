// spec: alloy/alloy-test-plan.md
// seed: seed.spec.ts

import { test, expect } from '@playwright/test';
import { authenticateWithKeycloak, Services } from '../../../shared-fixtures';

test.describe('Home Page and Navigation', () => {
  test('Browser Back and Forward Navigation', async ({ page }) => {
    // 1. Navigate to http://localhost:4403/admin
    await authenticateWithKeycloak(page, Services.Alloy.UI);
    await page.goto(`${Services.Alloy.UI}/admin`);

    // expect: Admin page loads
    await expect(page.getByRole('heading', { name: 'Administration' })).toBeVisible();

    // 2. Click on 'Events' in the sidebar
    await page.locator('mat-list-item').filter({ hasText: 'Events' }).click();

    // expect: Events section is displayed
    await expect(page).toHaveURL(/section=Events/);
    await expect(page.getByRole('link', { name: 'Events' })).toBeVisible();

    // 3. Click on 'Users' in the sidebar
    await page.locator('mat-list-item').filter({ hasText: 'Users' }).click();

    // expect: Users section is displayed
    await expect(page).toHaveURL(/section=Users/);
    await expect(page.getByRole('link', { name: 'Users' })).toBeVisible();

    // 4. Click browser back button
    await page.goBack();

    // expect: Application navigates back to Events section
    await expect(page).toHaveURL(/section=Events/);

    // 5. Click browser forward button
    await page.goForward();

    // expect: Application navigates forward to Users section
    await expect(page).toHaveURL(/section=Users/);
  });
});
