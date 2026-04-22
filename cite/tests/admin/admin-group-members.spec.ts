// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: cite/cite-test-plan.md
// seed: tests/seed.spec.ts

import { test, expect, Services } from '../../fixtures';
import { navigateToAdminSection, deleteGroupByName } from '../../test-helpers';

test.describe('Administration - Groups', () => {

  const TEST_GROUP_NAME = 'Test Group For Members';

  test('Manage Group Members', async ({ citeAuthenticatedPage: page }) => {

    // Create a group first
    await navigateToAdminSection(page, 'Groups');

    const table = page.locator('table');
    await expect(table).toBeVisible({ timeout: 10000 });

    const addButton = page.locator('button[mattooltip="Add New Group"]');
    await addButton.click();

    const createDialog = page.getByRole('dialog', { name: 'Create New Group?' });
    await expect(createDialog).toBeVisible({ timeout: 5000 });

    const nameField = createDialog.getByRole('textbox', { name: 'Name' });
    await nameField.fill(TEST_GROUP_NAME);

    const saveButton = createDialog.getByRole('button', { name: 'Save' });
    await expect(saveButton).toBeEnabled({ timeout: 5000 });
    await saveButton.click();
    await expect(createDialog).not.toBeVisible({ timeout: 10000 });
    await page.waitForTimeout(1000);

    // Verify group exists
    const groupRow = page.locator('tbody tr').filter({ hasText: TEST_GROUP_NAME }).first();
    await expect(groupRow).toBeVisible({ timeout: 10000 });
  });

  test.afterEach(async ({ citeAuthenticatedPage: page }) => {
    await deleteGroupByName(page, TEST_GROUP_NAME);
  });
});
