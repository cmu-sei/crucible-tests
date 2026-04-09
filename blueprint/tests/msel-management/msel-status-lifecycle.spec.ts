// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: specs/blueprint-test-plan.md
// seed: tests/seed.spec.ts

import { test, expect, Services } from '../../fixtures';

test.describe('MSEL Management', () => {
  test('MSEL Status Lifecycle', async ({ blueprintAuthenticatedPage: page }) => {
    // Navigate to build page and open an existing MSEL
    await page.goto(`${Services.Blueprint.UI}/build`);
    await page.waitForLoadState('networkidle');

    const mselLink = page.getByRole('link', { name: /Project Lagoon TTX/ }).first();
    await expect(mselLink).toBeVisible({ timeout: 10000 });
    await mselLink.click();
    await expect(page).toHaveURL(/.*\/build\?msel=.*/, { timeout: 10000 });
    await page.waitForLoadState('networkidle');

    // 1. Verify Config tab is visible and MSEL Status dropdown exists
    const configTab = page.getByRole('tab', { name: 'Config' });
    await expect(configTab).toBeVisible({ timeout: 5000 });

    const statusDropdown = page.getByRole('combobox', { name: 'MSEL Status' });
    await expect(statusDropdown).toBeVisible({ timeout: 5000 });

    // Record original status
    const originalStatus = (await statusDropdown.textContent())?.trim() || '';

    // 2. Open the MSEL Status dropdown and verify available statuses
    await statusDropdown.click();

    const expectedStatuses = ['Pending', 'Entered', 'Approved', 'Complete', 'Deployed', 'Archived'];
    for (const status of expectedStatuses) {
      const option = page.getByRole('option', { name: status });
      await expect(option).toBeVisible({ timeout: 3000 });
    }

    // 3. Change the status to a different value
    const newStatus = originalStatus === 'Entered' ? 'Approved' : 'Entered';
    const newStatusOption = page.getByRole('option', { name: newStatus });
    await newStatusOption.click();
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);

    // expect: Status dropdown now shows the new status
    await expect(statusDropdown).toContainText(newStatus, { timeout: 5000 });

    // 4. Restore original status
    await statusDropdown.click();
    const restoreOption = page.getByRole('option', { name: originalStatus });
    await restoreOption.click();
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);

    // expect: Status is restored
    await expect(statusDropdown).toContainText(originalStatus, { timeout: 5000 });
  });
});
