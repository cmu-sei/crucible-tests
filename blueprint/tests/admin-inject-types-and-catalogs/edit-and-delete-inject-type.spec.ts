// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: specs/blueprint-test-plan.md
// seed: tests/seed.spec.ts

import { test, expect, Services } from '../../fixtures';

const INJECT_TYPE_NAME = 'Edit Delete Inject Type Test';
const INJECT_TYPE_NAME_EDITED = 'Edit Delete Inject Type Test (Edited)';

test.describe('Admin - Inject Types and Catalogs Management', () => {
  test('Edit and Delete Inject Type', async ({ blueprintAuthenticatedPage: page }) => {
    await page.goto(`${Services.Blueprint.UI}/admin`);
    await expect(page).toHaveURL(/\/admin/, { timeout: 10000 });

    // Helper: navigate to a section via the sidebar
    const navigateTo = async (section: string) => {
      const navItem = page.locator(`mat-list-item:has-text("${section}")`).first();
      await expect(navItem).toBeVisible({ timeout: 5000 });
      await navItem.click();
      await page.waitForTimeout(500);
    };

    // Helper: delete all rows whose delete button name matches a pattern
    const deleteAllMatching = async (namePattern: RegExp) => {
      let deleteBtn = page.getByRole('button', { name: namePattern }).first();
      while (await deleteBtn.isVisible().catch(() => false)) {
        await deleteBtn.click();
        const confirmDialog = page.locator(
          '[role="dialog"], .mat-dialog-container, [class*="dialog"]'
        ).first();
        await expect(confirmDialog).toBeVisible({ timeout: 5000 });
        const confirmButton = page.locator(
          'button:has-text("Confirm"), button:has-text("Delete"), button:has-text("Yes"), button:has-text("OK")'
        ).last();
        await confirmButton.click();
        await expect(confirmDialog).not.toBeVisible({ timeout: 5000 }).catch(() => {});
        await page.waitForTimeout(500);
        deleteBtn = page.getByRole('button', { name: namePattern }).first();
      }
    };

    // ── Step 0: Pre-cleanup ──────────────────────────────────────────────────

    // 1. Navigate to Inject Types and delete any leftover test inject types from previous runs
    await navigateTo('Inject Types');
    // Escape parentheses in the edited name for use in regex
    const editedNameEscaped = INJECT_TYPE_NAME_EDITED.replace(/[()]/g, '\\$&');
    await deleteAllMatching(new RegExp(`^Delete ${editedNameEscaped} injectType`));
    await deleteAllMatching(new RegExp(`^Delete ${INJECT_TYPE_NAME} injectType`));

    // ── Step 1: Create a new inject type ────────────────────────────────────

    // 2. Click the add button to open the creation form
    const addInjectTypeButton = page.locator(
      'button[title*="Add"], button[aria-label*="Add"]'
    ).first();
    await expect(addInjectTypeButton).toBeVisible({ timeout: 5000 });
    await addInjectTypeButton.click();
    await page.waitForTimeout(500);

    // 3. Fill in the inject type name
    const nameField = page.locator(
      'input[formControlName="name"], input[placeholder*="Name"]'
    ).first();
    await expect(nameField).toBeVisible({ timeout: 5000 });
    await nameField.fill(INJECT_TYPE_NAME);

    // 4. Fill in the inject type description (required for Save to enable)
    const descField = page.locator(
      'input[formControlName="description"], input[placeholder*="Description"], textarea[placeholder*="Description"]'
    ).first();
    await expect(descField).toBeVisible({ timeout: 5000 });
    await descField.fill('Original description for edit/delete test');

    // 5. Save the inject type
    const saveButton = page.locator(
      'button:has-text("Save"), button[type="submit"]'
    ).first();
    await expect(saveButton).toBeEnabled({ timeout: 5000 });
    await saveButton.click();
    await page.waitForTimeout(500);

    // expect: The inject type appears in the list
    await expect(page.locator(`text=${INJECT_TYPE_NAME}`).first()).toBeVisible({ timeout: 10000 });

    // ── Step 2: Edit the inject type ────────────────────────────────────────

    // 6. Click the Edit button for the inject type we just created
    // Button name format: "Edit <name> injectType"
    const editButton = page.getByRole('button', { name: new RegExp(`^Edit ${INJECT_TYPE_NAME} injectType`) }).first();
    await expect(editButton).toBeVisible({ timeout: 5000 });
    await editButton.click();
    await page.waitForTimeout(500);

    // 7. Update the name in the edit form
    const editNameField = page.locator(
      'input[formControlName="name"], input[placeholder*="Name"]'
    ).first();
    await expect(editNameField).toBeVisible({ timeout: 5000 });
    await editNameField.clear();
    await editNameField.fill(INJECT_TYPE_NAME_EDITED);

    // 8. Update the description in the edit form
    const editDescField = page.locator(
      'input[formControlName="description"], input[placeholder*="Description"], textarea[placeholder*="Description"]'
    ).first();
    await expect(editDescField).toBeVisible({ timeout: 5000 });
    await editDescField.clear();
    await editDescField.fill('Updated description for edit/delete test');

    // 9. Save the edited inject type
    const editSaveButton = page.locator(
      'button:has-text("Save"), button[type="submit"]'
    ).first();
    await expect(editSaveButton).toBeEnabled({ timeout: 5000 });
    await editSaveButton.click();
    await page.waitForTimeout(500);

    // expect: The edited name appears in the list
    await expect(page.locator(`text=${INJECT_TYPE_NAME_EDITED}`).first()).toBeVisible({ timeout: 10000 });

    // ── Step 3: Delete the edited inject type ───────────────────────────────

    // 10. Click the Delete button for the edited inject type
    // Button name format: "Delete <name> injectType"
    const deleteButton = page.getByRole('button', { name: new RegExp(`^Delete ${editedNameEscaped} injectType`) }).first();
    await expect(deleteButton).toBeVisible({ timeout: 5000 });
    await deleteButton.click();

    // 11. Confirm deletion in the dialog
    const confirmDialog = page.locator(
      '[role="dialog"], .mat-dialog-container, [class*="dialog"]'
    ).first();
    await expect(confirmDialog).toBeVisible({ timeout: 5000 });
    const confirmButton = page.locator(
      'button:has-text("Confirm"), button:has-text("Delete"), button:has-text("Yes"), button:has-text("OK")'
    ).last();
    await confirmButton.click();
    await expect(confirmDialog).not.toBeVisible({ timeout: 5000 }).catch(() => {});
    await page.waitForTimeout(500);

    // expect: The deleted inject type no longer appears in the list
    await expect(page.locator(`text=${INJECT_TYPE_NAME_EDITED}`).first()).not.toBeVisible({ timeout: 10000 });
  });
});
