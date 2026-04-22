// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: cite/cite-test-plan.md
// seed: tests/seed.spec.ts

import { test, expect, Services } from '../../fixtures';
import { navigateToAdminSection, deleteScoringModelByName } from '../../test-helpers';

test.describe('Administration - Scoring Models', () => {

  const TEST_MODEL_NAME = 'Test Model For Memberships';

  test('Manage Scoring Model Memberships', async ({ citeAuthenticatedPage: page }) => {

    // 1. Create a scoring model
    await navigateToAdminSection(page, 'Scoring Models');

    const addButton = page.getByRole('button', { name: 'Add Scoring Model' });
    await addButton.click();

    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible({ timeout: 5000 });

    const descField = page.getByRole('textbox', { name: 'Scoring Model Description' });
    await descField.fill(TEST_MODEL_NAME);

    const saveButton = dialog.getByRole('button', { name: 'Save' });
    await expect(saveButton).toBeEnabled({ timeout: 5000 });
    await saveButton.click();
    await expect(dialog).not.toBeVisible({ timeout: 15000 });
    await page.waitForTimeout(2000);

    // 2. Re-navigate and expand the scoring model
    await navigateToAdminSection(page, 'Scoring Models');

    const modelRow = page.locator('tbody tr').filter({ hasText: TEST_MODEL_NAME }).first();
    await expect(modelRow).toBeVisible({ timeout: 10000 });
    await modelRow.click();
    await page.waitForTimeout(2000);

    // 3. Find and expand the Memberships panel
    const membershipsPanel = page.locator('mat-expansion-panel').filter({ hasText: 'Memberships' }).first();
    await expect(membershipsPanel).toBeVisible({ timeout: 10000 });
    await membershipsPanel.locator('mat-expansion-panel-header').click();
    await page.waitForTimeout(1000);

    // 4. Verify the two-panel membership layout is visible (Users/Groups and ScoringModel Members)
    const membershipContent = membershipsPanel.locator('.mat-expansion-panel-body, mat-expansion-panel-body').first();
    await expect(membershipContent).toBeVisible({ timeout: 5000 });

    // Verify the Users/Groups panel and Members panel are displayed
    const usersGroupsToolbar = membershipsPanel.locator('text=Users/Groups').first();
    await expect(usersGroupsToolbar).toBeVisible({ timeout: 10000 });

    const membersToolbar = membershipsPanel.locator('text=ScoringModel Members').first();
    await expect(membersToolbar).toBeVisible({ timeout: 10000 });
  });

  test.afterEach(async ({ citeAuthenticatedPage: page }) => {
    await deleteScoringModelByName(page, TEST_MODEL_NAME);
  });
});
