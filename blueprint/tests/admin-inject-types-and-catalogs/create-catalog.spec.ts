// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: specs/blueprint-test-plan.md
// seed: tests/seed.spec.ts

import { test, expect, Services } from '../../fixtures';

const CATALOG_NAME = 'Create Catalog Test';
const INJECT_TYPE_NAME = 'Create Catalog Test Inject Type';
const UNIT_NAME = 'Create Catalog Test Unit';
const UNIT_SHORT_NAME = 'CCTU';
const INJECT_NAME = 'Create Catalog Test Inject';

test.describe('Admin - Inject Types and Catalogs Management', () => {
  test('Create Catalog', async ({ blueprintAuthenticatedPage: page }) => {
    await page.goto(`${Services.Blueprint.UI}/admin`);

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
        await page.waitForTimeout(500);
        deleteBtn = page.getByRole('button', { name: namePattern }).first();
      }
    };

    // ── Step 0: Pre-cleanup ──────────────────────────────────────────────────

    await navigateTo('Catalogs');
    await deleteAllMatching(new RegExp(`^Delete ${CATALOG_NAME}`));

    await navigateTo('Inject Types');
    await deleteAllMatching(new RegExp(`^Delete ${INJECT_TYPE_NAME}`));

    await navigateTo('Units');
    await deleteAllMatching(new RegExp(`^Delete ${UNIT_NAME}`));

    // ── Step 1: Create a prerequisite Inject Type ────────────────────────────

    await navigateTo('Inject Types');

    const addInjectTypeButton = page.locator(
      'button[title*="Add"], button[aria-label*="Add"]'
    ).first();
    await expect(addInjectTypeButton).toBeVisible({ timeout: 5000 });
    await addInjectTypeButton.click();
    await page.waitForTimeout(500);

    const injectTypeNameField = page.locator(
      'input[formControlName="name"], input[placeholder*="Name"]'
    ).first();
    await expect(injectTypeNameField).toBeVisible({ timeout: 5000 });
    await injectTypeNameField.fill(INJECT_TYPE_NAME);

    // Description is also required for the Save button to become enabled
    const injectTypeDescField = page.locator(
      'input[formControlName="description"], input[placeholder*="Description"], textarea[placeholder*="Description"]'
    ).first();
    await expect(injectTypeDescField).toBeVisible({ timeout: 5000 });
    await injectTypeDescField.fill('Test inject type description');

    const injectTypeSaveButton = page.locator(
      'button:has-text("Save"), button[type="submit"]'
    ).first();
    await expect(injectTypeSaveButton).toBeEnabled({ timeout: 5000 });
    await injectTypeSaveButton.click();
    await page.waitForTimeout(500);

    await expect(page.locator(`text=${INJECT_TYPE_NAME}`).first()).toBeVisible({ timeout: 5000 });

    // ── Step 2: Create Unit ──────────────────────────────────────────────────

    await navigateTo('Units');

    const addUnitButton = page.locator(
      'button[title*="Add"], button[aria-label*="Add"]'
    ).first();
    await expect(addUnitButton).toBeVisible({ timeout: 5000 });
    await addUnitButton.click();
    await page.waitForTimeout(500);

    const unitNameField = page.locator('input[placeholder*="Name (required)"]').first();
    await expect(unitNameField).toBeVisible({ timeout: 5000 });
    await unitNameField.fill(UNIT_NAME);

    const unitShortNameField = page.locator('input[placeholder*="Short Name"]').first();
    await expect(unitShortNameField).toBeVisible({ timeout: 5000 });
    await unitShortNameField.fill(UNIT_SHORT_NAME);

    const unitSaveButton = page.locator(
      'button:has-text("Save"), button[type="submit"]'
    ).first();
    await expect(unitSaveButton).toBeEnabled({ timeout: 5000 });
    await unitSaveButton.click();
    await page.waitForTimeout(500);

    await expect(page.locator(`text=${UNIT_NAME}`).first()).toBeVisible({ timeout: 5000 });

    // ── Step 3: Create Catalog ───────────────────────────────────────────────

    await navigateTo('Catalogs');

    const addCatalogButton = page.getByRole('button', { name: 'Add new Catalog' });
    await expect(addCatalogButton).toBeVisible({ timeout: 5000 });
    await addCatalogButton.click();
    await page.waitForTimeout(500);

    const nameField = page.locator('input[placeholder*="Name"]').first();
    await expect(nameField).toBeVisible({ timeout: 5000 });
    await nameField.fill(CATALOG_NAME);

    const descField = page.locator(
      'input[placeholder*="Description"], textarea[placeholder*="Description"]'
    ).first();
    await expect(descField).toBeVisible({ timeout: 5000 });
    await descField.fill('Test catalog description');

    const injectTypeCombobox = page.getByRole('combobox', { name: /Inject Type/i }).first();
    await expect(injectTypeCombobox).toBeVisible({ timeout: 5000 });
    await injectTypeCombobox.click();
    await page.waitForTimeout(300);
    const firstOption = page.locator('mat-option, [role="option"]').first();
    await expect(firstOption).toBeVisible({ timeout: 5000 });
    await firstOption.click();

    const saveButton = page.locator('button:has-text("Save"), button[type="submit"]').first();
    await expect(saveButton).toBeEnabled({ timeout: 5000 });
    await saveButton.click();
    await page.waitForTimeout(500);

    // ── Step 4: Verify catalog created ──────────────────────────────────────

    // Confirm the catalog row is present by checking for its Delete button
    await expect(
      page.getByRole('button', { name: `Delete ${CATALOG_NAME} catalog` })
    ).toBeVisible({ timeout: 5000 });

    // ── Step 5: Expand the catalog row ──────────────────────────────────────

    // Click the catalog data row to expand it (reveals the detail row with expansion panels).
    // We anchor to the Edit button to locate the correct row, then click the row itself.
    const editCatalogButton = page.getByRole('button', { name: `Edit ${CATALOG_NAME} catalog` });
    await expect(editCatalogButton).toBeVisible({ timeout: 5000 });
    // Traverse up three levels: button -> mat-cell -> mat-row
    const catalogDataRow = editCatalogButton.locator('..').locator('..').locator('..');
    await catalogDataRow.click();
    await page.waitForTimeout(500);

    // ── Step 6: Expand "Units with access" section ───────────────────────────

    // The detail row for our catalog is the last in the list; its expansion panels
    // become visible after clicking the data row. Use .last() to target our catalog's panel.
    const unitsWithAccessPanel = page.locator('mat-expansion-panel-header').filter({ hasText: /Units with access/i }).last();
    await expect(unitsWithAccessPanel).toBeVisible({ timeout: 5000 });
    await unitsWithAccessPanel.click();
    await page.waitForTimeout(500);

    // ── Step 7: Expand "Add a Unit" and add the unit to the catalog ──────────

    // "Add a Unit" is a sub-panel inside "Units with access". Expand it to see available units.
    const addAUnitPanel = page.locator('mat-expansion-panel-header').filter({ hasText: /Add a Unit/i }).last();
    await expect(addAUnitPanel).toBeVisible({ timeout: 5000 });
    await addAUnitPanel.click();
    await page.waitForTimeout(500);

    // Click the "Add <SHORT_NAME> to this catalog" button for our test unit
    const addUnitToCatalogButton = page.getByRole('button', {
      name: new RegExp(`Add ${UNIT_SHORT_NAME} to this catalog`, 'i'),
    }).first();
    await expect(addUnitToCatalogButton).toBeVisible({ timeout: 5000 });
    await addUnitToCatalogButton.click();
    await page.waitForTimeout(500);

    // Verify the unit now appears in the "Units with access" list:
    // after adding, a "Remove <SHORT_NAME> from this catalog" button appears
    await expect(
      page.getByRole('button', { name: new RegExp(`Remove ${UNIT_SHORT_NAME} from this catalog`, 'i') }).first()
    ).toBeVisible({ timeout: 5000 });

    // ── Step 8: Expand "Injects" section and add an inject to the catalog ────

    // The "Injects" expansion panel is in the same detail row as "Units with access".
    // Use .last() to target our catalog's panel (the most recently expanded row).
    const injectsPanel = page.locator('mat-expansion-panel-header').filter({ hasText: /^Injects$/i }).last();
    await expect(injectsPanel).toBeVisible({ timeout: 5000 });
    await injectsPanel.click();
    await page.waitForTimeout(500);

    // Click the "Add Inject" button (plus-circle icon) to open the add menu
    const addInjectButton = page.locator('button[title="Add Inject"]').last();
    await expect(addInjectButton).toBeVisible({ timeout: 5000 });
    await addInjectButton.click();
    await page.waitForTimeout(300);

    // Click "New Inject" from the dropdown menu
    const newInjectMenuItem = page.locator('button[mat-menu-item]:has-text("New Inject"), button.mat-menu-item:has-text("New Inject"), [role="menuitem"]:has-text("New Inject")').first();
    await expect(newInjectMenuItem).toBeVisible({ timeout: 5000 });
    await newInjectMenuItem.click();
    await page.waitForTimeout(500);

    // Fill in the inject name
    const injectNameField = page.locator('input[placeholder="Name (required)"]').last();
    await expect(injectNameField).toBeVisible({ timeout: 5000 });
    await injectNameField.fill(INJECT_NAME);

    // Fill in the inject description
    const injectDescField = page.locator('input[placeholder="Description (required)"]').last();
    await expect(injectDescField).toBeVisible({ timeout: 5000 });
    await injectDescField.fill('Test inject description');

    // Save the inject
    const injectSaveButton = page.locator('button:has-text("Save")').last();
    await expect(injectSaveButton).toBeEnabled({ timeout: 5000 });
    await injectSaveButton.click();
    await page.waitForTimeout(500);

    // Verify the inject appears in the Injects list
    await expect(page.locator(`text=${INJECT_NAME}`).first()).toBeVisible({ timeout: 5000 });

    // ── Step 9: Cleanup ──────────────────────────────────────────────────────

    await deleteAllMatching(new RegExp(`^Delete ${CATALOG_NAME}`));

    await navigateTo('Inject Types');
    await deleteAllMatching(new RegExp(`^Delete ${INJECT_TYPE_NAME}`));

    await navigateTo('Units');
    await deleteAllMatching(new RegExp(`^Delete ${UNIT_NAME}`));
  });
});
