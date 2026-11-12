// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: cite/cite-test-plan.md
// seed: tests/seed.spec.ts

import { test, expect, apiDeleteGroupsByName, Services, CITE_THEMES, setCiteTheme } from '../../fixtures';
import { navigateToAdminSection, waitForDialogOpen } from '../../test-helpers';

for (const theme of CITE_THEMES) {
  test.describe(`${theme} theme › Administration - Groups`, () => {

    const TEST_GROUP_NAME = 'Test Group Automation';

    test('Create Group', async ({ citeAuthenticatedPage: page }) => {
      await setCiteTheme(page, theme);

      await navigateToAdminSection(page, 'Groups');

      const table = page.locator('table');
      await expect(table).toBeVisible({ timeout: 10000 });

      const addButton = page.locator('button[mattooltip="Add New Group"]');
      await addButton.click();

      const dialog = page.getByRole('dialog', { name: 'Add Group' });
      await waitForDialogOpen(dialog);

      const nameField = dialog.getByRole('textbox', { name: 'Name' });
      await nameField.fill(TEST_GROUP_NAME);

      const saveButton = dialog.getByRole('button', { name: 'Save' });
      await expect(saveButton).toBeEnabled({ timeout: 5000 });
      await saveButton.click();

      // Rule D: wait for dialog to close, then wait for row to appear so cleanup can find it
      await expect(dialog).not.toBeVisible({ timeout: 10000 });
      await expect(page.locator('tbody tr').filter({ hasText: TEST_GROUP_NAME })).toHaveCount(1, { timeout: 10000 });
    });

    test.afterEach(async () => {
      await apiDeleteGroupsByName(TEST_GROUP_NAME);
    });
  });
}
