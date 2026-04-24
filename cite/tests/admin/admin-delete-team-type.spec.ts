// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: cite/cite-test-plan.md
// seed: tests/seed.spec.ts

import { test, expect, Services } from '../../fixtures';
import { navigateToAdminSection, deleteTeamTypeByName } from '../../test-helpers';

test.describe('Administration - Team Types', () => {

  const TEST_TEAM_TYPE = 'Test Team Type For Delete';

  test('Delete Team Type', async ({ citeAuthenticatedPage: page }) => {

    // Create a team type first
    await navigateToAdminSection(page, 'Team Types');

    const addButton = page.getByRole('button', { name: 'Add TeamType' });
    await addButton.click();

    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible({ timeout: 5000 });

    const nameField = dialog.getByRole('textbox').first();
    await nameField.fill(TEST_TEAM_TYPE);

    const saveButton = dialog.getByRole('button', { name: 'Save' });
    await expect(saveButton).toBeEnabled({ timeout: 5000 });
    await saveButton.click();
    await expect(dialog).not.toBeVisible({ timeout: 10000 });
    await page.waitForTimeout(1000);

    // Now delete it
    const typeRow = page.locator('tbody tr').filter({ hasText: TEST_TEAM_TYPE });
    await expect(typeRow).toBeVisible({ timeout: 10000 });

    const deleteButton = typeRow.getByRole('button', { name: 'Delete Team Type' });
    await deleteButton.click();

    const confirmDialog = page.getByRole('dialog');
    await expect(confirmDialog).toBeVisible({ timeout: 5000 });

    const yesButton = confirmDialog.getByRole('button', { name: 'Yes' });
    await yesButton.click();
    await expect(confirmDialog).not.toBeVisible({ timeout: 5000 });
    await page.waitForTimeout(1000);
  });

  test.afterEach(async ({ citeAuthenticatedPage: page }) => {
    await deleteTeamTypeByName(page, TEST_TEAM_TYPE);
  });
});
