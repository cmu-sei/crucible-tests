// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: specs/blueprint-test-plan.md
// seed: tests/seed.spec.ts

import { test, expect, Services } from '../../fixtures';
import { getBlueprintToken, tempBlueprintName } from '../../test-helpers';

test.describe('Admin - Inject Types and Catalogs Management', () => {
  // Unique per run: two concurrent runs (or a leaked row from an interrupted prior run)
  // can no longer collide, and the teardown purge auto-sweeps by the tempBlueprintName
  // shape rather than needing a name-based pre-cleanup pass.
  let CATALOG_NAME: string;
  let INJECT_TYPE_NAME: string;
  let UNIT_NAME: string;
  let UNIT_SHORT_NAME: string;
  let INJECT_NAME: string;

  test.beforeEach(() => {
    CATALOG_NAME = tempBlueprintName('CreateCat');
    INJECT_TYPE_NAME = tempBlueprintName('CreateCatIT');
    UNIT_NAME = tempBlueprintName('CreateCatUnit');
    UNIT_SHORT_NAME = UNIT_NAME.slice(-8);
    INJECT_NAME = tempBlueprintName('CreateCatInj');
  });

  // Cleanup runs in afterEach (not inline at the end of the test body) so a mid-test
  // failure still deletes what this test created. Catalogs are deleted before inject
  // types: deleting an inject type CASCADE-DELETES every catalog that still references
  // it, so ordering it the other way risks either a no-op or a race against in-flight
  // assertions in a genuinely mid-test failure.
  test.afterEach(async () => {
    const token = await getBlueprintToken();
    const headers = { Authorization: `Bearer ${token}` };

    for (const [endpoint, name] of [
      ['/api/catalogs', CATALOG_NAME],
      ['/api/injectTypes', INJECT_TYPE_NAME],
      ['/api/units', UNIT_NAME],
    ] as const) {
      const response = await fetch(`${Services.Blueprint.API}${endpoint}`, { headers });
      if (!response.ok) {
        continue;
      }

      for (const record of (await response.json()) as Array<{ id: string; name: string }>) {
        if (record.name === name) {
          await fetch(`${Services.Blueprint.API}${endpoint}/${record.id}`, {
            method: 'DELETE',
            headers,
          });
        }
      }
    }
  });

  test('Create Catalog', async ({ blueprintAuthenticatedPage: page }) => {
    await page.goto(`${Services.Blueprint.UI}/admin`);
    await expect(page).toHaveURL(/\/admin/, { timeout: 10000 });

    // Helper: navigate to a section via the sidebar
    const navigateTo = async (section: string) => {
      const navItem = page.locator(`mat-list-item:has-text("${section}")`).first();
      await expect(navItem).toBeVisible({ timeout: 5000 });
      await navItem.click();
      await expect(
        page.locator(`h1:has-text("${section}"), h2:has-text("${section}"), [class*="title"]:has-text("${section}"), mat-toolbar:has-text("${section}")`).first()
      ).toBeVisible({ timeout: 5000 });
    };

    // ── Step 1: Create a prerequisite Inject Type ────────────────────────────

    await navigateTo('Inject Types');

    const addInjectTypeButton = page.locator(
      'button[title*="Add"], button[aria-label*="Add"]'
    ).first();
    await expect(addInjectTypeButton).toBeVisible({ timeout: 5000 });
    await addInjectTypeButton.click();

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

    await expect(page.locator(`text=${INJECT_TYPE_NAME}`).first()).toBeVisible({ timeout: 10000 });

    // ── Step 2: Create Unit ──────────────────────────────────────────────────

    await navigateTo('Units');

    const addUnitButton = page.locator(
      'button[title*="Add"], button[aria-label*="Add"]'
    ).first();
    await expect(addUnitButton).toBeVisible({ timeout: 5000 });
    await addUnitButton.click();

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

    await expect(page.locator(`text=${UNIT_NAME}`).first()).toBeVisible({ timeout: 10000 });

    // ── Step 3: Create Catalog ───────────────────────────────────────────────

    await navigateTo('Catalogs');

    const addCatalogButton = page.getByRole('button', { name: 'Add new Catalog' });
    await expect(addCatalogButton).toBeVisible({ timeout: 5000 });
    await addCatalogButton.click();

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
    const injectTypeOption = page
      .locator('mat-option, [role="option"]')
      .filter({ hasText: INJECT_TYPE_NAME });
    await expect(injectTypeOption).toBeVisible({ timeout: 5000 });
    await injectTypeOption.click();

    const saveButton = page.locator('button:has-text("Save"), button[type="submit"]').first();
    await expect(saveButton).toBeEnabled({ timeout: 5000 });
    await saveButton.click();

    // ── Step 4: Verify catalog created ──────────────────────────────────────

    // Confirm the catalog row is present by checking for its Delete button
    await expect(
      page.getByRole('button', { name: `Delete ${CATALOG_NAME} catalog` })
    ).toBeVisible({ timeout: 5000 });

    // Helper: the detail row rendered directly below a given data row once expanded.
    const detailRowFor = (dataRow: ReturnType<typeof page.locator>) =>
      dataRow.locator('xpath=following-sibling::mat-row[contains(@class, "detail-row")][1]');

    // Helper: ensure this spec's catalog row is expanded, returning its (freshly
    // resolved) detail row.
    //
    // Deliberately idempotent/re-runnable rather than a single click-and-hope:
    // AdminCatalogListComponent's mat-table has no trackBy, and every catalog/inject-
    // type/inject/unit mutation on the shared admin stack broadcasts over SignalR to
    // every open admin session (Blueprint.Api Hubs/MainHub.cs AdminDataGroup). A sibling
    // spec's unrelated mutation running concurrently at --workers 2 causes a full-table
    // re-render that destroys and recreates every detail row's expansion panels —
    // silently re-collapsing an already-opened panel or replacing a button the test is
    // about to click. Callers wrap the surrounding action in `toPass` so a re-render
    // landing mid-sequence self-heals instead of failing the test.
    const ensureCatalogRowExpanded = async () => {
      const catalogRow = page
        .getByRole('button', { name: `Edit ${CATALOG_NAME} catalog` })
        .locator('xpath=ancestor::mat-row[1]');
      await expect(catalogRow).toBeVisible({ timeout: 3000 });
      let detailRow = detailRowFor(catalogRow);
      if (!(await detailRow.isVisible().catch(() => false))) {
        await catalogRow.click({ timeout: 3000 });
        detailRow = detailRowFor(catalogRow);
        await expect(detailRow).toBeVisible({ timeout: 3000 });
      }
      return { catalogRow, detailRow };
    };

    // ── Step 5/6/7: Expand the catalog row, open "Units with access" → "Add a Unit",
    // and add the unit to the catalog. Retried as a unit for the concurrent-re-render
    // reason above.
    await expect(async () => {
      const { detailRow } = await ensureCatalogRowExpanded();

      const unitsWithAccessPanel = detailRow.getByRole('button', { name: 'Units with access' });
      await expect(unitsWithAccessPanel).toBeVisible({ timeout: 3000 });
      await unitsWithAccessPanel.click({ timeout: 3000 });

      // "Add a Unit" is a sub-panel inside "Units with access". Expand it to see
      // available units.
      const addAUnitPanel = detailRow.getByRole('button', { name: 'Add a Unit' });
      await expect(addAUnitPanel).toBeVisible({ timeout: 3000 });
      await addAUnitPanel.click({ timeout: 3000 });

      // Click the "Add <SHORT_NAME> to this catalog" button for our test unit
      const catalogUnits = detailRow.locator('app-catalog-units');
      const addUnitToCatalogButton = catalogUnits.getByRole('button', {
        name: `Add ${UNIT_SHORT_NAME} to this catalog`,
      });
      await expect(addUnitToCatalogButton).toBeVisible({ timeout: 3000 });
      await addUnitToCatalogButton.click({ timeout: 3000 });

      // Verify the unit now appears in the "Units with access" list: after adding, a
      // "Remove <SHORT_NAME> from this catalog" button appears.
      await expect(
        catalogUnits.getByRole('button', { name: `Remove ${UNIT_SHORT_NAME} from this catalog` })
      ).toBeVisible({ timeout: 3000 });
    }).toPass({ timeout: 20000 });

    // ── Step 8: Expand "Injects" section and add an inject to the catalog ────

    // Click "Add Inject" → "New Inject" and wait for the create dialog. Retried as a
    // unit for the concurrent-re-render reason above.
    await expect(async () => {
      const { detailRow } = await ensureCatalogRowExpanded();
      const injectsPanel = detailRow.getByRole('button', { name: 'Injects' });
      await expect(injectsPanel).toBeVisible({ timeout: 3000 });
      if (!(await detailRow.locator('app-inject-list table').isVisible().catch(() => false))) {
        await injectsPanel.click({ timeout: 3000 });
      }
      const injectList = detailRow.locator('app-inject-list');
      const addInjectButton = injectList.getByRole('button', { name: 'Add Inject' });
      await expect(addInjectButton).toBeVisible({ timeout: 3000 });
      await addInjectButton.click({ timeout: 3000 });

      const newInjectMenuItem = page.locator('button[mat-menu-item]:has-text("New Inject"), button.mat-menu-item:has-text("New Inject"), [role="menuitem"]:has-text("New Inject")').first();
      await expect(newInjectMenuItem).toBeVisible({ timeout: 3000 });
      await newInjectMenuItem.click({ timeout: 3000 });

      await expect(page.locator('input[title="The Name of the Inject"]')).toBeVisible({ timeout: 3000 });
    }).toPass({ timeout: 20000 });

    // Only one dialog is open at a time, but scope to it explicitly (via the inject
    // dialog's own "title" attributes, which uniquely identify its fields) rather than
    // a positional .last() against the whole page.
    const injectDialog = page.locator('mat-dialog-container').filter({ hasText: 'an Inject' });
    await expect(injectDialog).toBeVisible({ timeout: 5000 });

    // Fill in the inject name
    const injectNameField = injectDialog.locator('input[title="The Name of the Inject"]');
    await expect(injectNameField).toBeVisible({ timeout: 5000 });
    await injectNameField.fill(INJECT_NAME);

    // Fill in the inject description
    const injectDescField = injectDialog.locator('input[title="The Description of the Inject"]');
    await expect(injectDescField).toBeVisible({ timeout: 5000 });
    await injectDescField.fill('Test inject description');

    // Save the inject
    const injectSaveButton = injectDialog.getByRole('button', { name: 'Save' });
    await expect(injectSaveButton).toBeEnabled({ timeout: 5000 });
    await injectSaveButton.click();
    await expect(injectDialog).not.toBeVisible({ timeout: 15000 });

    // Saving an inject collapses this panel (and a concurrent re-render may have
    // collapsed the whole row) — re-ensure it's open, retried for the same reason as above.
    await expect(async () => {
      const { detailRow } = await ensureCatalogRowExpanded();
      const injectList = detailRow.locator('app-inject-list');
      if (!(await injectList.locator('table').isVisible().catch(() => false))) {
        const injectsPanel = detailRow.getByRole('button', { name: 'Injects' });
        await expect(injectsPanel).toBeVisible({ timeout: 3000 });
        await injectsPanel.click({ timeout: 3000 });
        await expect(injectList.locator('table')).toBeVisible({ timeout: 3000 });
      }
      // Verify the inject appears in the Injects list
      await expect(injectList.getByRole('cell', { name: INJECT_NAME, exact: true })).toBeVisible({
        timeout: 3000,
      });
    }).toPass({ timeout: 20000 });

    // Cleanup happens in afterEach (via the API) so a mid-test failure still cleans up.
  });
});
