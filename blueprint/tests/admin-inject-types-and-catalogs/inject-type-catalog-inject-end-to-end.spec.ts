// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: specs/blueprint-test-plan.md
// seed: tests/seed.spec.ts

import { test, expect, Services } from '../../fixtures';
import { getBlueprintToken, tempBlueprintName,
  acquireAdminCatalogLock,
  releaseAdminCatalogLock,
} from '../../test-helpers';

test.describe('Admin - Inject Types and Catalogs Management', () => {
  // Serialize access to the shared admin Catalogs / Inject Types pages: they are not
  // safely concurrent because of BP-16 (one unfiltered global inject store shared by an
  // app-inject-list mounted per row). See acquireAdminCatalogLock in test-helpers.
  test.beforeEach(async () => {
    await acquireAdminCatalogLock();
  });

  test.afterEach(async () => {
    await releaseAdminCatalogLock();
  });

  // Unique per run so concurrent runs / leftovers from an interrupted prior run never
  // collide, and the teardown purge auto-sweeps by the tempBlueprintName shape.
  let INJECT_TYPE_NAME: string;
  let CATALOG_NAME: string;
  let INJECT_NAME: string;

  test.beforeEach(() => {
    INJECT_TYPE_NAME = tempBlueprintName('E2eIT');
    CATALOG_NAME = tempBlueprintName('E2eCat');
    INJECT_NAME = tempBlueprintName('E2eInj');
  });

  // Safety-net cleanup via the API in afterEach so a mid-test failure still cleans up —
  // the test body itself also deletes the catalog and inject type through the UI as
  // part of exercising delete functionality (that IS the point of this end-to-end spec),
  // so these calls are idempotent no-ops on the happy path. Catalogs are deleted before
  // inject types: deleting an inject type CASCADE-DELETES every catalog that still
  // references it.
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

  test('Inject Type / Catalog / Inject end-to-end flow', async ({ blueprintAuthenticatedPage: page }) => {
    // 1. Authenticate and navigate to the admin section
    await page.goto(`${Services.Blueprint.UI}/admin`);
    await expect(page).toHaveURL(/\/admin/, { timeout: 10000 });

    // Helper: navigate to an admin sidebar section
    const navigateTo = async (section: string) => {
      const navItem = page.locator(`mat-list-item:has-text("${section}")`).first();
      await expect(navItem).toBeVisible({ timeout: 5000 });
      await navItem.click();
      await expect(
        page.locator(`h1:has-text("${section}"), h2:has-text("${section}"), [class*="title"]:has-text("${section}"), mat-toolbar:has-text("${section}")`).first()
      ).toBeVisible({ timeout: 5000 });
    };

    // Helper: confirm and complete a delete-confirmation dialog. Every delete flow in
    // this spec (inject, catalog, inject type) routes through CrucibleDialogService's
    // shared confirm dialog, whose [mat-dialog-close] button closes the dialog
    // synchronously on click — the underlying DELETE fires afterward from the
    // `afterClosed()` subscriber, so the dialog closing is itself the real signal that
    // the confirm was accepted (not a fixed sleep). Each call site below additionally
    // asserts on the row/cell actually disappearing, which proves the DELETE persisted.
    const confirmDelete = async () => {
      const confirmDialog = page.locator(
        '[role="dialog"], .mat-dialog-container, [class*="dialog"]'
      ).first();
      await expect(confirmDialog).toBeVisible({ timeout: 5000 });
      const confirmButton = page.locator(
        'button:has-text("Confirm"), button:has-text("Delete"), button:has-text("Yes"), button:has-text("OK")'
      ).last();
      await confirmButton.click();
      await expect(confirmDialog).not.toBeVisible({ timeout: 5000 });
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

    // Helper: the detail row rendered directly below a given data row once expanded.
    const detailRowFor = (dataRow: ReturnType<typeof page.locator>) =>
      dataRow.locator('xpath=following-sibling::mat-row[contains(@class, "detail-row")][1]');

    // Helper: ensure a catalog's row is expanded and its Injects panel is open, then
    // return the (freshly-resolved) app-inject-list within it.
    //
    // Filters the Catalogs list to this spec's own catalog name via the section's own
    // Search box FIRST. This closes a real app defect rather than merely retrying
    // around it: AdminCatalogListComponent mounts one <app-inject-list> PER ROW
    // unconditionally (admin-catalog-list.component.html's expandedDetail column has
    // no `@if` gating it on expansion — only CSS visibility does), and every mounted
    // instance's ngOnInit() calls catalogInjectDataService.loadByCatalog(itsOwnId),
    // which does an UNFILTERED `catalogInjectStore.set(...)` — a full replace of the
    // single global Akita store, not an upsert keyed by catalog. Every app-inject-list
    // instance's constructor subscribes to that same unfiltered store, so on a Catalogs
    // page holding multiple catalogs (this suite alone seeds 10+, and the list
    // paginates at 20/page), whichever catalog's GET resolves LAST determines what
    // every mounted app-inject-list displays — including catalogs whose row was never
    // expanded. Filtering to a single matching row means only one app-inject-list
    // instance is ever mounted, so there is nothing left to race.
    //
    // Also deliberately idempotent/re-runnable rather than a single click-and-hope:
    // AdminCatalogListComponent's mat-table has no trackBy, and every catalog/inject-
    // type/inject mutation on the shared admin stack broadcasts over SignalR to every
    // open admin session (Blueprint.Api Hubs/MainHub.cs AdminDataGroup). A sibling
    // spec's unrelated mutation running concurrently at --workers 2 can still force a
    // re-render that re-collapses an already-opened Injects panel even after
    // filtering. Callers wrap this (and the subsequent action) in `toPass` so a
    // re-render landing mid-sequence self-heals instead of failing the test.
    const ensureCatalogInjectsPanelOpen = async (catalogName: string) => {
      const searchBox = page.locator('input[placeholder*="Search"]').first();
      await expect(searchBox).toBeVisible({ timeout: 3000 });
      await searchBox.fill(catalogName);

      const catalogRow = page
        .getByRole('button', { name: `Edit ${catalogName} catalog` })
        .locator('xpath=ancestor::mat-row[1]');
      await expect(catalogRow).toBeVisible({ timeout: 3000 });
      let detailRow = detailRowFor(catalogRow);
      if (!(await detailRow.isVisible().catch(() => false))) {
        await catalogRow.click({ timeout: 3000 });
        detailRow = detailRowFor(catalogRow);
        await expect(detailRow).toBeVisible({ timeout: 3000 });
      }
      const injectList = detailRow.locator('app-inject-list');
      if (!(await injectList.locator('table').isVisible().catch(() => false))) {
        const panelHeader = detailRow.getByRole('button', { name: /^Injects$/i });
        await expect(panelHeader).toBeVisible({ timeout: 3000 });
        await panelHeader.click({ timeout: 3000 });
        await expect(injectList.locator('table')).toBeVisible({ timeout: 3000 });
      }
      return { catalogRow, detailRow, injectList };
    };

    // Helper: same idea, for an inject type's own Injects panel. AdminInjectTypesComponent's
    // expandedDetail column DOES gate app-inject-list behind `@if (expandedElementId ===
    // element.id)` (unlike AdminCatalogListComponent's), so only the currently-expanded
    // inject type ever mounts one — no cross-row store race here. Still filter via the
    // section's own Search box so a paginated list can't hide this spec's own row.
    const ensureInjectTypeInjectsPanelOpen = async (injectTypeName: string) => {
      const searchBox = page.locator('input[placeholder*="Search"]').first();
      await expect(searchBox).toBeVisible({ timeout: 3000 });
      await searchBox.fill(injectTypeName);

      const injectTypeRow = page.locator('mat-row.element-row, mat-row').filter({ hasText: injectTypeName }).first();
      await expect(injectTypeRow).toBeVisible({ timeout: 3000 });
      let detailRow = detailRowFor(injectTypeRow);
      if (!(await detailRow.isVisible().catch(() => false))) {
        await injectTypeRow.click({ timeout: 3000 });
        detailRow = detailRowFor(injectTypeRow);
        await expect(detailRow).toBeVisible({ timeout: 3000 });
      }
      const injectList = detailRow.locator('app-inject-list');
      if (!(await injectList.locator('table').isVisible().catch(() => false))) {
        const panelHeader = detailRow.getByRole('button', { name: /^Injects$/i });
        await expect(panelHeader).toBeVisible({ timeout: 3000 });
        await panelHeader.click({ timeout: 3000 });
        await expect(injectList.locator('table')).toBeVisible({ timeout: 3000 });
      }
      return { injectTypeRow, detailRow, injectList };
    };

    // ── Step 1: Create an Inject Type ────────────────────────────────────────
    // 4. Open the "Add new inject type" form and fill in name + description

    await navigateTo('Inject Types');

    const addInjectTypeButton = page.locator(
      'button[title*="Add new inject type"], button[title*="Add"], button[aria-label*="Add"]'
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
    await injectTypeDescField.fill('End-to-end test inject type');

    const injectTypeSaveButton = page.locator(
      'button:has-text("Save"), button[type="submit"]'
    ).first();
    await expect(injectTypeSaveButton).toBeEnabled({ timeout: 5000 });
    await injectTypeSaveButton.click();

    // expect: The inject type appears in the list
    await expect(page.locator(`text=${INJECT_TYPE_NAME}`).first()).toBeVisible({ timeout: 10000 });

    // ── Step 2: Create a Catalog ─────────────────────────────────────────────
    // 5. Navigate to Catalogs and create a new catalog linked to the inject type

    await navigateTo('Catalogs');

    const addCatalogButton = page.getByRole('button', { name: 'Add new Catalog' });
    await expect(addCatalogButton).toBeVisible({ timeout: 5000 });
    await addCatalogButton.click();

    const catalogNameField = page.locator('input[placeholder*="Name"]').first();
    await expect(catalogNameField).toBeVisible({ timeout: 5000 });
    await catalogNameField.fill(CATALOG_NAME);

    const catalogDescField = page.locator(
      'input[placeholder*="Description"], textarea[placeholder*="Description"]'
    ).first();
    await expect(catalogDescField).toBeVisible({ timeout: 5000 });
    await catalogDescField.fill('End-to-end test catalog');

    // Select this spec's own inject type by name — the option list is global across
    // concurrently-running specs, so picking the globally-first option (rather than
    // filtering by name) would bind this catalog to a sibling spec's inject type. That
    // sibling's teardown then CASCADE-DELETEs this catalog the moment it deletes its
    // own inject type. There is deliberately no unfiltered ".first()" fallback here: if
    // this spec's own option isn't present, that is a real failure, not something to
    // paper over.
    const injectTypeCombobox = page.getByRole('combobox', { name: /Inject Type/i }).first();
    await expect(injectTypeCombobox).toBeVisible({ timeout: 5000 });
    await injectTypeCombobox.click();
    const injectTypeOption = page.locator('mat-option, [role="option"]').filter({ hasText: INJECT_TYPE_NAME });
    await expect(injectTypeOption).toBeVisible({ timeout: 5000 });
    await injectTypeOption.click();

    const catalogSaveButton = page.locator('button:has-text("Save"), button[type="submit"]').first();
    await expect(catalogSaveButton).toBeEnabled({ timeout: 5000 });
    await catalogSaveButton.click();

    // expect: The catalog appears in the list with a Delete button
    await expect(
      page.getByRole('button', { name: `Delete ${CATALOG_NAME} catalog` })
    ).toBeVisible({ timeout: 10000 });

    // ── Step 3: Create an Inject under the Catalog ───────────────────────────
    // 6. Expand the catalog row and open the "Injects" expansion panel, then click
    // "Add Inject" → "New Inject" and wait for the create dialog. Retried as a unit:
    // see ensureCatalogInjectsPanelOpen above for why a concurrent sibling spec's
    // mutation can land mid-sequence and re-collapse this panel or swap out its
    // "Add Inject" button.
    await expect(async () => {
      const { injectList } = await ensureCatalogInjectsPanelOpen(CATALOG_NAME);
      const addInjectButton = injectList.getByRole('button', { name: 'Add Inject' });
      await expect(addInjectButton).toBeVisible({ timeout: 3000 });
      await addInjectButton.click({ timeout: 3000 });
      const newInjectMenuItem = page.locator(
        'button[mat-menu-item]:has-text("New Inject"), button:has-text("New Inject"), [role="menuitem"]:has-text("New Inject")'
      ).first();
      await expect(newInjectMenuItem).toBeVisible({ timeout: 3000 });
      await newInjectMenuItem.click({ timeout: 3000 });
      await expect(page.locator('input[title="The Name of the Inject"]')).toBeVisible({ timeout: 3000 });
    }).toPass({ timeout: 45000 });

    // 9. Fill in the required fields
    const injectNameInput = page.locator('input[title="The Name of the Inject"]').first();
    await expect(injectNameInput).toBeVisible({ timeout: 5000 });
    await injectNameInput.fill(INJECT_NAME);

    const injectDescInput = page.locator('input[title="The Description of the Inject"]').first();
    await expect(injectDescInput).toBeVisible({ timeout: 5000 });
    await injectDescInput.fill('End-to-end test inject');

    // 10. Save the inject — pair the click with the POST it triggers, then wait for the
    // dialog to close, both real signals instead of a fixed sleep.
    const injectDialog = page.locator('mat-dialog-container').first();
    await expect(injectDialog).toBeVisible({ timeout: 5000 });
    const injectSaveButton = injectDialog.getByRole('button', { name: 'Save' }).first();
    await expect(injectSaveButton).toBeEnabled({ timeout: 5000 });
    const createInjectResponse = page.waitForResponse(
      (response) =>
        response.request().method() === 'POST' &&
        /^\/api\/catalog\/[^/]+\/injects$/.test(new URL(response.url()).pathname),
      { timeout: 15000 }
    );
    await injectSaveButton.click();
    expect((await createInjectResponse).ok(), 'create inject response').toBeTruthy();
    await expect(injectDialog).not.toBeVisible({ timeout: 10000 });

    // expect: The inject appears in the catalog's Injects panel. The panel may have
    // collapsed (dialog close, or a concurrent re-render) — re-ensure it's open.
    await expect(async () => {
      const { injectList } = await ensureCatalogInjectsPanelOpen(CATALOG_NAME);
      await expect(
        injectList.getByRole('cell', { name: INJECT_NAME, exact: true })
      ).toBeVisible({ timeout: 3000 });
    }).toPass({ timeout: 45000 });

    // ── Step 4: Verify inject appears under the Inject Type ──────────────────
    // 11. Navigate to Inject Types and expand the inject type row, open its Injects
    // panel, and verify our inject appears there too.

    await navigateTo('Inject Types');

    await expect(async () => {
      const { injectList } = await ensureInjectTypeInjectsPanelOpen(INJECT_TYPE_NAME);
      await expect(
        injectList.getByRole('cell', { name: INJECT_NAME, exact: true })
      ).toBeVisible({ timeout: 3000 });
    }).toPass({ timeout: 45000 });

    // ── Step 5: Delete the inject from the inject type view ──────────────────
    // 13. Click the delete button for the inject within the inject type's Injects
    // section. Button title pattern: "Delete <name> inject"
    let injectTypeInjectList = (await ensureInjectTypeInjectsPanelOpen(INJECT_TYPE_NAME)).injectList;
    const deleteInjectButton = injectTypeInjectList.getByRole('button', {
      name: new RegExp(`^Delete ${INJECT_NAME} inject$`),
    }).first();
    await expect(deleteInjectButton).toBeVisible({ timeout: 5000 });
    await deleteInjectButton.click();
    await confirmDelete();

    // expect: The inject no longer appears in the inject type's Injects section
    await expect(async () => {
      const { injectList } = await ensureInjectTypeInjectsPanelOpen(INJECT_TYPE_NAME);
      await expect(
        injectList.getByRole('cell', { name: INJECT_NAME, exact: true })
      ).not.toBeVisible({ timeout: 3000 });
    }).toPass({ timeout: 45000 });

    // ── Step 6: Verify inject is gone from the catalog ───────────────────────
    // 14. Navigate to Catalogs and expand the catalog row, open the Injects panel

    await navigateTo('Catalogs');

    await expect(async () => {
      const { injectList } = await ensureCatalogInjectsPanelOpen(CATALOG_NAME);
      // expect: The inject is no longer listed in the catalog's Injects panel
      await expect(
        injectList.getByRole('cell', { name: INJECT_NAME, exact: true })
      ).not.toBeVisible({ timeout: 3000 });
    }).toPass({ timeout: 45000 });

    // ── Step 7: Delete the catalog ───────────────────────────────────────────
    // 16. Click the delete button for the catalog and confirm

    // Collapse the expanded row first so the delete button is accessible
    const { catalogRow } = await ensureCatalogInjectsPanelOpen(CATALOG_NAME);
    await catalogRow.click();

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
