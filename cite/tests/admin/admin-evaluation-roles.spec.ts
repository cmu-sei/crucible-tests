// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: cite/cite-test-plan.md
// seed: tests/seed.spec.ts

import { test, expect, Services } from '../../fixtures';
import { navigateToAdminSection } from '../../test-helpers';

test.describe('Administration - Roles', () => {
  test('View Evaluation Roles', async ({ citeAuthenticatedPage: page }) => {

    // 1. Navigate to Roles section
    await navigateToAdminSection(page, 'Roles');

    // 2. Click the Evaluation Roles tab
    const evaluationRolesTab = page.getByRole('tab', { name: 'Evaluation Roles' });
    await expect(evaluationRolesTab).toBeVisible({ timeout: 10000 });
    await evaluationRolesTab.click();
    await page.waitForTimeout(1000);

    // 3. Verify evaluation roles content is displayed
    const rolesTable = page.locator('table, mat-table, mat-list').first();
    await expect(rolesTable).toBeVisible({ timeout: 10000 });

    // 4. Verify at least one role entry is present
    const roleEntries = page.locator('tbody tr, mat-list-item, mat-row').first();
    await expect(roleEntries).toBeVisible({ timeout: 10000 });
  });
});
