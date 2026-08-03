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
  // safely concurrent (one unfiltered global inject store shared by an
  // app-inject-list mounted per row). See acquireAdminCatalogLock in test-helpers.
  test.beforeEach(async () => {
    await acquireAdminCatalogLock();
  });

  test.afterEach(async () => {
    await releaseAdminCatalogLock();
  });

  // Unique per test run (tempBlueprintName) so concurrent runs / leftover rows from a
  // prior interrupted run never collide with, or get cascade-deleted alongside, this
  // spec's own records. Also makes these rows auto-purgeable by the TEMP_NAME_PATTERN
  // shape the teardown purge matches on.
  let INJECT_NAME: string;
  let CATALOG_NAME: string;
  let INJECT_TYPE_NAME: string;

  test.beforeEach(() => {
    INJECT_TYPE_NAME = tempBlueprintName('CopyInjIT');
    CATALOG_NAME = tempBlueprintName('CopyInjCat');
    INJECT_NAME = tempBlueprintName('CopyInj');
  });

  // Cleanup runs in afterEach (not inline at the end of the test body) so a mid-test
  // failure still deletes what this test created. Catalogs are deleted before inject
  // types: deleting an inject type CASCADE-DELETES every catalog that references it, so
  // deleting inject-type-first here would either no-op (catalog already gone) or, if a
  // future step read stale state, destroy the catalog out from under a still-running
  // assertion.
  test.afterEach(async () => {
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
      ).toBeVisible({ timeout: 5000 });
    };

    // Helper: the catalog's own row/detail-row, re-resolved fresh on every call (never
    // cached across a re-render — see ensureInjectsPanelOpen below for why that matters).
    const catalogRowFor = (catalogName: string) =>
      page.getByRole('button', { name: `Edit ${catalogName} catalog` }).locator('xpath=ancestor::mat-row[1]');
    const detailRowFor = (dataRow: ReturnType<typeof page.locator>) =>
      dataRow.locator('xpath=following-sibling::mat-row[contains(@class, "detail-row")][1]');

    // Helper: filter the Catalogs list down to this spec's own row via the section's
    // own Search box.
    //
    // This is required for a correct read rather than a retry around one:
    // AdminCatalogListComponent mounts one <app-inject-list> PER ROW unconditionally
    // (admin-catalog-list.component.html's expandedDetail column has no `@if` gating
    // it on expansion — only CSS visibility does), and every mounted instance's
    // ngOnInit() calls catalogInjectDataService.loadByCatalog(itsOwnCatalogId), which
    // does an UNFILTERED `catalogInjectStore.set(...)` — a full replace of the single
    // global Akita store, not an upsert keyed by catalog. Every app-inject-list
    // instance's constructor subscribes to that same global store with no filter by
    // its own catalog, so on a Catalogs page holding multiple catalogs (this suite
    // alone seeds 10+, and the list paginates at 20/page), whichever catalog's GET
    // resolves LAST determines what every mounted app-inject-list displays — including
    // catalogs that never had their row expanded. Search-filtering to this spec's own
    // catalog name means Angular Material's data source renders only this one row, so
    // only one app-inject-list instance is ever mounted and there is nothing left to race.
    const filterCatalogsListTo = async (catalogName: string) => {
      const searchBox = page.locator('input[placeholder*="Search"]').first();
      await expect(searchBox).toBeVisible({ timeout: 5000 });
      await searchBox.fill(catalogName);
      await expect(catalogRowFor(catalogName)).toBeVisible({ timeout: 5000 });
    };

    // Helper: ensure a catalog's row is expanded and its Injects panel is open, then
    // return the (freshly-resolved) detail row and its app-inject-list.
    //
    // This is deliberately idempotent and safe to re-run rather than a single
    // click-and-hope: AdminCatalogListComponent's mat-table has no trackBy, and every
    // catalog/inject-type/inject mutation on the shared admin stack broadcasts over
    // SignalR to every open admin session (Blueprint.Api Hubs/MainHub.cs
    // AdminDataGroup). A sibling spec's unrelated mutation running concurrently at
    // --workers 2 causes a full-table re-render that destroys and recreates every
    // detail row's app-inject-list/mat-expansion-panel — silently re-collapsing an
    // already-opened Injects panel even though the parent row's own expanded/collapsed
    // state (tracked separately, by id, in the list component) survives. Wrapping the
    // whole check-and-open sequence in `toPass` lets a re-render that lands mid-sequence
    // self-heal on retry instead of failing the test.
    //
    // `forceReload` navigates to Inject Types and back to Catalogs first, then
    // re-applies the search filter above. AdminContainerComponent only renders
    // <app-admin-catalog-list> while selectedTab === 'Catalogs' (see
    // admin-container.component.html's `@if`), so navigating away and back destroys
    // and recreates the whole catalog list, forcing a real fresh GET rather than
    // depending on the SignalR self-echo's timing.
    const ensureInjectsPanelOpen = async (catalogName: string, opts: { forceReload?: boolean } = {}) => {
      if (opts.forceReload) {
        await navigateTo('Inject Types');
        await navigateTo('Catalogs');
      }
      await filterCatalogsListTo(catalogName);
      let injectList!: ReturnType<typeof page.locator>;
      await expect(async () => {
        const catalogRow = catalogRowFor(catalogName);
        await expect(catalogRow).toBeVisible({ timeout: 3000 });
        let detailRow = detailRowFor(catalogRow);
        if (!(await detailRow.isVisible().catch(() => false))) {
          await catalogRow.click({ timeout: 3000 });
          detailRow = detailRowFor(catalogRow);
          await expect(detailRow).toBeVisible({ timeout: 3000 });
        }

        const candidateInjectList = detailRow.locator('app-inject-list');
        if (!(await candidateInjectList.locator('table').isVisible().catch(() => false))) {
          const panelHeader = detailRow.getByRole('button', { name: 'Injects' });
          await expect(panelHeader).toBeVisible({ timeout: 3000 });
          await panelHeader.click({ timeout: 3000 });
          await expect(candidateInjectList.locator('table')).toBeVisible({ timeout: 3000 });
        }
        injectList = candidateInjectList;
      }).toPass({ timeout: 45000 });
      return injectList;
    };

    // ── Step 1: Create a prerequisite Inject Type ────────────────────────────

    await navigateTo('Inject Types');

    // 3. Click add button to create a new inject type
    const addInjectTypeButton = page.locator(
      'button[title*="Add"], button[aria-label*="Add"]'
    ).first();
    await expect(addInjectTypeButton).toBeVisible({ timeout: 5000 });
    await addInjectTypeButton.click();

    // 4. Fill in the inject type name — the dialog's name field appearing IS the
    // signal that the "add" dialog opened; no fixed sleep needed.
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

    // 9. Fill in catalog name — waiting for this field IS the signal the dialog opened.
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
    // Select this spec's own inject type by name, not whatever happens to render first —
    // the option list is global across concurrently-running specs, and picking the first
    // option binds this catalog to a sibling spec's inject type. Deleting that sibling's
    // inject type in its own teardown then CASCADE-DELETEs this catalog mid-test.
    const injectTypeOption = page
      .locator('mat-option, [role="option"]')
      .filter({ hasText: INJECT_TYPE_NAME });
    await expect(injectTypeOption).toBeVisible({ timeout: 5000 });
    await injectTypeOption.click();

    // 12. Save the catalog
    const catalogSaveButton = page.locator('button:has-text("Save"), button[type="submit"]').first();
    await expect(catalogSaveButton).toBeEnabled({ timeout: 5000 });
    await catalogSaveButton.click();

    // expect: The catalog appears in the list
    await expect(page.locator(`text=${CATALOG_NAME}`).first()).toBeVisible({ timeout: 10000 });

    // ── Step 3: Create an Inject inside the Catalog ──────────────────────────

    // 13. Expand the catalog row and open the Injects panel
    await ensureInjectsPanelOpen(CATALOG_NAME);

    // 14/15/16. Click "Add Inject", choose "New Inject", then wait for the create
    // dialog to open. As noted on ensureInjectsPanelOpen above, a sibling spec's
    // unrelated mutation running concurrently at --workers 2 can force a full-table
    // re-render (silently re-collapsing this catalog's Injects panel, or replacing its
    // "Add Inject" button with a new DOM node) at any point in this sequence. Retry the
    // whole re-open-panel → click-through-dialog sequence so a re-render landing
    // mid-sequence self-heals instead of failing the test.
    await expect(async () => {
      const injectList = await ensureInjectsPanelOpen(CATALOG_NAME);
      const addInjectButton = injectList.getByRole('button', { name: 'Add Inject' });
      await expect(addInjectButton).toBeVisible({ timeout: 3000 });
      await addInjectButton.click({ timeout: 3000 });
      const newInjectMenuItem = page.locator('button[mat-menu-item]:has-text("New Inject"), button:has-text("New Inject")').first();
      await expect(newInjectMenuItem).toBeVisible({ timeout: 3000 });
      await newInjectMenuItem.click({ timeout: 3000 });
      // Angular Material dialogs render as mat-dialog-container. Use a specific selector
      // for the inject dialog that distinguishes it from the catalog dialog (inject
      // dialog has "Name of the Inject" title attribute).
      await expect(page.locator('input[title="The Name of the Inject"]')).toBeVisible({ timeout: 3000 });
    }).toPass({ timeout: 45000 });

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

    // The client closes the dialog before it updates the list without re-fetching it
    // (see ensureInjectsPanelOpen's forceReload doc above) — force a real reload by
    // navigating away and back so this assertion checks freshly-fetched server state,
    // not a race against the SignalR self-echo.
    let injectList = await ensureInjectsPanelOpen(CATALOG_NAME, { forceReload: true });
    // expect: The inject appears in the list
    await expect(injectList.getByRole('cell', { name: INJECT_NAME, exact: true })).toBeVisible({
      timeout: 10000,
    });

    // Record the count of inject rows before copy
    const initialInjectCount = await injectList.locator('mat-row, tr[mat-row]').count();
    expect(initialInjectCount).toBeGreaterThan(0);

    // ── Step 4: Copy the Inject ──────────────────────────────────────────────

    // 19. Click the copy button for the inject, then wait for the pre-filled copy
    // dialog to open. Retried as a unit for the same concurrent-re-render reason as the
    // add-inject sequence above.
    await expect(async () => {
      injectList = await ensureInjectsPanelOpen(CATALOG_NAME);
      const copyInjectButton = injectList.getByRole('button', {
        name: new RegExp(`^Copy ${INJECT_NAME}`),
      });
      await expect(copyInjectButton).toBeVisible({ timeout: 3000 });
      await copyInjectButton.click({ timeout: 3000 });
      // expect: Dialog contains "Create an Inject" title
      await expect(page.locator('mat-dialog-container').filter({ hasText: 'Create' })).toBeVisible({ timeout: 3000 });
    }).toPass({ timeout: 45000 });

    const copyDialog = page.locator('mat-dialog-container').filter({ hasText: 'Create' });

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

    // 22/23. Verify the inject count increased by 1, and the original inject name is
    // still visible (both original and copy). Force a real reload (see above) so the
    // count reflects freshly-fetched server state.
    injectList = await ensureInjectsPanelOpen(CATALOG_NAME, { forceReload: true });
    await expect(async () => {
      const newInjectCount = await injectList.locator('mat-row, tr[mat-row]').count();
      expect(newInjectCount).toBeGreaterThan(initialInjectCount);
    }).toPass({ timeout: 10000 });
    await expect(
      injectList.getByRole('cell', { name: INJECT_NAME, exact: true }).first()
    ).toBeVisible({ timeout: 5000 });

  });
});
