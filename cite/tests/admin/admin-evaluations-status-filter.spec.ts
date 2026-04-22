// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: cite/cite-test-plan.md
// seed: tests/seed.spec.ts

import { test, expect, Services } from '../../fixtures';
import { navigateToAdminSection } from '../../test-helpers';

test.describe('Administration - Evaluations', () => {
  test('Filter Evaluations by Status', async ({ citeAuthenticatedPage: page }) => {

    await navigateToAdminSection(page);

    const statusFilter = page.getByRole('combobox', { name: 'Statuses' });
    await expect(statusFilter).toBeVisible({ timeout: 5000 });
    await statusFilter.click();

    const options = page.locator('mat-option');
    await expect(options.first()).toBeVisible({ timeout: 5000 });

    const activeOption = options.filter({ hasText: 'Active' });
    if (await activeOption.isVisible({ timeout: 2000 }).catch(() => false)) {
      await activeOption.click();
    } else {
      await options.first().click();
    }

    await page.waitForTimeout(500);
  });
});
