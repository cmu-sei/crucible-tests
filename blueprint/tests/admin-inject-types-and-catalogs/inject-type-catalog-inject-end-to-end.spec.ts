// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: specs/blueprint-test-plan.md
// seed: tests/seed.spec.ts

import { test, expect, Services } from '../../fixtures';

const INJECT_TYPE_NAME = 'E2E Inject Type Test';
const CATALOG_NAME = 'E2E Catalog Test';
const INJECT_NAME = 'E2E Inject Test';

test.describe('Admin - Inject Types and Catalogs Management', () => {
  test('Inject Type / Catalog / Inject end-to-end flow', async ({ blueprintAuthenticatedPage: page }) => {
    // 1. Authenticate and navigate to the admin section
    await page.goto(`${Services.Blueprint.UI}/admin`);
    await expect(page).toHaveURL(/\/admin/, { timeout: 10000 });

    // Helper: navigate to an admin sidebar section
    const navigateTo = async (section: string) => {
      const navItem = page.locator(`mat-list-item:has-text("${section}")`).first();
      await expect(navItem).toBeVisible({ timeout: 5000 });
      await navItem.click();
      await page.waitForTimeout(500);
    };

    // Helper: confirm and complete a delete-confirmation dialog
    const confirmDelete = async () => {
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
    };

    // Helper: delete all items whose delete button title matches the given pattern
    const deleteAllMatching = async (namePattern: RegExp) => {
      let deleteBtn = page.getByRole('button', { name: namePattern }).first();
      while (await deleteBtn.isVisible().catch(() => false)) {
        await deleteBtn.click();
        await confirmDelete();
        deleteBtn = page.getByRole('button', { name: namePattern }).first();
      }
    };

    // ── Step 0: Pre-cleanup ──────────────────────────────────────────────────
    // Remove any leftovers from a previous run before starting.

    // 2. Delete any leftover test catalogs
    await navigateTo('Catalogs');
    await deleteAllMatching(new RegExp(`^Delete ${CATALOG_NAME}`));

    // 3. Delete any leftover test inject types
    await navigateTo('Inject Types');
    await deleteAllMatching(new RegExp(`^Delete ${INJECT_TYPE_NAME} injectType`));

    // ── Step 1: Create an Inject Type ────────────────────────────────────────
    // 4. Open the "Add new inject type" form and fill in name + description

    const addInjectTypeButton = page.locator(
      'button[title*="Add new inject type"], button[title*="Add"], button[aria-label*="Add"]'
    ).first();
    await expect(addInjectTypeButton).toBeVisible({ timeout: 5000 });
    await addInjectTypeButton.click();
    await page.waitForTimeout(500);

    const injectTypeNameField = page.locator(
      'input[formControlName="name"], input[placeholder*="Name"]'
    ).first();
    await expect(injectTypeNameField).toBeVisible({ timeout: 5000 });
    await injectTypeNameField.fill(INJECT_TYPE_NAME);

    const injectTypeDescField = page.locator(
      'input[formControlName="description"], input[placeholder*="Description"], textarea[placeholder*="Description"]'
    ).first();
    await expect(injectTypeDescField).toBeVisible({ timeout: 5000 });
    await injectTypeDescField.fill('End-to-end test inject type');

    const injectTypeSaveButton = page.locator(
      'button:has-text("Save"), button[type="submit"]'
    ).first();
    await expect(injectTypeSaveButton).toBeEnabled({ timeout: 5000 });
    await injectTypeSaveButton.click();
    await page.waitForTimeout(500);

    // expect: The inject type appears in the list
    await expect(page.locator(`text=${INJECT_TYPE_NAME}`).first()).toBeVisible({ timeout: 10000 });

    // ── Step 2: Create a Catalog ─────────────────────────────────────────────
    // 5. Navigate to Catalogs and create a new catalog linked to the inject type

    await navigateTo('Catalogs');

    const addCatalogButton = page.getByRole('button', { name: 'Add new Catalog' });
    await expect(addCatalogButton).toBeVisible({ timeout: 5000 });
    await addCatalogButton.click();
    await page.waitForTimeout(500);

    const catalogNameField = page.locator('input[placeholder*="Name"]').first();
    await expect(catalogNameField).toBeVisible({ timeout: 5000 });
    await catalogNameField.fill(CATALOG_NAME);

    const catalogDescField = page.locator(
      'input[placeholder*="Description"], textarea[placeholder*="Description"]'
    ).first();
    await expect(catalogDescField).toBeVisible({ timeout: 5000 });
    await catalogDescField.fill('End-to-end test catalog');

    // Select the inject type we just created from the combobox
    const injectTypeCombobox = page.getByRole('combobox', { name: /Inject Type/i }).first();
    await expect(injectTypeCombobox).toBeVisible({ timeout: 5000 });
    await injectTypeCombobox.click();
    await page.waitForTimeout(300);
    // Pick the option that matches our inject type name
    const injectTypeOption = page.locator('mat-option, [role="option"]').filter({ hasText: INJECT_TYPE_NAME }).first();
    const hasExactOption = await injectTypeOption.isVisible({ timeout: 2000 }).catch(() => false);
    if (hasExactOption) {
      await injectTypeOption.click();
    } else {
      // Fallback: pick the first available option
      const firstOption = page.locator('mat-option, [role="option"]').first();
      await expect(firstOption).toBeVisible({ timeout: 5000 });
      await firstOption.click();
    }

    const catalogSaveButton = page.locator('button:has-text("Save"), button[type="submit"]').first();
    await expect(catalogSaveButton).toBeEnabled({ timeout: 5000 });
    await catalogSaveButton.click();
    await page.waitForTimeout(500);

    // expect: The catalog appears in the list with a Delete button
    await expect(
      page.getByRole('button', { name: `Delete ${CATALOG_NAME} catalog` })
    ).toBeVisible({ timeout: 10000 });

    // ── Step 3: Create an Inject under the Catalog ───────────────────────────
    // 6. Expand the catalog row and open the "Injects" expansion panel

    // Click the catalog data row to expand the detail row.
    // Locate the row via the Edit button to avoid matching the header row.
    const editCatalogButton = page.getByRole('button', { name: `Edit ${CATALOG_NAME} catalog` });
    await expect(editCatalogButton).toBeVisible({ timeout: 5000 });
    // Traverse: button -> mat-cell -> mat-row
    const catalogDataRow = editCatalogButton.locator('..').locator('..').locator('..');
    await catalogDataRow.click();
    await page.waitForTimeout(500);

    // The "Injects" expansion panel header renders as an accessible button in the expanded detail row
    // Use getByRole('button') scoped to the detail row to avoid matching hidden panels in other rows
    const injectsPanelHeader = page.getByRole('button', { name: /^Injects$/i }).first();
    await expect(injectsPanelHeader).toBeVisible({ timeout: 5000 });
    await injectsPanelHeader.click();
    await page.waitForTimeout(500);

    // 7. Click the "Add Inject" button inside the Injects panel to open the add menu
    // Use getByRole to target the visible button (avoids matching hidden Add Inject buttons in other rows)
    const addInjectButton = page.getByRole('button', { name: 'Add Inject' }).first();
    await expect(addInjectButton).toBeVisible({ timeout: 5000 });
    await addInjectButton.click();
    await page.waitForTimeout(300);

    // 8. Choose "New Inject" from the dropdown menu
    const newInjectMenuItem = page.locator(
      'button[mat-menu-item]:has-text("New Inject"), button:has-text("New Inject"), [role="menuitem"]:has-text("New Inject")'
    ).first();
    await expect(newInjectMenuItem).toBeVisible({ timeout: 5000 });
    await newInjectMenuItem.click();

    // 9. Wait for the inject creation dialog and fill in the required fields
    await page.waitForSelector('input[title="The Name of the Inject"]', { timeout: 10000 });

    const injectNameInput = page.locator('input[title="The Name of the Inject"]').first();
    await expect(injectNameInput).toBeVisible({ timeout: 5000 });
    await injectNameInput.fill(INJECT_NAME);

    const injectDescInput = page.locator('input[title="The Description of the Inject"]').first();
    await expect(injectDescInput).toBeVisible({ timeout: 5000 });
    await injectDescInput.fill('End-to-end test inject');

    // 10. Save the inject — wait for dialog to close to confirm save succeeded
    const injectDialog = page.locator('mat-dialog-container').first();
    await expect(injectDialog).toBeVisible({ timeout: 5000 });
    const injectSaveButton = injectDialog.getByRole('button', { name: 'Save' }).first();
    await expect(injectSaveButton).toBeEnabled({ timeout: 5000 });
    await injectSaveButton.click();
    // Wait for the dialog to close (confirms save succeeded)
    await expect(injectDialog).not.toBeVisible({ timeout: 10000 });
    await page.waitForTimeout(500);

    // expect: The inject appears in the catalog's Injects panel
    // The panel may have collapsed after saving — re-open it if needed
    // The Injects panel may have collapsed after dialog close — re-open if needed
    await page.waitForTimeout(500);
    const injectsPanelForCatalog = page.locator('mat-expansion-panel').filter({ hasText: 'Injects' }).last();
    const injectTable = injectsPanelForCatalog.locator('app-inject-list table, app-inject-list .scrolling-region').first();
    const isInjectTableVisible = await injectTable.isVisible({ timeout: 1000 }).catch(() => false);
    if (!isInjectTableVisible) {
      const reopenInjectsBtn = page.getByRole('button', { name: /^Injects$/i }).first();
      await expect(reopenInjectsBtn).toBeVisible({ timeout: 5000 });
      await reopenInjectsBtn.click();
      await page.waitForTimeout(800);
    }
    await expect(page.getByRole('cell', { name: INJECT_NAME, exact: true })).toBeVisible({ timeout: 10000 });

    // ── Step 4: Verify inject appears under the Inject Type ──────────────────
    // 11. Navigate to Inject Types and expand the inject type row

    await navigateTo('Inject Types');

    // Click the inject type row to expand its detail panels
    const injectTypeRow = page.locator('mat-row.element-row, mat-row').filter({ hasText: INJECT_TYPE_NAME }).first();
    await expect(injectTypeRow).toBeVisible({ timeout: 5000 });
    await injectTypeRow.click();
    await page.waitForTimeout(500);

    // 12. Open the "Injects" expansion panel within the inject type's detail row
    // expect: The "Injects" expansion panel header is visible after expanding the row
    // Use getByRole('button') to target the visible panel header (renders as button in a11y tree)
    const injectTypeInjectsHeader = page.getByRole('button', { name: /^Injects$/i }).first();
    await expect(injectTypeInjectsHeader).toBeVisible({ timeout: 5000 });
    await injectTypeInjectsHeader.click();
    await page.waitForTimeout(800);

    // expect: The inject we created in the catalog appears in the inject type's Injects section
    await expect(page.getByRole('cell', { name: INJECT_NAME, exact: true })).toBeVisible({ timeout: 10000 });

    // ── Step 5: Delete the inject from the inject type view ──────────────────
    // 13. Click the delete button for the inject within the inject type's Injects section
    // Button title pattern: "Delete <name> inject"
    const deleteInjectButton = page.getByRole('button', {
      name: new RegExp(`^Delete ${INJECT_NAME} inject$`),
    }).first();
    await expect(deleteInjectButton).toBeVisible({ timeout: 5000 });
    await deleteInjectButton.click();
    await confirmDelete();

    // expect: The inject no longer appears in the inject type's Injects section
    await expect(page.getByRole('cell', { name: INJECT_NAME, exact: true })).not.toBeVisible({ timeout: 10000 });

    // ── Step 6: Verify inject is gone from the catalog ───────────────────────
    // 14. Navigate to Catalogs and expand the catalog row

    await navigateTo('Catalogs');

    // Expand the catalog data row
    const editCatalogButton2 = page.getByRole('button', { name: `Edit ${CATALOG_NAME} catalog` });
    await expect(editCatalogButton2).toBeVisible({ timeout: 5000 });
    const catalogDataRow2 = editCatalogButton2.locator('..').locator('..').locator('..');
    await catalogDataRow2.click();
    await page.waitForTimeout(500);

    // 15. Open the "Injects" expansion panel
    // Use getByRole('button') to target the visible panel header (renders as button in a11y tree)
    const catalogInjectsPanelHeader = page.getByRole('button', { name: /^Injects$/i }).first();
    await expect(catalogInjectsPanelHeader).toBeVisible({ timeout: 5000 });
    await catalogInjectsPanelHeader.click();
    await page.waitForTimeout(800);

    // expect: The inject is no longer listed in the catalog's Injects panel
    await expect(page.getByRole('cell', { name: INJECT_NAME, exact: true })).not.toBeVisible({ timeout: 5000 });

    // ── Step 7: Delete the catalog ───────────────────────────────────────────
    // 16. Click the delete button for the catalog and confirm

    // Collapse the expanded row first so the delete button is accessible
    await catalogDataRow2.click();
    await page.waitForTimeout(300);

    const deleteCatalogButton = page.getByRole('button', { name: `Delete ${CATALOG_NAME} catalog` });
    await expect(deleteCatalogButton).toBeVisible({ timeout: 5000 });
    await deleteCatalogButton.click();
    await confirmDelete();

    // expect: The catalog no longer appears in the list
    await expect(
      page.getByRole('button', { name: `Delete ${CATALOG_NAME} catalog` })
    ).not.toBeVisible({ timeout: 10000 });

    // ── Step 8: Delete the inject type ───────────────────────────────────────
    // 17. Navigate to Inject Types and delete the inject type

    await navigateTo('Inject Types');
    await deleteAllMatching(new RegExp(`^Delete ${INJECT_TYPE_NAME} injectType`));

    // expect: The inject type no longer appears in the list
    await expect(page.locator(`text=${INJECT_TYPE_NAME}`).first()).not.toBeVisible({ timeout: 10000 });
  });
});
