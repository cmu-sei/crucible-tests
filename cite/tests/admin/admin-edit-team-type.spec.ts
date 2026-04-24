// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: cite/cite-test-plan.md
// seed: tests/seed.spec.ts

import { test, expect, Services } from '../../fixtures';
import { navigateToAdminSection, deleteTeamTypeByName } from '../../test-helpers';

test.describe('Administration - Team Types', () => {

  const TEST_TEAM_TYPE = 'Test Team Type For Edit';
  const EDITED_TEAM_TYPE = 'Edited Team Type Automation';

  test('Edit Team Type', async ({ citeAuthenticatedPage: page }) => {

    // 1. Create a team type to edit
    await navigateToAdminSection(page, 'Team Types');

    const addButton = page.getByRole('button', { name: 'Add TeamType' });
    await expect(addButton).toBeVisible({ timeout: 10000 });
    await addButton.click();

    const createDialog = page.getByRole('dialog');
    await expect(createDialog).toBeVisible({ timeout: 5000 });

    const nameField = createDialog.getByRole('textbox').first();
    await nameField.fill(TEST_TEAM_TYPE);

    const saveButton = createDialog.getByRole('button', { name: 'Save' });
    await expect(saveButton).toBeEnabled({ timeout: 5000 });
    await saveButton.click();
    await expect(createDialog).not.toBeVisible({ timeout: 10000 });
    await page.waitForTimeout(1000);

    // 2. Re-navigate and verify the team type was created
    await navigateToAdminSection(page, 'Team Types');

    const typeRow = page.locator('tbody tr').filter({ hasText: TEST_TEAM_TYPE }).first();
    await expect(typeRow).toBeVisible({ timeout: 10000 });

    // 3. Click the edit button on the created team type
    const editButton = typeRow.getByRole('button', { name: 'Edit Team Type' });
    await expect(editButton).toBeVisible({ timeout: 5000 });
    await editButton.click();

    const editDialog = page.getByRole('dialog');
    await expect(editDialog).toBeVisible({ timeout: 5000 });

    // 4. Edit the name
    const editNameField = editDialog.getByRole('textbox').first();
    await expect(editNameField).toBeVisible({ timeout: 5000 });
    const currentValue = await editNameField.inputValue();
    expect(currentValue).toBe(TEST_TEAM_TYPE);

    await editNameField.clear();
    await editNameField.fill(EDITED_TEAM_TYPE);

    // 5. Save the edit
    const editSaveButton = editDialog.getByRole('button', { name: 'Save' });
    await expect(editSaveButton).toBeEnabled({ timeout: 5000 });
    await editSaveButton.click();
    await expect(editDialog).not.toBeVisible({ timeout: 10000 });
    await page.waitForTimeout(1000);

    // 6. Verify the edit is reflected in the list
    await navigateToAdminSection(page, 'Team Types');

    const editedRow = page.locator('tbody tr').filter({ hasText: EDITED_TEAM_TYPE }).first();
    await expect(editedRow).toBeVisible({ timeout: 10000 });

    const oldRow = page.locator('tbody tr').filter({ hasText: TEST_TEAM_TYPE });
    await expect(oldRow).toHaveCount(0, { timeout: 5000 });
  });

  test.afterEach(async ({ citeAuthenticatedPage: page }) => {
    await deleteTeamTypeByName(page, EDITED_TEAM_TYPE);
    await deleteTeamTypeByName(page, TEST_TEAM_TYPE);
  });
});
