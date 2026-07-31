// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: gallery/gallery-test-plan.md
// seed: seed.spec.ts

import {
  test,
  expect,
  gotoGalleryAdmin,
  gotoAdminSection,
  apiCreateCollection,
  apiCreateExhibit,
  apiCreateTeam,
  apiSetExhibitMoveAndInject,
  apiDeleteCollectionById,
} from '../../fixtures';

/**
 * Exhibit Management — an expanded exhibit's detail sub-panel survives an exhibit-store
 * emission (regression cover for gallery.ui `f585bdf`).
 *
 * `admin-exhibits.component.ts` subscribes to `exhibitQuery.selectAll()` and, on every
 * emission, runs `setExhibitList` → `applyFilter`, which rebuilds `exhibitList` from
 * fresh object clones (`{ ...exhibit }`) and reassigns `dataSource.data`. With no
 * `trackBy`, CdkTable's differ has no stable identity to match rows on, so every row —
 * including the `multiTemplateDataRows` `expandedDetail` row — is diffed as
 * removed-then-added and its view is destroyed and recreated.
 *
 * That is destructive here specifically because the sub-panels inside the detail row are
 * `mat-expansion-panel`s with no `[expanded]` binding: their open/closed state is
 * internal component state living in the destroyed DOM, not a field on
 * `AdminExhibitsComponent`. `expandedExhibitId` survives (so the detail row itself
 * re-renders), but the "Exhibit Teams" panel inside it comes back collapsed and any work
 * in progress there is gone. `trackByFn` keyed on `exhibit.id` turns the diff into an
 * identity change, so the existing view is patched and the panel stays open.
 *
 * **The emission must be real for this test to mean anything.** The trigger below is a
 * `PUT /api/exhibits/{id}/move/{move}/inject/{inject}` against a *different* exhibit in
 * the same collection, which the API broadcasts as `ExhibitUpdated` to the
 * `AdminExhibitGroup` SignalR group (`ExhibitHandler.cs` `HandleCreateOrUpdate` +
 * `MainHub.GetAdminIdList`); `signalr.service.ts`'s handler calls
 * `exhibitDataService.updateStore`, which upserts into the Akita store and makes
 * `selectAll()` emit. Rather than trust that chain, the spec *observes* it: the sibling
 * exhibit's Move and Inject cells are asserted to change to the new values. Those cells
 * are only re-rendered by the very subscription under test, so if they update, the
 * emission provably reached the component — and a passing panel-still-open assertion
 * cannot be vacuous. Mutating the sibling rather than the expanded exhibit also keeps
 * the trigger independent of the row being observed.
 *
 * This spec seeds its own collection and two exhibits rather than using the
 * worker-scoped `seededExhibit`: it needs two exhibits in one collection, and it mutates
 * one of them.
 */
test.describe('Exhibit Management', () => {
  // Recorded as soon as the collection exists so `afterEach` removes it even when the
  // test body throws partway through. Exhibit.CollectionId and Team.ExhibitId are both
  // DeleteBehavior.Cascade, so deleting the collection removes both exhibits and the
  // seeded team.
  let collectionId: string | undefined;

  test.afterEach(async () => {
    if (collectionId) {
      await apiDeleteCollectionById(collectionId, 'Detail Panel Persistence Test collection');
    }
    collectionId = undefined;
  });

  test('Expanded exhibit detail panel stays open across an exhibit update', async ({
    galleryAuthenticatedPage: page,
  }) => {
    const suffix = `${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
    const collection = await apiCreateCollection(`Detail Panel Persistence Test ${suffix}`);
    collectionId = collection.id;

    // The exhibit whose detail panel is opened and must survive.
    const watched = await apiCreateExhibit(collectionId, `Panel Watched Exhibit ${suffix}`);
    // The exhibit that gets mutated to provoke the store emission. A sibling in the same
    // collection, so it shares the table but is not the row being observed.
    const sibling = await apiCreateExhibit(collectionId, `Panel Trigger Exhibit ${suffix}`);

    // A team on the watched exhibit gives the "Exhibit Teams" panel visible content, so
    // "panel still open" can be asserted on rendered data rather than on a CSS class
    // alone — a panel that reopened empty would not satisfy this.
    const teamShortName = `PANEL-${suffix}`;
    const teamFullName = `Panel Team ${suffix}`;
    await apiCreateTeam(watched.id, { name: teamFullName, shortName: teamShortName });

    await gotoGalleryAdmin(page);
    await gotoAdminSection(page, 'Exhibits');

    // The exhibits table only renders once a collection is selected.
    const collectionDropdown = page.getByRole('combobox', { name: 'Select a Collection' });
    await collectionDropdown.click();
    const option = page.getByRole('option', { name: collection.name, exact: true });
    await expect(option).toBeVisible();
    await option.click();

    // 1. Expand the watched exhibit's row.
    const watchedRow = page.getByRole('row').filter({ hasText: watched.name }).first();
    await expect(watchedRow).toBeVisible();
    await watchedRow.getByRole('cell', { name: watched.name }).click();

    // 2. Expand the "Exhibit Teams" sub-panel and confirm its content is visible.
    const exhibitTeamsHeader = page.getByRole('button', { name: 'Exhibit Teams' });
    await expect(exhibitTeamsHeader).toBeVisible();
    await exhibitTeamsHeader.click();

    const teamsRegion = page.getByRole('region', { name: 'Exhibit Teams' });
    await expect(teamsRegion).toBeVisible();
    await expect(teamsRegion.getByText(teamShortName, { exact: true })).toBeVisible();
    await expect(teamsRegion.getByText(teamFullName, { exact: true })).toBeVisible();
    // `aria-expanded` is what mat-expansion-panel-header reflects its open state as, so
    // this is the state that a row rebuild resets.
    await expect(exhibitTeamsHeader).toHaveAttribute('aria-expanded', 'true');

    // 3. Provoke an exhibit-store emission by mutating the sibling exhibit through the
    //    API. Move/inject are rendered columns, so the change is observable in the DOM.
    const siblingRow = page.getByRole('row').filter({ hasText: sibling.name }).first();
    const siblingMoveCell = siblingRow.getByRole('cell').nth(4);
    const siblingInjectCell = siblingRow.getByRole('cell').nth(5);
    await expect(siblingMoveCell).toHaveText('0');
    await expect(siblingInjectCell).toHaveText('0');

    await apiSetExhibitMoveAndInject(sibling.id, 7, 3);

    // expect: the emission actually reached this component. These two cells are rendered
    // from `dataSource.data`, which only changes via the `exhibitQuery.selectAll()`
    // subscription that `trackBy` governs — so this assertion is the guard against a
    // vacuous pass below. If SignalR never delivered `ExhibitUpdated`, this fails here
    // instead of silently making the panel assertion meaningless.
    await expect(siblingMoveCell).toHaveText('7');
    await expect(siblingInjectCell).toHaveText('3');

    // expect: the sub-panel is still open with its content still visible. Pre-fix the
    // row rebuild destroyed this DOM and the panel came back collapsed, hiding the team
    // rows even though `expandedExhibitId` still named the watched exhibit.
    await expect(exhibitTeamsHeader).toHaveAttribute('aria-expanded', 'true');
    await expect(teamsRegion).toBeVisible();
    await expect(teamsRegion.getByText(teamShortName, { exact: true })).toBeVisible();
    await expect(teamsRegion.getByText(teamFullName, { exact: true })).toBeVisible();

    // A second emission confirms the row is genuinely being reused rather than having
    // survived one diff by luck.
    await apiSetExhibitMoveAndInject(sibling.id, 9, 4);
    await expect(siblingMoveCell).toHaveText('9');
    await expect(siblingInjectCell).toHaveText('4');
    await expect(exhibitTeamsHeader).toHaveAttribute('aria-expanded', 'true');
    await expect(teamsRegion.getByText(teamShortName, { exact: true })).toBeVisible();
  });
});
