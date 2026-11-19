// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: cite/cite-test-plan.md
// seed: tests/seed.spec.ts

import { test, expect, apiDeleteTeamTypesByName, Services, CITE_THEMES, setCiteTheme } from '../../fixtures';
import { navigateToAdminSection, waitForDialogOpen } from '../../test-helpers';

for (const theme of CITE_THEMES) {
  test.describe(`${theme} theme › Administration - Team Types`, () => {

    const TEST_TEAM_TYPE = 'Test Team Type Automation';

    test('Create Team Type', async ({ citeAuthenticatedPage: page }) => {
      await setCiteTheme(page, theme);

      await navigateToAdminSection(page, 'Team Types');

      const addButton = page.getByRole('button', { name: 'Add Team Type' });
      await expect(addButton).toBeVisible({ timeout: 10000 });
      await addButton.click();

      const dialog = page.getByRole('dialog');
      await waitForDialogOpen(dialog);

      const nameField = dialog.getByRole('textbox').first();
      await nameField.fill(TEST_TEAM_TYPE);

      const saveButton = dialog.getByRole('button', { name: 'Save' });
      await expect(saveButton).toBeEnabled({ timeout: 5000 });
      await saveButton.click();

      // Rule D: wait for dialog to close, then wait for row to appear so cleanup can find it
      await expect(dialog).not.toBeVisible({ timeout: 10000 });
      await expect(page.locator('tbody tr').filter({ hasText: TEST_TEAM_TYPE })).toHaveCount(1, { timeout: 10000 });
    });

    test.afterEach(async () => {
      await apiDeleteTeamTypesByName(TEST_TEAM_TYPE);
    });
  });
}
