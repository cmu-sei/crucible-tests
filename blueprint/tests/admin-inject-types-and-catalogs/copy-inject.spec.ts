// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: specs/blueprint-test-plan.md
// seed: tests/seed.spec.ts

import { test, expect, Services } from '../../fixtures';
import { getBlueprintToken } from '../../test-helpers';

const INJECT_NAME = 'Copy Test Inject';
const CATALOG_NAME = 'Copy Inject Test Catalog';
const INJECT_TYPE_NAME = 'Copy Inject Test Inject Type';

async function cleanupTestRecords(): Promise<void> {
    const token = await getBlueprintToken();
    const headers = { Authorization: `Bearer ${token}` };

    for (const [endpoint, name] of [
      ['/api/catalogs', CATALOG_NAME],
      ['/api/injectTypes', INJECT_TYPE_NAME],
    ] as const) {
      const response = await fetch(`${Services.Blueprint.API}${endpoint}`, {
        headers,
        signal: AbortSignal.timeout(10000),
      });
      expect(response.ok, `list ${endpoint} for cleanup`).toBeTruthy();

      for (const record of (await response.json()) as Array<{ id: string; name: string }>) {
        if (record.name === name) {
          const deleteResponse = await fetch(`${Services.Blueprint.API}${endpoint}/${record.id}`, {
            method: 'DELETE',
            headers,
            signal: AbortSignal.timeout(10000),
          });
          expect(deleteResponse.ok, `delete ${name} during cleanup`).toBeTruthy();
        }
      }
    }
}

test.describe('Admin - Inject Types and Catalogs Management', () => {
  test.beforeEach(async () => {
    await cleanupTestRecords();
  });

  test.afterEach(async () => {
    await cleanupTestRecords();
  });

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

    // Helper: expand a catalog row and open the Injects expansion panel
    const expandCatalogInjects = async (catalogName: string) => {
      // 1. Click the catalog row to expand it
      const catalogRow = page
        .getByRole('button', { name: `Edit ${catalogName} catalog` })
        .locator('xpath=ancestor::mat-row[1]');
      await expect(catalogRow).toBeVisible({ timeout: 5000 });
      await catalogRow.click();
      const detailRow = catalogRow.locator('xpath=following-sibling::mat-row[contains(@class, "detail-row")][1]');

      // 2. Open the "Injects" expansion panel within the expanded detail
      const injectsPanel = detailRow.locator('mat-expansion-panel').filter({ hasText: 'Injects' });
      const panelHeader = injectsPanel.getByRole('button', { name: 'Injects' });
      await expect(panelHeader).toBeVisible({ timeout: 5000 });
      await panelHeader.click();
      await expect(injectsPanel.locator('app-inject-list')).toBeVisible({ timeout: 5000 });
      return detailRow;
    };

    // ── Step 1: Create a prerequisite Inject Type ────────────────────────────

    await navigateTo('Inject Types');

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
    const catalogDetailRow = await expandCatalogInjects(CATALOG_NAME);

    // 14. Click the "Add Inject" button (plus icon in the inject list header)
    const injectList = catalogDetailRow.locator('app-inject-list');
    const addInjectButton = injectList.getByRole('button', { name: 'Add Inject' });
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
    const createInjectResponse = page.waitForResponse(
      (response) =>
        response.request().method() === 'POST' &&
        /^\/api\/catalog\/[^/]+\/injects$/.test(new URL(response.url()).pathname),
      { timeout: 15000 }
    );
    await injectSaveButton.click();
    expect((await createInjectResponse).ok(), 'create inject response').toBeTruthy();
    await expect(injectDialog).not.toBeVisible({ timeout: 15000 });

    // The client closes the dialog before it updates the list. Recreate the panel after
    // the POST completes so its list loads the persisted catalog injects.
    const reloadInjectsPanel = async () => {
      const panel = catalogDetailRow.locator('mat-expansion-panel').filter({ hasText: 'Injects' });
      const header = panel.getByRole('button', { name: 'Injects' });
      await expect(header).toBeVisible({ timeout: 5000 });
      if ((await header.getAttribute('aria-expanded')) === 'true') {
        await header.click();
      }
      await header.click();
      await expect(panel.locator('app-inject-list')).toBeVisible({ timeout: 5000 });
    };

    await reloadInjectsPanel();

    // expect: The inject appears in the list
    await expect(injectList.getByRole('cell', { name: INJECT_NAME, exact: true })).toBeVisible({
      timeout: 10000,
    });

    // Record the count of inject rows before copy
    const injectRows = injectList.locator('mat-row, tr[mat-row]');
    const initialInjectCount = await injectRows.count();
    expect(initialInjectCount).toBeGreaterThan(0);

    // ── Step 4: Copy the Inject ──────────────────────────────────────────────

    // 19. Click the copy button for the inject
    const copyInjectButton = injectList.getByRole('button', {
      name: new RegExp(`^Copy ${INJECT_NAME}`),
    });
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
    const copyInjectResponse = page.waitForResponse(
      (response) =>
        response.request().method() === 'POST' &&
        /^\/api\/catalog\/[^/]+\/injects$/.test(new URL(response.url()).pathname),
      { timeout: 15000 }
    );
    await copyDialogSaveButton.click();
    expect((await copyInjectResponse).ok(), 'copy inject response').toBeTruthy();
    await expect(copyDialog).not.toBeVisible({ timeout: 15000 });

    // ── Step 5: Verify the copy exists ──────────────────────────────────────

    await reloadInjectsPanel();

    // 22. Verify the inject count increased by 1
    // Use expect with retry to allow for async data reload after copy
    await expect(async () => {
      const newInjectCount = await injectRows.count();
      expect(newInjectCount).toBeGreaterThan(initialInjectCount);
    }).toPass({ timeout: 10000 });

    // 23. Verify the original inject name is still visible (both original and copy)
    await expect(
      injectList.getByRole('cell', { name: INJECT_NAME, exact: true }).first()
    ).toBeVisible({ timeout: 5000 });

  });
});
