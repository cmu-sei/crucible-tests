// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: specs/blueprint-test-plan.md
// seed: tests/seed.spec.ts
//
// Test: Expand Unit to Manage User MSEL Roles
//
// Covers the full lifecycle:
//  1.  Create 2 test users in the Users admin section
//  2.  Create a new unit in the Units admin section
//  3.  Add both test users as members of the unit
//  4.  Copy an existing MSEL (result is auto-named "<original> - Admin User")
//  5.  Rename the MSEL copy to "E2E MSEL Copy Test" via the MSEL Info tab
//  6.  Navigate to the Contributors tab, add the created unit
//  7.  Expand the unit row and assign MSEL roles to both test users
//  8.  Cleanup: delete MSEL copy, unit, both users

import { test, expect, Services } from '../../fixtures';

/** Simple UUID v4 generator (no external dependency). */
function uuidv4(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

// ─── Constants ────────────────────────────────────────────────────────────────

const USER1_NAME = 'E2E Test User 1';
const USER2_NAME = 'E2E Test User 2';
const UNIT_NAME  = 'E2E Test Unit';
const UNIT_SHORT = 'E2EU';
const MSEL_COPY_NAME = 'E2E MSEL Copy Test';

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Navigate to the admin section and click the given left-nav item. */
async function gotoAdminSection(page: any, section: 'Users' | 'Units') {
  await page.goto(`${Services.Blueprint.UI}/admin`);
  await page.waitForLoadState('domcontentloaded');

  const navItem = page.locator(`mat-list-item:has-text("${section}")`).first();
  await expect(navItem).toBeVisible({ timeout: 10000 });
  await navItem.click();
  await page.waitForLoadState('domcontentloaded');
  await page.waitForTimeout(500);
}

/**
 * Create a Blueprint user via the Users admin table.
 * Returns the generated UUID used as the user ID.
 */
async function createUser(page: any, name: string): Promise<string> {
  const userId = uuidv4();

  // Click "Add User" button (the plus-circle icon in the ID column header)
  const addUserBtn = page.getByRole('button', { name: 'Add User' });
  await expect(addUserBtn).toBeVisible({ timeout: 5000 });
  await addUserBtn.click();
  await page.waitForTimeout(300);

  // Fill User ID
  const idInput = page.locator('input[placeholder="User ID"]');
  await expect(idInput).toBeVisible({ timeout: 5000 });
  await idInput.fill(userId);

  // Fill User Name
  const nameInput = page.locator('input[placeholder="User Name"]');
  await expect(nameInput).toBeVisible({ timeout: 5000 });
  await nameInput.fill(name);

  // Click "Add this user"
  const submitBtn = page.locator('button[mat-icon-button]:has(mat-icon[fontIcon="mdi-account-plus"])');
  await expect(submitBtn).toBeVisible({ timeout: 5000 });
  await submitBtn.click();
  await page.waitForLoadState('domcontentloaded');
  await page.waitForTimeout(500);

  return userId;
}

/** Delete all Blueprint users whose name matches `name` via the admin table. */
async function deleteUserByName(page: any, name: string) {
  // The delete button is a trash-can icon in the Role column of the row.
  // Rows are: tr[mat-row] containing td cells with name text.
  // There's a single delete button per row (title="Delete User").
  const rows = page.locator('table tbody tr').filter({ hasText: name });
  const count = await rows.count();
  for (let i = count - 1; i >= 0; i--) {
    const row = rows.nth(i);
    const deleteBtn = row.locator('button[title="Delete User"]');
    if (await deleteBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await deleteBtn.click();
      // Confirm dialog: YES button
      const yesBtn = page.locator('[role="dialog"] button:has-text("YES")');
      await expect(yesBtn).toBeVisible({ timeout: 5000 });
      await yesBtn.click();
      await page.waitForLoadState('domcontentloaded');
      await page.waitForTimeout(500);
    }
  }
}

/** Create a unit via the Units admin table dialog. */
async function createUnit(page: any, shortName: string, name: string) {
  const addUnitBtn = page.getByRole('button', { name: 'Add Unit' });
  await expect(addUnitBtn).toBeVisible({ timeout: 5000 });
  await addUnitBtn.click();

  const dialog = page.locator('[role="dialog"]').first();
  await expect(dialog).toBeVisible({ timeout: 5000 });

  // Name comes first in the dialog HTML
  const nameInput = dialog.locator('input[placeholder="Name (required)"]');
  await expect(nameInput).toBeVisible({ timeout: 5000 });
  await nameInput.fill(name);

  const shortNameInput = dialog.locator('input[placeholder="Short Name (required)"]');
  await expect(shortNameInput).toBeVisible({ timeout: 5000 });
  await shortNameInput.fill(shortName);

  const saveBtn = dialog.locator('button:has-text("Save")');
  await saveBtn.click();

  await page.waitForLoadState('domcontentloaded');
  await page.waitForTimeout(500);

  // Verify unit row appeared
  const cell = page.locator('table tbody td').filter({ hasText: name }).first();
  await expect(cell).toBeVisible({ timeout: 5000 });
}

/** Delete all units matching `name` via their delete button in the admin table. */
async function deleteUnitByName(page: any, name: string) {
  let btn = page.getByRole('button', { name: `Delete ${name}` }).first();
  while (await btn.isVisible({ timeout: 2000 }).catch(() => false)) {
    await btn.click();
    const yesBtn = page.locator('[role="dialog"] button:has-text("YES")');
    await expect(yesBtn).toBeVisible({ timeout: 5000 });
    await yesBtn.click();
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(500);
    btn = page.getByRole('button', { name: `Delete ${name}` }).first();
  }
}

/** Expand a unit row in the admin Units table and add a user to the unit. */
async function addUserToUnit(page: any, unitName: string, userName: string) {
  // Click the unit row to expand it
  const unitRow = page.locator('tr.element-row, tr[mat-row]').filter({ hasText: unitName }).first();
  await expect(unitRow).toBeVisible({ timeout: 5000 });
  await unitRow.click();
  await page.waitForTimeout(500);

  // The expanded panel shows two lists: "Users" (all users) and "Unit Members"
  const expandedPanel = page.locator('app-admin-unit-users').first();
  await expect(expandedPanel).toBeVisible({ timeout: 5000 });

  // Find "Add {userName}" button in the Users (all users) list
  const addBtn = expandedPanel.locator(`button[title="Add ${userName}"]`).first();
  await expect(addBtn).toBeVisible({ timeout: 5000 });
  await addBtn.click();
  await page.waitForLoadState('domcontentloaded');
  await page.waitForTimeout(500);

  // Verify user appears in Unit Members section
  const unitMembersSection = expandedPanel.locator('.unit-list-container');
  await expect(unitMembersSection.locator(`mat-cell:has-text("${userName}"), td:has-text("${userName}")`).first())
    .toBeVisible({ timeout: 5000 });
}

// ─── Test ─────────────────────────────────────────────────────────────────────

test.describe('Expand Unit to Manage User MSEL Roles', () => {
  test('Create users + unit, copy MSEL, assign MSEL roles via Contributors tab', async ({ blueprintAuthenticatedPage: page }) => {
    // 1. Authenticate
    await expect(page).toHaveURL(/.*localhost:4725.*/, { timeout: 15000 });

    // ── PRE-CLEANUP ────────────────────────────────────────────────────────────

    // Clean up any leftover MSEL copies from prior runs
    await page.goto(`${Services.Blueprint.UI}/build`);
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(2000);

    // Delete leftover MSEL copies named "E2E MSEL Copy Test"
    let mselDeleteBtn = page.getByRole('button', { name: `Delete ${MSEL_COPY_NAME}` }).first();
    while (await mselDeleteBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await mselDeleteBtn.click();
      const yesBtn = page.locator('[role="dialog"] button:has-text("YES")');
      await expect(yesBtn).toBeVisible({ timeout: 5000 });
      await yesBtn.click();
      await page.waitForLoadState('domcontentloaded');
      await page.waitForTimeout(500);
      mselDeleteBtn = page.getByRole('button', { name: `Delete ${MSEL_COPY_NAME}` }).first();
    }

    // Clean up leftover test unit
    await gotoAdminSection(page, 'Units');
    await deleteUnitByName(page, UNIT_NAME);

    // Clean up leftover test users
    await gotoAdminSection(page, 'Users');
    await deleteUserByName(page, USER1_NAME);
    await deleteUserByName(page, USER2_NAME);

    // ── STEP 1: Create two test users ─────────────────────────────────────────

    // 2. Navigate to Users admin section
    await gotoAdminSection(page, 'Users');

    // Create User 1
    await createUser(page, USER1_NAME);
    // Verify User 1 appears in the table
    await expect(page.locator('table tbody td').filter({ hasText: USER1_NAME }).first())
      .toBeVisible({ timeout: 5000 });

    // Create User 2
    await createUser(page, USER2_NAME);
    // Verify User 2 appears in the table
    await expect(page.locator('table tbody td').filter({ hasText: USER2_NAME }).first())
      .toBeVisible({ timeout: 5000 });

    // ── STEP 2: Create a unit ─────────────────────────────────────────────────

    // 3. Navigate to Units admin section
    await gotoAdminSection(page, 'Units');

    // Create the unit
    await createUnit(page, UNIT_SHORT, UNIT_NAME);

    // ── STEP 3: Add both users to the unit ────────────────────────────────────

    // 4. Expand unit row and add User 1
    await addUserToUnit(page, UNIT_NAME, USER1_NAME);

    // 5. Add User 2 (unit is already expanded; click again to collapse then re-expand,
    //    or just find the add button directly since panel is still open)
    const expandedPanel = page.locator('app-admin-unit-users').first();
    const addUser2Btn = expandedPanel.locator(`button[title="Add ${USER2_NAME}"]`).first();

    if (await addUser2Btn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await addUser2Btn.click();
      await page.waitForLoadState('domcontentloaded');
      await page.waitForTimeout(500);
    } else {
      // Re-expand the unit row if it collapsed
      await addUserToUnit(page, UNIT_NAME, USER2_NAME);
    }

    // Verify User 2 also appears in Unit Members
    const unitMembersSection2 = page.locator('app-admin-unit-users .unit-list-container').first();
    await expect(unitMembersSection2.locator(`mat-cell:has-text("${USER2_NAME}"), td:has-text("${USER2_NAME}")`).first())
      .toBeVisible({ timeout: 5000 });

    // ── STEP 4: Copy an existing MSEL ─────────────────────────────────────────

    // 6. Navigate to the Build (MSEL list) section
    await page.goto(`${Services.Blueprint.UI}/build`);
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(2000);

    // Find the first available MSEL to copy
    const mselRows = page.locator('mat-table mat-row, table tbody tr').filter({ hasText: /\w/ });
    const mselCount = await mselRows.count();
    expect(mselCount).toBeGreaterThan(0);

    // Get the first MSEL's name link that has visible text (skip unnamed MSELs)
    const firstMselNameEl = page.locator('a[href*="/build?msel="]').filter({ hasText: /\S/ }).first();
    await expect(firstMselNameEl).toBeVisible({ timeout: 5000 });
    const firstMselName = (await firstMselNameEl.textContent())?.trim() ?? '';
    expect(firstMselName.length).toBeGreaterThan(0);

    // Click the Copy button for the first MSEL
    // The copy button has title "Copy {name}"
    const copyBtn = page.getByRole('button', { name: `Copy ${firstMselName}` }).first();
    await expect(copyBtn).toBeVisible({ timeout: 5000 });
    await copyBtn.click();
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(2000);

    // The copy is created with name "{firstMselName} - Admin User"
    const autoCopyName = `${firstMselName} - Admin User`;
    // expect: new MSEL row appears in the list
    await expect(page.locator('mat-cell, td').filter({ hasText: autoCopyName }).first())
      .toBeVisible({ timeout: 10000 });

    // ── STEP 5: Rename the copy to "E2E MSEL Copy Test" ─────────────────────

    // 7. Click the copied MSEL name to open it
    const copiedMselLink = page.locator('a').filter({ hasText: autoCopyName }).first();
    await expect(copiedMselLink).toBeVisible({ timeout: 5000 });
    await copiedMselLink.click();
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(1000);

    // expect: We are now on the MSEL detail page (URL includes msel= param or /build)
    await expect(page).toHaveURL(/build/, { timeout: 10000 });

    // Navigate to the "Info" tab (should be selected by default)
    const infoTabItem = page.locator('mat-list-item').filter({ hasText: 'Info' }).first();
    if (await infoTabItem.isVisible({ timeout: 2000 }).catch(() => false)) {
      await infoTabItem.click();
      await page.waitForTimeout(500);
    }

    // Find and update the MSEL name field in the Info tab
    const mselNameInput = page.getByRole('textbox', { name: 'Name' });
    await expect(mselNameInput).toBeVisible({ timeout: 5000 });
    await mselNameInput.click();
    await mselNameInput.press('Control+A'); // select all
    await mselNameInput.fill(MSEL_COPY_NAME);
    await mselNameInput.press('Tab'); // blur to trigger form validation
    await page.waitForTimeout(500);

    // Wait for Save Changes button to become enabled, then click it
    const saveInfoBtn = page.getByRole('button', { name: /Save Changes/i });
    await expect(saveInfoBtn).toBeEnabled({ timeout: 5000 });
    await saveInfoBtn.click();
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(1000);

    // ── STEP 6: Go to Contributors tab and add the unit ──────────────────────

    // 8. Click "Contributors" in the MSEL side navigation
    const contributorsTab = page.locator('mat-list-item').filter({ hasText: 'Contributors' }).first();
    await expect(contributorsTab).toBeVisible({ timeout: 5000 });
    await contributorsTab.click();
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(500);

    // expect: Contributors section is visible
    const contributorsSection = page.locator('app-msel-contributors').first();
    await expect(contributorsSection).toBeVisible({ timeout: 5000 });

    // 9. Expand "Add a Contributor Unit" panel and click Add for our unit
    const addUnitPanel = page.locator('mat-expansion-panel').filter({ hasText: 'Add a Contributor Unit' }).first();
    await expect(addUnitPanel).toBeVisible({ timeout: 5000 });
    await addUnitPanel.locator('mat-expansion-panel-header').click();
    await page.waitForTimeout(500);

    // Find and click the "+ Add unit to MSEL" button next to our unit
    const unitEntries = page.locator('.other-units-div').filter({ hasText: UNIT_NAME });
    const unitEntry = unitEntries.first();
    await expect(unitEntry).toBeVisible({ timeout: 5000 });
    const addToMselBtn = unitEntry.locator('button[title="Add unit to MSEL"]');
    await expect(addToMselBtn).toBeVisible({ timeout: 5000 });
    await addToMselBtn.click();
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(1000);

    // expect: The unit now appears in the Contributors table
    const unitRowInContributors = page.locator('app-msel-contributors table tbody tr, app-msel-contributors mat-row')
      .filter({ hasText: UNIT_NAME }).first();
    await expect(unitRowInContributors).toBeVisible({ timeout: 5000 });

    // ── STEP 7: Expand the unit row and assign MSEL roles ────────────────────

    // 10. Click the unit row in the Contributors table to expand it
    await unitRowInContributors.click();
    await page.waitForTimeout(500);

    // expect: Expanded detail shows users with role checkboxes
    const expandedDetail = page.locator('app-msel-contributors .expanded-detail-div').first();
    await expect(expandedDetail).toBeVisible({ timeout: 5000 });

    // expect: Both test users are shown
    await expect(expandedDetail.locator(`.user-name:has-text("${USER1_NAME}"), div:has-text("${USER1_NAME}")`).first())
      .toBeVisible({ timeout: 5000 });
    await expect(expandedDetail.locator(`.user-name:has-text("${USER2_NAME}"), div:has-text("${USER2_NAME}")`).first())
      .toBeVisible({ timeout: 5000 });

    // 11. Assign a MSEL role checkbox to User 1
    // Find the first unchecked checkbox in User 1's row
    const user1Row = expandedDetail.locator('.unit-detail').filter({ hasText: USER1_NAME }).first();
    await expect(user1Row).toBeVisible({ timeout: 5000 });
    const user1Checkboxes = user1Row.locator('mat-checkbox');
    const user1CheckboxCount = await user1Checkboxes.count();
    expect(user1CheckboxCount).toBeGreaterThan(0);

    // Click the first checkbox for User 1 (check it)
    const firstUser1Checkbox = user1Checkboxes.first();
    const wasChecked = await firstUser1Checkbox.locator('input').isChecked();
    if (!wasChecked) {
      await firstUser1Checkbox.click({ force: true });
      await page.waitForTimeout(500);
      await expect(firstUser1Checkbox.locator('input')).toBeChecked({ timeout: 5000 });
    }

    // 12. Assign a MSEL role checkbox to User 2
    const user2Row = expandedDetail.locator('.unit-detail').filter({ hasText: USER2_NAME }).first();
    await expect(user2Row).toBeVisible({ timeout: 5000 });
    const user2Checkboxes = user2Row.locator('mat-checkbox');
    const user2CheckboxCount = await user2Checkboxes.count();
    expect(user2CheckboxCount).toBeGreaterThan(0);

    const firstUser2Checkbox = user2Checkboxes.first();
    const user2WasChecked = await firstUser2Checkbox.locator('input').isChecked();
    if (!user2WasChecked) {
      await firstUser2Checkbox.click({ force: true });
      await page.waitForTimeout(500);
      await expect(firstUser2Checkbox.locator('input')).toBeChecked({ timeout: 5000 });
    }

    await page.waitForLoadState('domcontentloaded');

    // ── STEP 8: Delete the MSEL copy ─────────────────────────────────────────

    // 13. Navigate back to the MSEL list to delete the copy
    const backBtn = page.locator('a[title="Back to My MSELs"], [title="Back to My MSELs"]').first();
    if (await backBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await backBtn.click();
    } else {
      await page.goto(`${Services.Blueprint.UI}/build`);
    }
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(1000);

    // Delete the MSEL copy
    const deleteMselBtn = page.getByRole('button', { name: `Delete ${MSEL_COPY_NAME}` }).first();
    await expect(deleteMselBtn).toBeVisible({ timeout: 5000 });
    await deleteMselBtn.click();
    const mselYesBtn = page.locator('[role="dialog"] button:has-text("YES")');
    await expect(mselYesBtn).toBeVisible({ timeout: 5000 });
    await mselYesBtn.click();
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(500);

    // expect: MSEL copy is no longer visible
    await expect(page.locator('a, td').filter({ hasText: MSEL_COPY_NAME }).first())
      .not.toBeVisible({ timeout: 5000 });

    // ── STEP 9: Delete the unit ───────────────────────────────────────────────

    // 14. Navigate to Units admin and delete the unit
    await gotoAdminSection(page, 'Units');
    await deleteUnitByName(page, UNIT_NAME);

    // expect: Unit is no longer visible
    await expect(page.locator('table tbody td').filter({ hasText: UNIT_NAME }).first())
      .not.toBeVisible({ timeout: 5000 });

    // ── STEP 10: Delete both test users ──────────────────────────────────────

    // 15. Navigate to Users admin and delete both users
    await gotoAdminSection(page, 'Users');
    await deleteUserByName(page, USER1_NAME);
    await deleteUserByName(page, USER2_NAME);

    // expect: Neither user is visible
    await expect(page.locator('table tbody td').filter({ hasText: USER1_NAME }).first())
      .not.toBeVisible({ timeout: 5000 });
    await expect(page.locator('table tbody td').filter({ hasText: USER2_NAME }).first())
      .not.toBeVisible({ timeout: 5000 });
  });
});
