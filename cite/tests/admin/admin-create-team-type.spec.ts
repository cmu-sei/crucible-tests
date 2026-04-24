// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: cite/cite-test-plan.md
// seed: tests/seed.spec.ts

import { test, expect, Services } from '../../fixtures';
import { navigateToAdminSection, deleteTeamTypeByName } from '../../test-helpers';

test.describe('Administration - Team Types', () => {

  const TEST_TEAM_TYPE = 'Test Team Type Automation';

  test('Create Team Type', async ({ citeAuthenticatedPage: page }) => {

    await navigateToAdminSection(page, 'Team Types');

    const addButton = page.getByRole('button', { name: 'Add TeamType' });
    await expect(addButton).toBeVisible({ timeout: 10000 });
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
  });

  test.afterEach(async ({ citeAuthenticatedPage: page }) => {
    await deleteTeamTypeByName(page, TEST_TEAM_TYPE);
  });
});
