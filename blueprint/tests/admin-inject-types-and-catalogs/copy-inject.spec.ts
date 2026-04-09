// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: specs/blueprint-test-plan.md
// seed: tests/seed.spec.ts

import { test, expect, Services } from '../../fixtures';

const INJECT_NAME = 'Copy Test Inject';
const CATALOG_NAME = 'Copy Inject Test Catalog';
const INJECT_TYPE_NAME = 'Copy Inject Test Inject Type';

test.describe('Admin - Inject Types and Catalogs Management', () => {
  test('Copy Inject', async ({ blueprintAuthenticatedPage: page }) => {
    await page.goto(`${Services.Blueprint.UI}/admin`);
    await expect(page).toHaveURL(/\/admin/, { timeout: 10000 });

    // Helper: navigate to a section via the sidebar mat-list-item
    const navigateTo = async (section: string) => {
      const navItem = page.locator(`mat-list-item:has-text("${section}")`).first();
      await expect(navItem).toBeVisible({ timeout: 5000 });
      await navItem.click();
      await expect(
        page.locator(`h1:has-text("${section}"), h2:has-text("${section}"), [class*="title"]:has-text("${section}"), mat-toolbar:has-text("${section}")`).first()
      ).toBeVisible({ timeout: 5000 }).catch(async () => {
        // Fallback: wait for content to settle
        await page.waitForTimeout(500);
      });
    };

    // Helper: delete all catalog rows whose delete button name matches a pattern
    const deleteCatalogsMatching = async (namePattern: RegExp) => {
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

    // Helper: delete all inject type rows whose delete button name matches a pattern
    const deleteInjectTypesMatching = async (namePattern: RegExp) => {
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

    // Helper: expand a catalog row and open the Injects expansion panel
    const expandCatalogInjects = async (catalogName: string) => {
      // 1. Click the catalog row to expand it
      const catalogRow = page.locator('mat-row, tr[mat-row]').filter({ hasText: catalogName }).first();
      await expect(catalogRow).toBeVisible({ timeout: 5000 });
      await catalogRow.click();
      await page.waitForTimeout(500);

      // 2. Open the "Injects" expansion panel within the expanded detail
      const injectsPanel = page.locator('mat-expansion-panel').filter({ hasText: 'Injects' }).first();
      await expect(injectsPanel).toBeVisible({ timeout: 5000 });
      const panelHeader = injectsPanel.locator('mat-expansion-panel-header').first();
      await panelHeader.click();
      await page.waitForTimeout(500);
    };

    // ── Step 0: Pre-cleanup ──────────────────────────────────────────────────

    // 1. Navigate to Catalogs and delete any leftover test catalogs
    await navigateTo('Catalogs');
    await deleteCatalogsMatching(new RegExp(`^Delete ${CATALOG_NAME}`));

    // 2. Navigate to Inject Types and delete any leftover test inject types
    await navigateTo('Inject Types');
    await deleteInjectTypesMatching(new RegExp(`^Delete ${INJECT_TYPE_NAME}`));

    // ── Step 1: Create a prerequisite Inject Type ────────────────────────────

    // 3. Click add button to create a new inject type
    const addInjectTypeButton = page.locator(
      'button[title*="Add"], button[aria-label*="Add"]'
    ).first();
    await expect(addInjectTypeButton).toBeVisible({ timeout: 5000 });
    await addInjectTypeButton.click();
    await page.waitForTimeout(500);

    // 4. Fill in the inject type name
    const injectTypeNameField = page.locator(
      'input[formControlName="name"], input[placeholder*="Name"]'
    ).first();
    await expect(injectTypeNameField).toBeVisible({ timeout: 5000 });
    await injectTypeNameField.fill(INJECT_TYPE_NAME);

    // 5. Fill in the inject type description
    const injectTypeDescField = page.locator(
      'input[formControlName="description"], input[placeholder*="Description"], textarea[placeholder*="Description"]'
    ).first();
    await expect(injectTypeDescField).toBeVisible({ timeout: 5000 });
    await injectTypeDescField.fill('Test inject type for copy inject test');

    // 6. Save the inject type
    const injectTypeSaveButton = page.locator(
      'button:has-text("Save"), button[type="submit"]'
    ).first();
    await expect(injectTypeSaveButton).toBeEnabled({ timeout: 5000 });
    await injectTypeSaveButton.click();

    // expect: The inject type appears in the list
    await expect(page.locator(`text=${INJECT_TYPE_NAME}`).first()).toBeVisible({ timeout: 10000 });

    // ── Step 2: Create a Catalog ─────────────────────────────────────────────

    // 7. Navigate to Catalogs section
    await navigateTo('Catalogs');

    // 8. Click the add catalog button
    const addCatalogButton = page.getByRole('button', { name: 'Add new Catalog' });
    await expect(addCatalogButton).toBeVisible({ timeout: 5000 });
    await addCatalogButton.click();
    await page.waitForTimeout(500);

    // 9. Fill in catalog name
    const catalogNameField = page.locator('input[placeholder*="Name"]').first();
    await expect(catalogNameField).toBeVisible({ timeout: 5000 });
    await catalogNameField.fill(CATALOG_NAME);

    // 10. Fill in catalog description
    const catalogDescField = page.locator(
      'input[placeholder*="Description"], textarea[placeholder*="Description"]'
    ).first();
    await expect(catalogDescField).toBeVisible({ timeout: 5000 });
    await catalogDescField.fill('Test catalog for copy inject test');

    // 11. Select the inject type from the combobox
    const injectTypeCombobox = page.getByRole('combobox', { name: /Inject Type/i }).first();
    await expect(injectTypeCombobox).toBeVisible({ timeout: 5000 });
    await injectTypeCombobox.click();
    await page.waitForTimeout(300);
    const firstOption = page.locator('mat-option, [role="option"]').first();
    await expect(firstOption).toBeVisible({ timeout: 5000 });
    await firstOption.click();

    // 12. Save the catalog
    const catalogSaveButton = page.locator('button:has-text("Save"), button[type="submit"]').first();
    await expect(catalogSaveButton).toBeEnabled({ timeout: 5000 });
    await catalogSaveButton.click();

    // expect: The catalog appears in the list
    await expect(page.locator(`text=${CATALOG_NAME}`).first()).toBeVisible({ timeout: 10000 });

    // ── Step 3: Create an Inject inside the Catalog ──────────────────────────

    // 13. Expand the catalog row and open the Injects panel
    await expandCatalogInjects(CATALOG_NAME);

    // 14. Click the "Add Inject" button (plus icon in the inject list header)
    const addInjectButton = page.locator('button[title="Add Inject"]').first();
    await expect(addInjectButton).toBeVisible({ timeout: 5000 });
    await addInjectButton.click();
    await page.waitForTimeout(300);

    // 15. Choose "New Inject" from the menu
    const newInjectMenuItem = page.locator('button[mat-menu-item]:has-text("New Inject"), button:has-text("New Inject")').first();
    await expect(newInjectMenuItem).toBeVisible({ timeout: 5000 });
    await newInjectMenuItem.click();

    // 16. Wait for the inject create/edit dialog to open
    // Angular Material dialogs render as mat-dialog-container. Use a specific selector for the inject dialog
    // that distinguishes it from the catalog dialog (inject dialog has "Name of the Inject" title attribute)
    await page.waitForSelector('input[title="The Name of the Inject"]', { timeout: 10000 });

    // 17. Fill in inject name using the title attribute for precise targeting
    const nameInput = page.locator('input[title="The Name of the Inject"]').first();
    await expect(nameInput).toBeVisible({ timeout: 5000 });
    await nameInput.fill(INJECT_NAME);

    // 18. Fill in inject description using title attribute (required for Save to enable)
    const descriptionInput = page.locator('input[title="The Description of the Inject"]').first();
    await expect(descriptionInput).toBeVisible({ timeout: 5000 });
    await descriptionInput.fill('Test inject for copy test');

    // 19. Save the inject
    // Scope Save button to dialog to avoid matching unrelated buttons
    const injectDialog = page.locator('mat-dialog-container').first();
    const injectSaveButton = injectDialog.locator('button:has-text("Save")').first();
    await expect(injectSaveButton).toBeEnabled({ timeout: 5000 });
    await injectSaveButton.click();
    // Wait for dialog to close
    await expect(injectDialog).not.toBeVisible({ timeout: 5000 }).catch(() => {});
    await page.waitForTimeout(500);

    // After saving, the dialog closes and the Injects expansion panel may have collapsed.
    // Re-open the Injects panel to verify the inject was created and to interact with it.
    // Helper: ensure the Injects expansion panel is open
    const ensureInjectsPanelOpen = async () => {
      const panel = page.locator('mat-expansion-panel').filter({ hasText: 'Injects' }).first();
      await expect(panel).toBeVisible({ timeout: 5000 });
      const header = panel.locator('mat-expansion-panel-header').first();
      // Wait for panel state to settle after any dialog close
      await page.waitForTimeout(500);
      // Check if the inject list table is already visible (panel is open)
      const injectTable = panel.locator('app-inject-list table, app-inject-list .scrolling-region').first();
      const isTableVisible = await injectTable.isVisible({ timeout: 1000 }).catch(() => false);
      if (!isTableVisible) {
        // Panel is collapsed - click to open it
        await header.click();
        await page.waitForTimeout(800);
      }
    };

    await ensureInjectsPanelOpen();

    // expect: The inject appears in the list
    await expect(page.getByRole('cell', { name: INJECT_NAME, exact: true })).toBeVisible({ timeout: 10000 });

    // Record the count of inject rows before copy
    const injectRows = page.locator('app-inject-list mat-row, app-inject-list tr[mat-row]');
    const initialInjectCount = await injectRows.count();
    expect(initialInjectCount).toBeGreaterThan(0);

    // ── Step 4: Copy the Inject ──────────────────────────────────────────────

    // 19. Click the copy button for the inject
    const copyInjectButton = page.getByRole('button', { name: new RegExp(`^Copy ${INJECT_NAME}`) }).first();
    await expect(copyInjectButton).toBeVisible({ timeout: 5000 });
    await copyInjectButton.click();
    await page.waitForTimeout(500);

    // 20. The "Create an Inject" dialog opens with a pre-filled copy
    await page.waitForSelector('mat-dialog-container', { timeout: 5000 });
    const copyDialog = page.locator('mat-dialog-container').first();
    await expect(copyDialog).toBeVisible({ timeout: 5000 });

    // expect: Dialog contains "Create an Inject" title
    await expect(copyDialog).toContainText('Create', { timeout: 5000 });

    // 21. Save the copy (name and description are pre-filled from the original)
    const copyDialogSaveButton = copyDialog.getByRole('button', { name: 'Save' }).first();
    await expect(copyDialogSaveButton).toBeEnabled({ timeout: 5000 });
    await copyDialogSaveButton.click();
    // Wait for dialog to close
    await expect(copyDialog).not.toBeVisible({ timeout: 5000 }).catch(() => {});
    await page.waitForTimeout(500);

    // ── Step 5: Verify the copy exists ──────────────────────────────────────

    // After saving the copy dialog, the Injects panel may have collapsed again.
    // Re-open it to verify the count and content.
    await ensureInjectsPanelOpen();

    // 22. Verify the inject count increased by 1
    // Use expect with retry to allow for async data reload after copy
    await expect(async () => {
      const newInjectCount = await injectRows.count();
      expect(newInjectCount).toBeGreaterThan(initialInjectCount);
    }).toPass({ timeout: 10000 });

    // 23. Verify the original inject name is still visible (both original and copy)
    await expect(page.locator(`text=${INJECT_NAME}`).first()).toBeVisible({ timeout: 5000 });

    // ── Step 6: Cleanup ──────────────────────────────────────────────────────

    // 24. Delete the test catalog (which also removes its injects associations)
    await deleteCatalogsMatching(new RegExp(`^Delete ${CATALOG_NAME}`));

    // 25. Navigate to Inject Types and delete the test inject type
    await navigateTo('Inject Types');
    await deleteInjectTypesMatching(new RegExp(`^Delete ${INJECT_TYPE_NAME}`));
  });
});
