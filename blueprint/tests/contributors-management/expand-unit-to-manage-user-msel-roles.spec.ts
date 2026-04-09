// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: specs/blueprint-test-plan.md
// seed: tests/seed.spec.ts

import { test, expect, Services } from '../../fixtures';

// Test data constants
const TEST_USER_1_NAME = 'E2E Test User 1';
const TEST_USER_1_ID = '11111111-1111-1111-1111-111111111111';
const TEST_USER_2_NAME = 'E2E Test User 2';
const TEST_USER_2_ID = '22222222-2222-2222-2222-222222222222';
const TEST_UNIT_NAME = 'E2E Test Unit';
const TEST_UNIT_SHORT_NAME = 'E2E';
// When admin copies a MSEL, the API names it "{original} - Admin User"
const COPY_MSEL_SUFFIX = ' - Admin User';

// ---------------------------------------------------------------------------
// Helper: dismiss any visible error dialog (system-message component)
// ---------------------------------------------------------------------------
async function dismissErrorDialogIfPresent(page: any) {
  const closeBtn = page.locator(
    'app-system-message button, [class*="system-message"] button'
  ).first();
  if (await closeBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
    await closeBtn.click();
    await page.waitForTimeout(300);
  }
}

// ---------------------------------------------------------------------------
// Helper: wait for admin page to fully load
// Waits for the admin sidebar nav list to appear (permissions must be loaded).
// ---------------------------------------------------------------------------
async function waitForAdminReady(page: any) {
  await page.waitForLoadState('domcontentloaded');
  // The admin page can be slow to load under concurrent access.
  // Retry the full navigation if the sidebar doesn't appear in time.
  for (let attempt = 0; attempt < 3; attempt++) {
    const loaded = await page.waitForSelector('.appitems-container mat-list-item', { state: 'visible', timeout: 30000 })
      .then(() => true)
      .catch(() => false);
    if (loaded) return;
    if (attempt < 2) {
      await page.reload();
      await page.waitForLoadState('domcontentloaded');
    }
  }
  throw new Error('Admin sidebar did not load after 3 attempts');
}

// ---------------------------------------------------------------------------
// Helper: navigate to Users admin section
// ---------------------------------------------------------------------------
async function goToUsersAdmin(page: any) {
  await page.goto(`${Services.Blueprint.UI}/admin`);
  await waitForAdminReady(page);
  // Click the Users nav item in the sidebar
  const usersNav = page.locator('.appitems-container mat-list-item').filter({ hasText: 'Users' }).first();
  await expect(usersNav).toBeVisible({ timeout: 10000 });
  await usersNav.click();
  await page.waitForTimeout(1000);
  // Wait for the users table header to appear with "Add User" button
  await page.locator('button[title="Add User"]').first().waitFor({ state: 'visible', timeout: 10000 });
}

// ---------------------------------------------------------------------------
// Helper: navigate to Units admin section
// ---------------------------------------------------------------------------
async function goToUnitsAdmin(page: any) {
  await page.goto(`${Services.Blueprint.UI}/admin`);
  await waitForAdminReady(page);
  // Click the Units nav item in the sidebar
  const unitsNav = page.locator('.appitems-container mat-list-item').filter({ hasText: 'Units' }).first();
  await expect(unitsNav).toBeVisible({ timeout: 10000 });
  await unitsNav.click();
  await page.waitForTimeout(1000);
  // Wait for the units table to appear (Add Unit button in table header)
  await page.getByRole('button', { name: 'Add Unit' }).first().waitFor({ state: 'visible', timeout: 10000 });
}

// ---------------------------------------------------------------------------
// Helper: delete a Blueprint user by name (if it exists)
// Uses CSS selectors that match the actual Angular Material rendered DOM.
// Rows are <tr class="mat-mdc-row">, cells are <td class="mat-mdc-cell">.
// ---------------------------------------------------------------------------
async function deleteUserIfExists(page: any, userName: string) {
  // Dismiss any error dialog first
  await dismissErrorDialogIfPresent(page);
  // Find the row containing the user name
  const userRow = page.locator(`table tr.mat-mdc-row:has(td:has-text("${userName}"))`).first();
  const visible = await userRow.isVisible({ timeout: 2000 }).catch(() => false);
  if (!visible) {
    return;
  }
  const deleteBtn = userRow.locator('button[title="Delete User"]').first();
  const deleteBtnVisible = await deleteBtn.isVisible({ timeout: 2000 }).catch(() => false);
  if (!deleteBtnVisible) {
    return;
  }
  await deleteBtn.click();
  // The delete confirmation is handled by a dialog (ConfirmDialogComponent)
  const confirmDialog = page.locator('mat-dialog-container, [role="dialog"]').first();
  await expect(confirmDialog).toBeVisible({ timeout: 5000 });
  const confirmButton = page.locator(
    'mat-dialog-actions button:has-text("YES"), ' +
    'mat-dialog-container button:has-text("YES"), ' +
    '[role="dialog"] button:has-text("YES")'
  ).first();
  await expect(confirmButton).toBeVisible({ timeout: 5000 });
  await confirmButton.click();
  await page.waitForTimeout(500);
  // Dismiss any resulting error dialog
  await dismissErrorDialogIfPresent(page);
}

// ---------------------------------------------------------------------------
// Helper: create a Blueprint user (ID + name) via the admin user list
// ---------------------------------------------------------------------------
async function createBlueprintUser(page: any, userId: string, userName: string) {
  // Dismiss any previous error dialog
  await dismissErrorDialogIfPresent(page);

  // Click the "Add User" button (the plus-circle in the ID column header)
  const addUserBtn = page.locator('button[title="Add User"]').first();
  await expect(addUserBtn).toBeVisible({ timeout: 5000 });
  await addUserBtn.click();

  // Fill in User ID
  const userIdInput = page.locator('input[placeholder="User ID"]').first();
  await expect(userIdInput).toBeVisible({ timeout: 5000 });
  await userIdInput.fill(userId);

  // Fill in User Name (minimum 4 characters)
  const userNameInput = page.locator('input[placeholder="User Name"]').first();
  await expect(userNameInput).toBeVisible({ timeout: 5000 });
  await userNameInput.fill(userName);

  // Click the confirm/add button (account-plus icon)
  // The button is enabled only when both fields are valid
  const saveBtn = page.locator('button:has(mat-icon[fonticon="mdi-account-plus"])').first();
  await expect(saveBtn).toBeVisible({ timeout: 5000 });
  await expect(saveBtn).toBeEnabled({ timeout: 5000 });
  await saveBtn.click();

  await page.waitForTimeout(1000);

  // Dismiss any error dialog that appeared
  await dismissErrorDialogIfPresent(page);

  // expect: User appears in the table
  const userCell = page.locator(`table tr.mat-mdc-row:has(td:has-text("${userName}"))`).first();
  await expect(userCell).toBeVisible({ timeout: 5000 });
}

// ---------------------------------------------------------------------------
// Helper: delete unit by name if it exists
// ---------------------------------------------------------------------------
async function deleteUnitIfExists(page: any, unitName: string) {
  let deleteBtn = page.getByRole('button', { name: `Delete ${unitName}` }).first();
  while (await deleteBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
    await deleteBtn.click();
    const confirmDialog = page.locator('mat-dialog-container, [role="dialog"]').first();
    await expect(confirmDialog).toBeVisible({ timeout: 5000 });
    const confirmButton = page.locator(
      'mat-dialog-actions button:has-text("YES"), ' +
      'mat-dialog-container button:has-text("YES"), ' +
      '[role="dialog"] button:has-text("YES")'
    ).first();
    await expect(confirmButton).toBeVisible({ timeout: 5000 });
    await confirmButton.click();
    await page.waitForTimeout(500);
    deleteBtn = page.getByRole('button', { name: `Delete ${unitName}` }).first();
  }
}

// ---------------------------------------------------------------------------
// Helper: create a unit via the admin UI
// ---------------------------------------------------------------------------
async function createUnit(page: any, shortName: string, name: string) {
  const addButton = page.getByRole('button', { name: 'Add Unit' });
  await expect(addButton).toBeVisible({ timeout: 5000 });
  await addButton.click();

  const form = page.locator('[role="dialog"], [class*="dialog"], [class*="form"]').first();
  await expect(form).toBeVisible({ timeout: 5000 });

  const shortNameField = page.locator(
    'input[placeholder*="Short Name"], input[formControlName*="shortName"], input[name*="short"]'
  ).first();
  await expect(shortNameField).toBeVisible({ timeout: 5000 });
  await shortNameField.fill(shortName);

  const nameField = page.locator(
    'input[placeholder*="Name"]:not([placeholder*="Short"]), input[formControlName="name"]'
  ).first();
  await expect(nameField).toBeVisible({ timeout: 5000 });
  await nameField.fill(name);

  const saveButton = page.locator(
    'button:has-text("Save"), button[type="submit"]'
  ).first();
  await saveButton.click();

  await page.waitForTimeout(1000);

  const unitCell = page.getByRole('cell', { name: name, exact: true }).first();
  await expect(unitCell).toBeVisible({ timeout: 5000 });
}

// ---------------------------------------------------------------------------
// Helper: delete a MSEL from the build page by name
// Looks for a row containing a link with the given name, then clicks Delete.
// The MSEL list uses mat-table > mat-row > mat-cell (Angular Material).
// ---------------------------------------------------------------------------
async function deleteMselByName(page: any, mselName: string) {
  // MSEL rows in the build page use mat-row (Angular Material custom element)
  const mselRow = page.locator(`mat-row:has(mat-cell a:has-text("${mselName}"))`).first();
  if (!(await mselRow.isVisible({ timeout: 3000 }).catch(() => false))) {
    return;
  }
  const deleteBtn = mselRow.locator(`button[title="Delete ${mselName}"]`).first();
  if (!(await deleteBtn.isVisible({ timeout: 2000 }).catch(() => false))) {
    return;
  }
  await deleteBtn.click();
  const confirmDialog = page.locator('mat-dialog-container, [role="dialog"]').first();
  await expect(confirmDialog).toBeVisible({ timeout: 5000 });
  const confirmButton = page.locator(
    'mat-dialog-actions button:has-text("YES"), ' +
    'mat-dialog-container button:has-text("YES"), ' +
    '[role="dialog"] button:has-text("YES")'
  ).first();
  await expect(confirmButton).toBeVisible({ timeout: 5000 });
  await confirmButton.click();
  await page.waitForTimeout(1000);
}

// ---------------------------------------------------------------------------
// Helper: wait for the MSEL build page to load
// The MSEL list is rendered as a mat-table (Angular Material) not a native table.
// ---------------------------------------------------------------------------
async function waitForBuildPage(page: any) {
  await page.waitForLoadState('domcontentloaded');
  // Wait for the MSEL list mat-table to appear (Angular Material custom element)
  await page.locator('mat-table').first().waitFor({ state: 'visible', timeout: 15000 });
  await page.waitForTimeout(500);
}

// ---------------------------------------------------------------------------
// Main test
// ---------------------------------------------------------------------------
test.describe('Contributors Management', () => {
  test('Expand Unit to Manage User MSEL Roles - Full E2E Flow', async ({ blueprintAuthenticatedPage: page }) => {
    // 1. Authenticate
    await expect(page).toHaveURL(/.*localhost:4725.*/, { timeout: 10000 });

    // -------------------------------------------------------------------------
    // PRE-CLEANUP: remove any leftover data from prior runs
    // -------------------------------------------------------------------------

    // Navigate to the MSEL build list and clean up any copies from prior runs.
    // We must first discover what original MSEL name will be used so we can
    // clean up its copy. We find the first copyable MSEL then delete any
    // existing copy named "{original} - Admin User".
    await page.goto(`${Services.Blueprint.UI}/build`);
    await waitForBuildPage(page);

    const firstCopyBtn = page.locator('button[title^="Copy "]:not([disabled])').first();
    if (await firstCopyBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
      const copyBtnTitle = await firstCopyBtn.getAttribute('title');
      const originalMselNameForCleanup = copyBtnTitle?.replace(/^Copy\s+/, '') ?? '';
      if (originalMselNameForCleanup) {
        const existingCopyName = originalMselNameForCleanup + COPY_MSEL_SUFFIX;
        await deleteMselByName(page, existingCopyName);
      }
    }

    // Clean up test users (if they exist from previous runs)
    await goToUsersAdmin(page);
    await deleteUserIfExists(page, TEST_USER_1_NAME);
    await deleteUserIfExists(page, TEST_USER_2_NAME);

    // Clean up test unit
    await goToUnitsAdmin(page);
    await deleteUnitIfExists(page, TEST_UNIT_NAME);

    // -------------------------------------------------------------------------
    // STEP 1: Add test users to Blueprint admin
    // -------------------------------------------------------------------------
    // 1a. Navigate to Users admin section
    // expect: Users admin section is visible with search and table
    await goToUsersAdmin(page);

    // 1b. Create test user 1
    // expect: User creation form accepts ID (GUID) and Name (4+ chars)
    await createBlueprintUser(page, TEST_USER_1_ID, TEST_USER_1_NAME);

    // 1c. Create test user 2
    await createBlueprintUser(page, TEST_USER_2_ID, TEST_USER_2_NAME);

    // expect: Both users appear in the users table
    await expect(
      page.locator(`table tr.mat-mdc-row:has(td:has-text("${TEST_USER_1_NAME}"))`).first()
    ).toBeVisible({ timeout: 5000 });
    await expect(
      page.locator(`table tr.mat-mdc-row:has(td:has-text("${TEST_USER_2_NAME}"))`).first()
    ).toBeVisible({ timeout: 5000 });

    try {
      // -----------------------------------------------------------------------
      // STEP 2: Create a new unit
      // -----------------------------------------------------------------------
      // 2a. Navigate to Units admin section
      await goToUnitsAdmin(page);

      // 2b. Create the test unit
      // expect: Unit creation form appears with Short Name and Name fields
      await createUnit(page, TEST_UNIT_SHORT_NAME, TEST_UNIT_NAME);

      // -----------------------------------------------------------------------
      // STEP 3: Add test users to the unit
      // -----------------------------------------------------------------------
      // 3a. Click on the unit row to expand it
      // Units table rows use class element-row (from admin-units component)
      const unitRow = page.locator('table tbody tr.element-row').filter({ hasText: TEST_UNIT_NAME }).first();
      await expect(unitRow).toBeVisible({ timeout: 5000 });
      await unitRow.click();
      await page.waitForTimeout(500);

      // expect: Row expands to show app-admin-unit-users component
      const expandedDetail = page.locator('tr.detail-row app-admin-unit-users').first();
      await expect(expandedDetail).toBeVisible({ timeout: 5000 });

      // expect: "Users" panel (all users) is visible with add buttons
      const usersPanel = expandedDetail.locator('p:has-text("Users")').first();
      await expect(usersPanel).toBeVisible({ timeout: 5000 });

      // 3b. Add test user 1 to the unit
      // Add buttons in the Users panel have title "Add {userName}"
      const addUser1Btn = expandedDetail.locator(
        `button[title="Add ${TEST_USER_1_NAME}"]`
      ).first();
      await expect(addUser1Btn).toBeVisible({ timeout: 5000 });
      await addUser1Btn.click();
      await page.waitForTimeout(500);

      // 3c. Add test user 2 to the unit
      const addUser2Btn = expandedDetail.locator(
        `button[title="Add ${TEST_USER_2_NAME}"]`
      ).first();
      await expect(addUser2Btn).toBeVisible({ timeout: 5000 });
      await addUser2Btn.click();
      await page.waitForTimeout(500);

      // expect: Both users appear in the Unit Members section
      // The Unit Members section uses mat-cell (not td) since it's a mat-table
      const unitMembersSection = expandedDetail.locator('.unit-list-container').first();
      await expect(unitMembersSection).toBeVisible({ timeout: 5000 });
      await expect(
        unitMembersSection.locator(`mat-cell:has-text("${TEST_USER_1_NAME}")`).first()
      ).toBeVisible({ timeout: 5000 });
      await expect(
        unitMembersSection.locator(`mat-cell:has-text("${TEST_USER_2_NAME}")`).first()
      ).toBeVisible({ timeout: 5000 });

      // -----------------------------------------------------------------------
      // STEP 4: Find an existing MSEL and copy it
      // -----------------------------------------------------------------------
      await page.goto(`${Services.Blueprint.UI}/build`);
      await waitForBuildPage(page);

      // expect: MSEL list is visible with copy buttons
      // Copy buttons have title "Copy {mselName}" - the :not([disabled]) filter
      // ensures we pick an enabled copy button
      const copyBtn = page.locator('button[title^="Copy "]:not([disabled])').first();
      await expect(copyBtn).toBeVisible({ timeout: 10000 });

      // Get the MSEL name from the copy button title
      const copyBtnTitle = await copyBtn.getAttribute('title');
      const originalMselName = copyBtnTitle?.replace(/^Copy\s+/, '') ?? '';
      expect(originalMselName.length).toBeGreaterThan(0);

      // 4a. Click the copy button for the first available MSEL
      // expect: Copying creates a new MSEL named "{originalMselName} - Admin User"
      await copyBtn.click();
      await page.waitForTimeout(2000);

      // expect: A copy of the MSEL appears in the list
      // The name link is inside a mat-cell (Angular Material table cell)
      const copiedMselName = originalMselName + COPY_MSEL_SUFFIX;
      const copiedMselLink = page.locator(`mat-cell a:has-text("${copiedMselName}"), a:has-text("${copiedMselName}")`).first();
      await expect(copiedMselLink).toBeVisible({ timeout: 10000 });

      // -----------------------------------------------------------------------
      // STEP 5: Open the copied MSEL and navigate to Contributors
      // -----------------------------------------------------------------------
      // 5a. Click on the copied MSEL link to open it
      await copiedMselLink.click();
      await page.waitForLoadState('domcontentloaded');
      await page.waitForTimeout(1500);

      // expect: We are inside the MSEL view with sidebar navigation
      // The MSEL component shows a sidebar with mat-list-items including Contributors
      const contributorsNav = page.locator('mat-list-item:has-text("Contributors")').first();
      await expect(contributorsNav).toBeVisible({ timeout: 10000 });

      // 5b. Click Contributors in the sidebar
      await contributorsNav.click();
      await page.waitForTimeout(500);

      // expect: Contributors section loads (app-msel-contributors component)
      const contributorsSection = page.locator('app-msel-contributors').first();
      await expect(contributorsSection).toBeVisible({ timeout: 5000 });

      // -----------------------------------------------------------------------
      // STEP 6: Add the test unit to the MSEL
      // -----------------------------------------------------------------------
      // 6a. Expand the "Add a Contributor Unit" expansion panel
      // The panel header renders as a button in accessibility tree
      const addContributorPanel = page.locator('mat-expansion-panel:has-text("Add a Contributor Unit")').first();
      await expect(addContributorPanel).toBeVisible({ timeout: 5000 });

      const addContributorHeader = addContributorPanel.locator('mat-expansion-panel-header').first();
      await addContributorHeader.click();
      await page.waitForTimeout(500);

      // expect: Unit list appears; each unit shows in .other-units-div
      const unitOptionRow = page.locator(`.other-units-div:has-text("${TEST_UNIT_NAME}")`).first();
      await expect(unitOptionRow).toBeVisible({ timeout: 5000 });

      // 6b. Click the add button for the test unit
      const addUnitToMselBtn = unitOptionRow.locator('button[title="Add unit to MSEL"]').first();
      await expect(addUnitToMselBtn).toBeVisible({ timeout: 5000 });
      await addUnitToMselBtn.click();
      await page.waitForTimeout(500);

      // expect: The unit appears in the Contributors table
      // The table uses element-row class
      const unitInTable = page.locator(
        `app-msel-contributors tr.element-row:has(td:has-text("${TEST_UNIT_NAME}")), ` +
        `app-msel-contributors tr.element-row:has(mat-cell:has-text("${TEST_UNIT_NAME}"))`
      ).first();
      await expect(unitInTable).toBeVisible({ timeout: 5000 });

      // -----------------------------------------------------------------------
      // STEP 7: Expand the unit row to manage user MSEL roles
      // -----------------------------------------------------------------------
      // 7a. Click the unit row in the contributors table to expand it
      await unitInTable.click();
      await page.waitForTimeout(500);

      // expect: Row expands to show users in that unit
      // The expanded detail area has class .expanded-detail-div
      const expandedArea = page.locator('.expanded-detail-div').first();
      await expect(expandedArea).toBeVisible({ timeout: 5000 });

      // expect: Test users are shown in the expanded area with .user-name class
      const user1InExpanded = expandedArea.locator(`.user-name:has-text("${TEST_USER_1_NAME}")`).first();
      await expect(user1InExpanded).toBeVisible({ timeout: 5000 });

      const user2InExpanded = expandedArea.locator(`.user-name:has-text("${TEST_USER_2_NAME}")`).first();
      await expect(user2InExpanded).toBeVisible({ timeout: 5000 });

      // expect: Role checkboxes are shown for each user
      // Available roles: Editor, Approver, MoveEditor, Owner, Evaluator, Viewer
      const editorCheckboxForUser1 = expandedArea.locator(
        `.unit-detail:has(.user-name:has-text("${TEST_USER_1_NAME}")) mat-checkbox:has-text("Editor")`
      ).first();
      await expect(editorCheckboxForUser1).toBeVisible({ timeout: 5000 });

      // 7b. Toggle the Editor role for test user 1
      const user1EditorCheckboxInput = expandedArea.locator(
        `.unit-detail:has(.user-name:has-text("${TEST_USER_1_NAME}")) mat-checkbox:has-text("Editor") input[type="checkbox"]`
      ).first();
      await expect(user1EditorCheckboxInput).toBeVisible({ timeout: 5000 });
      const wasChecked = await user1EditorCheckboxInput.isChecked();

      // expect: Clicking the checkbox toggles the role assignment
      await user1EditorCheckboxInput.click({ force: true });
      await page.waitForTimeout(500);

      const isNowChecked = await user1EditorCheckboxInput.isChecked();
      expect(isNowChecked).toBe(!wasChecked);

      // 7c. Toggle the Viewer role for test user 2
      const user2ViewerCheckboxInput = expandedArea.locator(
        `.unit-detail:has(.user-name:has-text("${TEST_USER_2_NAME}")) mat-checkbox:has-text("Viewer") input[type="checkbox"]`
      ).first();
      await expect(user2ViewerCheckboxInput).toBeVisible({ timeout: 5000 });
      await user2ViewerCheckboxInput.click({ force: true });
      await page.waitForTimeout(500);

      // expect: Viewer role was toggled for user 2

      // -----------------------------------------------------------------------
      // STEP 8 (CLEANUP): Delete the copied MSEL
      // -----------------------------------------------------------------------
      // Navigate back to the MSEL build list
      await page.goto(`${Services.Blueprint.UI}/build`);
      await waitForBuildPage(page);

      // Find and delete the copied MSEL
      // expect: The copied MSEL appears in the list
      // The build page uses mat-row (Angular Material) not tr
      const deleteCopyRow = page.locator(
        `mat-row:has(mat-cell a:has-text("${copiedMselName}"))`
      ).first();
      await expect(deleteCopyRow).toBeVisible({ timeout: 5000 });

      const deleteCopyBtn = deleteCopyRow.locator(`button[title="Delete ${copiedMselName}"]`).first();
      await expect(deleteCopyBtn).toBeVisible({ timeout: 5000 });
      await deleteCopyBtn.click();

      // expect: Confirmation dialog appears with YES/NO buttons
      const deleteConfirmDialog = page.locator('mat-dialog-container, [role="dialog"]').first();
      await expect(deleteConfirmDialog).toBeVisible({ timeout: 5000 });
      await expect(deleteConfirmDialog).toContainText(/Are you sure that you want to delete/, { timeout: 5000 });

      const deleteConfirmBtn = page.locator(
        'mat-dialog-actions button:has-text("YES"), ' +
        'mat-dialog-container button:has-text("YES"), ' +
        '[role="dialog"] button:has-text("YES")'
      ).first();
      await expect(deleteConfirmBtn).toBeVisible({ timeout: 5000 });
      await deleteConfirmBtn.click();
      await page.waitForTimeout(1000);

      // expect: Copied MSEL no longer appears in the list
      await expect(
        page.locator(`mat-cell a:has-text("${copiedMselName}"), a:has-text("${copiedMselName}")`).first()
      ).not.toBeVisible({ timeout: 5000 });

    } finally {
      // -----------------------------------------------------------------------
      // STEP 9 (CLEANUP): Delete the test unit
      // -----------------------------------------------------------------------
      await goToUnitsAdmin(page);
      await deleteUnitIfExists(page, TEST_UNIT_NAME);

      // expect: Test unit no longer appears in the table
      await expect(
        page.getByRole('cell', { name: TEST_UNIT_NAME, exact: true }).first()
      ).not.toBeVisible({ timeout: 5000 });

      // -----------------------------------------------------------------------
      // STEP 10 (CLEANUP): Delete the test users
      // -----------------------------------------------------------------------
      await goToUsersAdmin(page);
      await deleteUserIfExists(page, TEST_USER_1_NAME);
      await deleteUserIfExists(page, TEST_USER_2_NAME);

      // expect: Test users no longer appear in the table
      await expect(
        page.locator(`table tr.mat-mdc-row:has(td:has-text("${TEST_USER_1_NAME}"))`).first()
      ).not.toBeVisible({ timeout: 5000 });
      await expect(
        page.locator(`table tr.mat-mdc-row:has(td:has-text("${TEST_USER_2_NAME}"))`).first()
      ).not.toBeVisible({ timeout: 5000 });
    }
  });
});
