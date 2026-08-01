// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: specs/blueprint-test-plan.md
// seed: tests/seed.spec.ts

import { test, expect, Services } from '../../fixtures';
import { getBlueprintToken, tempBlueprintName } from '../../test-helpers';

test.describe('Admin - Inject Types and Catalogs Management', () => {
  // Unique per run so concurrent runs / leftovers from an interrupted prior run never
  // collide, and the teardown purge auto-sweeps by the tempBlueprintName shape.
  let CATALOG_NAME: string;
  let INJECT_TYPE_NAME: string;

  test.beforeEach(() => {
    CATALOG_NAME = tempBlueprintName('ExpandCat');
    INJECT_TYPE_NAME = tempBlueprintName('ExpandCatIT');
  });

  // Cleanup runs in afterEach (not inline at the end of the test body) so a mid-test
  // failure still deletes what this test created. Catalogs are deleted before inject
  // types: deleting an inject type CASCADE-DELETES every catalog that still references it.
  test.afterEach(async () => {
    const token = await getBlueprintToken();
    const headers = { Authorization: `Bearer ${token}` };

    for (const [endpoint, name] of [
      ['/api/catalogs', CATALOG_NAME],
      ['/api/injectTypes', INJECT_TYPE_NAME],
    ] as const) {
      const response = await fetch(`${Services.Blueprint.API}${endpoint}`, { headers });
      if (!response.ok) continue;

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

  test('Expand Catalog to View Injects', async ({ blueprintAuthenticatedPage: page }) => {
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

    const injectTypeDescField = page.locator(
      'input[formControlName="description"], input[placeholder*="Description"], textarea[placeholder*="Description"]'
    ).first();
    await expect(injectTypeDescField).toBeVisible({ timeout: 5000 });
    await injectTypeDescField.fill('Test inject type for expand catalog test');

    const injectTypeSaveButton = page.locator(
      'button:has-text("Save"), button[type="submit"]'
    ).first();
    await expect(injectTypeSaveButton).toBeEnabled({ timeout: 5000 });
    await injectTypeSaveButton.click();

    await expect(page.locator(`text=${INJECT_TYPE_NAME}`).first()).toBeVisible({ timeout: 10000 });

    // ── Step 2: Create Catalog ───────────────────────────────────────────────

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
    await descField.fill('Test catalog for expand/collapse test');

    // Select this spec's own inject type by name, not whatever happens to render
    // first — the option list is global across concurrently-running specs, and
    // picking the first option binds this catalog to a sibling spec's inject type.
    // That sibling's teardown then CASCADE-DELETEs this catalog when it deletes its
    // own inject type.
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

    await expect(page.locator(`text=${CATALOG_NAME}`).first()).toBeVisible({ timeout: 10000 });

    // ── Step 3: Expand and collapse this spec's own catalog row ──────────────

    // Scope to the row that carries this spec's own catalog name — the Catalogs table
    // is shared with concurrently-running specs, so a positional `.first()` against the
    // whole table can resolve to a sibling spec's row.
    const catalogRow = page
      .getByRole('button', { name: `Edit ${CATALOG_NAME} catalog` })
      .locator('xpath=ancestor::mat-row[1]');
    const detailRow = catalogRow.locator('xpath=following-sibling::mat-row[contains(@class, "detail-row")][1]');
    const expandedContent = detailRow.locator('mat-expansion-panel').filter({ hasText: 'Injects' });

    // 1. Click on the catalog row to expand it. AdminCatalogListComponent's mat-table
    // has no trackBy, and every catalog/inject-type mutation on the shared admin stack
    // broadcasts over SignalR to every open admin session (Blueprint.Api
    // Hubs/MainHub.cs AdminDataGroup) — a sibling spec's unrelated mutation running
    // concurrently at --workers 2 can force a full-table re-render between the click
    // and the assertion below. Retry the click+verify as a unit so a re-render landing
    // mid-sequence self-heals instead of failing the test.
    await expect(async () => {
      await expect(catalogRow).toBeVisible({ timeout: 3000 });
      if (!(await expandedContent.isVisible().catch(() => false))) {
        await catalogRow.click({ timeout: 3000 });
      }
      // expect: The row expands to show the Injects expansion panel for that catalog
      await expect(expandedContent).toBeVisible({ timeout: 3000 });
    }).toPass({ timeout: 20000 });

    // 2. Click the same row again to collapse it
    await expect(async () => {
      if (await expandedContent.isVisible().catch(() => false)) {
        await catalogRow.click({ timeout: 3000 });
      }
      // expect: The row collapses (expanded content is no longer visible). The
      // detailExpand animation drives this via a CSS state change (visibility:
      // hidden), not removal from the DOM, so `.not.toBeVisible()` on the same
      // locator is the correct real assertion — no swallow needed.
      await expect(expandedContent).not.toBeVisible({ timeout: 3000 });
    }).toPass({ timeout: 20000 });
  });
});
