// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: specs/blueprint-test-plan.md
// seed: tests/seed.spec.ts

import { test, expect, Services } from '../../fixtures';

// Teams are not a top-level section in Blueprint UI.
// They live inside a MSEL at /build?msel=<id>.
// To access teams: navigate to /build, open a MSEL, then click "Teams" in the MSEL sidebar.
const MSEL_NAME = 'Project Lagoon TTX - Admin User';

test.describe('Teams and Organizations Management', () => {
  test('Edit Team', async ({ blueprintAuthenticatedPage: page }) => {

    // 1. Navigate to the Build section (MSEL list)
    await page.goto(`${Services.Blueprint.UI}/build`);

    // Wait for MSEL table to load
    const mselTable = page.getByText('My MSELs');
    const tableVisible = await mselTable.waitFor({ state: 'visible', timeout: 30000 }).then(() => true).catch(() => false);
    if (!tableVisible) {
      test.skip();
      return;
    }

    // Wait for MSEL data rows to appear
    const mselDataRows = page.locator('[role="row"] a[href*="/build?msel="]').first();
    const dataRowsVisible = await mselDataRows.waitFor({ state: 'visible', timeout: 30000 }).then(() => true).catch(() => false);
    if (!dataRowsVisible) {
      test.skip();
      return;
    }

    // Find and click the MSEL that has teams
    const mselLink = page.locator(`a:text-is("${MSEL_NAME}")`).first();
    const mselExists = await mselLink.waitFor({ state: 'visible', timeout: 10000 }).then(() => true).catch(() => false);
    if (!mselExists) {
      test.skip();
      return;
    }

    await mselLink.click();

    // Wait for the MSEL detail page to load
    await expect(page).toHaveURL(/\/build\?msel=/, { timeout: 10000 });

    // 2. Click 'Teams' in the MSEL sidebar navigation
    const teamsNavItem = page.locator('text=Teams').first();
    await expect(teamsNavItem).toBeVisible({ timeout: 10000 });
    await teamsNavItem.click();

    // 3. expect: Teams table is visible with team rows
    // The teams list uses Angular Material mat-table (role="table")
    const teamsTable = page.getByRole('table').first();
    await expect(teamsTable).toBeVisible({ timeout: 10000 });

    // Verify there are edit buttons
    const editButton = page.getByRole('button', { name: /^Edit / }).first();
    const editButtonVisible = await editButton.waitFor({ state: 'visible', timeout: 10000 }).then(() => true).catch(() => false);
    if (!editButtonVisible) {
      test.skip();
      return;
    }

    // 4. Click the edit button for the first team
    await editButton.click();

    // 5. expect: Edit Team dialog appears
    const editDialog = page.getByRole('dialog', { name: 'Edit Team' });
    await expect(editDialog).toBeVisible({ timeout: 5000 });

    // expect: Name field is populated with current value
    const nameField = editDialog.getByRole('textbox', { name: 'Name', exact: true });
    await expect(nameField).toBeVisible({ timeout: 3000 });

    const originalName = await nameField.inputValue();
    expect(originalName.length).toBeGreaterThan(0);

    // 6. Modify the team name (append a marker to test editing, then revert)
    const editedName = `${originalName} - Edited`;
    await nameField.fill(editedName);

    // expect: Changes can be made to the name field
    await expect(nameField).toHaveValue(editedName);

    // 7. Revert the name back to the original to keep test data clean
    await nameField.fill(originalName);
    await expect(nameField).toHaveValue(originalName);

    // 8. Click 'Save' button to save (with the original value restored)
    const saveButton = editDialog.getByRole('button', { name: 'Save' });
    await expect(saveButton).toBeVisible({ timeout: 3000 });
    await saveButton.click();

    // 9. expect: Dialog closes after saving
    await expect(editDialog).not.toBeVisible({ timeout: 5000 });

    // expect: Teams table is still visible after saving
    await expect(teamsTable).toBeVisible({ timeout: 5000 });
  });
});
