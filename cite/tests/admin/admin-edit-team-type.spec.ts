// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: cite/cite-test-plan.md
// seed: tests/seed.spec.ts

import { test, expect, Services, seedTeamType, apiDeleteTeamType } from '../../fixtures';
import { navigateToAdminSection, waitForAdminListLoad } from '../../test-helpers';

test.describe('Administration - Team Types', () => {

  let teamTypeName = '';
  let teamTypeId = '';
  const EDITED_TEAM_TYPE = `Edited TT ${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;

  test('Edit Team Type', async ({ citeAuthenticatedPage: page }) => {

    // 1. Seed a team type via API
    teamTypeName = `Edit TT ${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    teamTypeId = await seedTeamType(teamTypeName);

    // 2. Navigate to Team Types admin
    await navigateToAdminSection(page, 'Team Types');
    await waitForAdminListLoad(page, '/api/teamtypes', true);

    // Search for the team type
    const searchBox = page.locator('input[placeholder="Search"], input[type="search"], input[aria-label="Search"]').first();
    if (await searchBox.isVisible({ timeout: 2000 }).catch(() => false)) {
      await searchBox.clear();
      await searchBox.fill(teamTypeName);
      await page.waitForTimeout(1000);
    }

    const typeRow = page.locator('tbody tr').filter({ hasText: teamTypeName }).first();
    await expect(typeRow).toBeVisible({ timeout: 10000 });

    // 3. Click the edit button
    const editButton = typeRow.getByRole('button', { name: 'Edit Team Type' });
    await expect(editButton).toBeVisible({ timeout: 5000 });
    await editButton.click();

    const editDialog = page.getByRole('dialog');
    await expect(editDialog).toBeVisible({ timeout: 5000 });

    // 4. Edit the name
    const editNameField = editDialog.getByRole('textbox').first();
    await expect(editNameField).toBeVisible({ timeout: 5000 });
    const currentValue = await editNameField.inputValue();
    expect(currentValue).toBe(teamTypeName);

    await editNameField.clear();
    await editNameField.fill(EDITED_TEAM_TYPE);

    // 5. Save the edit
    const editSaveButton = editDialog.getByRole('button', { name: 'Save' });
    await expect(editSaveButton).toBeEnabled({ timeout: 5000 });
    await editSaveButton.click();
    await expect(editDialog).not.toBeVisible({ timeout: 10000 });
    await page.waitForTimeout(1000);

    // 6. Verify the edit is reflected in the list
    if (await searchBox.isVisible({ timeout: 2000 }).catch(() => false)) {
      await searchBox.clear();
      await searchBox.fill(EDITED_TEAM_TYPE);
      await page.waitForTimeout(1000);
    }

    const editedRow = page.locator('tbody tr').filter({ hasText: EDITED_TEAM_TYPE }).first();
    await expect(editedRow).toBeVisible({ timeout: 10000 });
  });

  test.afterEach(async () => {
    if (teamTypeId) {
      await apiDeleteTeamType(teamTypeId);
      teamTypeId = '';
    }
  });
});
