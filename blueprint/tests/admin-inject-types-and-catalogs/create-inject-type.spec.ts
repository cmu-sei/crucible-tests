// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: specs/blueprint-test-plan.md
// seed: tests/seed.spec.ts

import { test, expect, Services } from '../../fixtures';
import { getBlueprintToken, tempBlueprintName } from '../../test-helpers';

test.describe('Admin - Inject Types and Catalogs Management', () => {
  // Unique per run so concurrent runs / leftovers from an interrupted prior run never
  // collide, and the teardown purge auto-sweeps by the tempBlueprintName shape.
  let INJECT_TYPE_NAME: string;
  let DATA_FIELD_NAME: string;

  test.beforeEach(() => {
    INJECT_TYPE_NAME = tempBlueprintName('CreateIT');
    DATA_FIELD_NAME = tempBlueprintName('CreateITField');
  });

  // Cleanup runs in afterEach (not inline at the end of the test body) so a mid-test
  // failure still deletes what this test created. DataFields belong to the InjectType
  // and are cascade-deleted with it (Blueprint.Api.Data DataFieldEntityConfiguration:
  // InjectType -> DataFields is DeleteBehavior.Cascade), so deleting the inject type is
  // sufficient cleanup for both.
  test.afterEach(async () => {
    const token = await getBlueprintToken();
    const headers = { Authorization: `Bearer ${token}` };

    const response = await fetch(`${Services.Blueprint.API}/api/injectTypes`, { headers });
    if (!response.ok) return;

    for (const record of (await response.json()) as Array<{ id: string; name: string }>) {
      if (record.name === INJECT_TYPE_NAME) {
        await fetch(`${Services.Blueprint.API}/api/injectTypes/${record.id}`, {
          method: 'DELETE',
          headers,
        });
      }
    }
  });

  test('Create Inject Type', async ({ blueprintAuthenticatedPage: page }) => {
    await page.goto(`${Services.Blueprint.UI}/admin`);
    await expect(page.locator('mat-list-item').first()).toBeVisible({ timeout: 10000 });

    // Helper: navigate to a section via the sidebar mat-list-item
    const navigateTo = async (section: string) => {
      const navItem = page.locator(`mat-list-item:has-text("${section}")`).first();
      await expect(navItem).toBeVisible({ timeout: 5000 });
      await navItem.click();
      await expect(page.locator('mat-toolbar, [class*="topbar"], table').first()).toBeVisible({ timeout: 5000 });
    };

    await navigateTo('Inject Types');

    // ── Step 1: Create the Inject Type ───────────────────────────────────────

    const addButton = page.locator(
      'button[title*="Add"], button[aria-label*="Add"]'
    ).first();
    await expect(addButton).toBeVisible({ timeout: 5000 });
    await addButton.click();

    // Fill in name
    const nameField = page.locator(
      'input[formControlName="name"], input[placeholder*="Name"]'
    ).first();
    await expect(nameField).toBeVisible({ timeout: 5000 });
    await nameField.fill(INJECT_TYPE_NAME);

    // Fill in description if visible
    const descField = page.locator(
      'textarea[formControlName="description"], textarea[placeholder*="Description"], input[placeholder*="Description"]'
    ).first();
    const descVisible = await descField.isVisible({ timeout: 2000 }).catch(() => false);
    if (descVisible) {
      await descField.fill('Test inject type description');
    }

    // Click 'Save'
    const saveButton = page.locator(
      'button:has-text("Save"), button[type="submit"]'
    ).first();
    await expect(saveButton).toBeEnabled({ timeout: 5000 });
    await saveButton.click();

    // ── Step 2: Verify ───────────────────────────────────────────────────────

    await expect(page.locator(`text=${INJECT_TYPE_NAME}`).first()).toBeVisible({ timeout: 5000 });

    // ── Step 3: Expand the inject type row ───────────────────────────────────

    // Filter the Inject Types list down to this spec's own row via the section's own
    // Search box. AdminInjectTypesComponent.sortChanged() rebuilds its whole
    // MatTableDataSource from freshly-spread object copies on every emission of
    // injectTypeQuery.selectAll() — which re-emits on ANY inject type mutation
    // anywhere on the shared admin stack (a concurrently-running sibling spec's
    // create/update/delete), not just this row's. With no trackBy on the mat-table,
    // that tears down and recreates every row, including this one's expanded
    // DataFields panel and its "Add data Field" menu, mid-click. Filtering to a single
    // matching row keeps the table small and reduces (though doesn't eliminate, since
    // the filtered row itself can still re-render) exposure to this churn; the retry
    // wrapper below is what actually makes the click-through-menu sequence resilient
    // to a re-render landing mid-sequence.
    const searchBox = page.locator('input[placeholder*="Search"]').first();
    await expect(searchBox).toBeVisible({ timeout: 5000 });
    await searchBox.fill(INJECT_TYPE_NAME);

    // Click the inject type row to reveal detail panels
    const injectTypeRow = page.locator('mat-row.element-row').filter({ hasText: INJECT_TYPE_NAME });
    await expect(injectTypeRow).toBeVisible({ timeout: 5000 });
    await injectTypeRow.click();

    // Wait for the detail row to appear with the DataFields expansion panel header
    const dataFieldsHeader = page.locator('mat-expansion-panel-header').filter({ hasText: 'DataFields' });
    await expect(dataFieldsHeader).toBeVisible({ timeout: 5000 });

    // ── Step 4: Expand the "DataFields" section ──────────────────────────────

    await dataFieldsHeader.click();

    // Wait for the "Add data Field" button to become visible (confirms the panel is fully expanded)
    const addDataFieldButton = page.getByRole('button', { name: 'Add data Field' });
    await expect(addDataFieldButton).toBeVisible({ timeout: 5000 });

    // ── Step 5: Add a data field ─────────────────────────────────────────────

    // Click "Add data Field" → "New Data Field" and wait for the create dialog. Retried
    // as a unit: a concurrent sibling spec's inject-type mutation can force a re-render
    // that detaches the button or menu item mid-click (see note above) — retrying the
    // whole sequence lets that self-heal instead of failing the test. Each step checks
    // whether it's already done before acting, so a retry can't toggle an
    // already-open menu/dialog back closed.
    const addDataFieldDialog = page.locator('[role="dialog"]').filter({ hasText: 'Add a Data Field' });
    await expect(async () => {
      if (!(await addDataFieldDialog.isVisible().catch(() => false))) {
        const newDataFieldMenuItem = page.locator('[role="menuitem"]').filter({ hasText: 'New Data Field' });
        if (!(await newDataFieldMenuItem.isVisible().catch(() => false))) {
          await addDataFieldButton.click({ timeout: 3000 });
          await expect(newDataFieldMenuItem).toBeVisible({ timeout: 3000 });
        }
        await newDataFieldMenuItem.click({ timeout: 3000 });
        await expect(addDataFieldDialog).toBeVisible({ timeout: 3000 });
      }
    }).toPass({ timeout: 20000 });

    // Fill in the Name field (required) — second text input in the dialog (first is Display Order)
    const dataFieldNameInput = addDataFieldDialog.getByLabel('Name');
    await expect(dataFieldNameInput).toBeVisible({ timeout: 5000 });
    await dataFieldNameInput.fill(DATA_FIELD_NAME);

    // Click Save
    const dataFieldSaveButton = addDataFieldDialog.locator('button:has-text("Save")');
    await expect(dataFieldSaveButton).toBeEnabled({ timeout: 5000 });
    await dataFieldSaveButton.click();

    // ── Step 6: Verify the data field appears ────────────────────────────────

    // Scope to a *visible* match. Angular Material renders one cell per expansion panel,
    // including the collapsed ones, so `.first()` on a bare text match can resolve to a
    // hidden cell in another panel and fail with "Received: hidden" — which is exactly how
    // this spec flaked (it failed, then passed on retry).
    await expect(
      page.locator('mat-cell', { hasText: DATA_FIELD_NAME }).locator('visible=true').first()
    ).toBeVisible({ timeout: 10000 });

    // Cleanup happens in afterEach (via the API) so a mid-test failure still cleans up.
  });
});
