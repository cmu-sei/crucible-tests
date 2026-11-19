// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: specs/blueprint-test-plan.md
// seed: tests/seed.spec.ts

import { test, expect, Services, BLUEPRINT_THEMES, applyBlueprintTheme } from '../../fixtures';
import { getBlueprintToken, tempBlueprintName,
  createInjectType,
  createCatalog,
  createCatalogInject,
  acquireAdminCatalogLock,
  releaseAdminCatalogLock,
} from '../../test-helpers';

for (const theme of BLUEPRINT_THEMES) {
    test.describe(`${theme} theme › Admin - Inject Types and Catalogs Management`, () => {
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

    test.beforeEach(async () => {
      INJECT_TYPE_NAME = tempBlueprintName('CopyInjIT');
      CATALOG_NAME = tempBlueprintName('CopyInjCat');
      INJECT_NAME = tempBlueprintName('CopyInj');
      // Preconditions over the API, inside the lock the first beforeEach took (every create
      // broadcasts to open admin pages). Only the copy goes through the UI.
      const token = await getBlueprintToken();
      const injectType = await createInjectType(token, { name: INJECT_TYPE_NAME });
      const catalog = await createCatalog(token, { name: CATALOG_NAME, injectTypeId: injectType.id });
      await createCatalogInject(token, catalog.id, { name: INJECT_NAME, injectTypeId: injectType.id });
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
    await applyBlueprintTheme(page, theme);
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
        }).toPass({ timeout: 30000 });
        return injectList;
      };

      // ── Step 1-3: the Inject Type, Catalog and Inject were seeded in beforeEach ──

      await navigateTo('Catalogs');
      let injectList = await ensureInjectsPanelOpen(CATALOG_NAME);
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
      }).toPass({ timeout: 30000 });

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
}