// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: cite/cite-test-plan.md
// seed: tests/seed.spec.ts

import { test, expect, Services, seedTeamType, apiDeleteTeamType } from '../../fixtures';
import { navigateToAdminSection, waitForAdminListLoad } from '../../test-helpers';

test.describe('Administration - Team Types', () => {

  let teamTypeName = '';
  let teamTypeId = '';

  test('Delete Team Type', async ({ citeAuthenticatedPage: page }) => {

    // 1. Seed a team type via API
    teamTypeName = `Delete TT ${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
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

    // 3. Delete it
    const typeRow = page.locator('tbody tr').filter({ hasText: teamTypeName }).first();
    await expect(typeRow).toBeVisible({ timeout: 10000 });

    const deleteButton = typeRow.getByRole('button', { name: 'Delete Team Type' });
    await expect(deleteButton).toBeVisible({ timeout: 5000 });
    await deleteButton.click();

    const confirmDialog = page.getByRole('dialog');
    await expect(confirmDialog).toBeVisible({ timeout: 5000 });

    const yesButton = confirmDialog.getByRole('button', { name: 'Yes' });
    await yesButton.click();
    await expect(confirmDialog).not.toBeVisible({ timeout: 5000 });
    await page.waitForTimeout(1000);

    // 4. Verify it's gone
    await expect(typeRow).not.toBeVisible({ timeout: 10000 });

    // Mark as cleaned so afterEach doesn't try again
    teamTypeId = '';
  });

  test.afterEach(async () => {
    if (teamTypeId) {
      await apiDeleteTeamType(teamTypeId);
      teamTypeId = '';
    }
  });
});
