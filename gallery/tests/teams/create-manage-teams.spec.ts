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
  apiDeleteCollectionById,
  Services,
} from '../../fixtures';
import { request as pwRequest, type APIRequestContext, type Page } from '@playwright/test';

/**
 * Team Management §13.2 — Create and Manage Teams.
 *
 * Exhibit teams are genuinely exposed for create/edit/delete in admin, but not as a
 * top-level section: `admin-exhibits.component.html` hosts `<app-admin-teams>` inside
 * the exhibit row's expanded detail, in a `mat-expansion-panel` headed "Exhibit Teams".
 * The route is Administration -> Exhibits -> select the parent collection -> click the
 * exhibit row to expand -> expand "Exhibit Teams". The panel header carries an
 * "Add Team" button and every row carries "Edit {name}" / "Delete {name}" buttons
 * (`admin-teams.component.html`), all three gated on `[canEdit]="canEditExhibit(id)"`.
 *
 * All three actions go through `AdminTeamEditDialogComponent` / the confirm dialog and
 * land on the Team API: POST /api/teams, PUT /api/teams/{id}, DELETE /api/teams/{id}
 * (`team-data.service.ts` add/updateTeam/delete). Each step below is proven by the
 * paired response plus the resulting row state, not by a sleep.
 *
 * This spec creates its OWN collection + exhibit rather than using the worker-scoped
 * `seededExhibit`: it mutates the exhibit's team list (create, rename, delete), and
 * `seededExhibit` is shared across every other test in the worker — `view-exhibit-teams`
 * and `team-selector` both assert directly against its one seeded team. Perturbing that
 * shared team list, even temporarily, would make this spec's outcome depend on
 * scheduling order relative to those other specs. A dedicated exhibit keeps the mutation
 * fully contained.
 */

/** Run a callback with a Gallery API context and an admin bearer token. */
async function galleryApi<T>(fn: (ctx: APIRequestContext, token: string) => Promise<T>): Promise<T> {
  const ctx = await pwRequest.newContext({ ignoreHTTPSErrors: true });
  try {
    const tokenRes = await ctx.post(`${Services.Keycloak}/realms/crucible/protocol/openid-connect/token`, {
      form: {
        grant_type: 'password',
        client_id: 'gallery.ui',
        username: 'admin',
        password: 'admin',
        scope: 'openid profile gallery',
      },
    });
    if (!tokenRes.ok()) {
      throw new Error(`Failed to get Gallery API token: ${tokenRes.status()} ${await tokenRes.text()}`);
    }
    return await fn(ctx, (await tokenRes.json()).access_token);
  } finally {
    await ctx.dispose();
  }
}

/**
 * Delete this exhibit's teams whose name is in `names`, by exact match.
 *
 * Deliberately scoped to one exhibit and to names this spec generated: sibling specs
 * seed their own teams concurrently, so a prefix purge would delete live data.
 * Teams are looked up through the exhibit's own list endpoint rather than a paginated
 * admin page, and a name that no longer exists is simply skipped — so this is safe to
 * call after the UI already deleted the team.
 */
async function apiDeleteExhibitTeamsByName(exhibitId: string, names: string[]): Promise<void> {
  if (names.length === 0) return;
  await galleryApi(async (ctx, token) => {
    const listRes = await ctx.get(`${Services.Gallery.API}/api/exhibits/${exhibitId}/teams`, {
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
    });
    if (!listRes.ok()) {
      console.warn(`Cleanup: failed to list teams for exhibit ${exhibitId}: ${listRes.status()}`);
      return;
    }
    const teams: Array<{ id: string; name: string }> = await listRes.json();
    for (const team of teams.filter((t) => names.includes(t.name))) {
      const delRes = await ctx.delete(`${Services.Gallery.API}/api/teams/${team.id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (delRes.ok() || delRes.status() === 404) {
        console.log(`Cleanup: deleted team ${team.name} (${team.id})`);
      } else {
        console.warn(`Cleanup: failed to delete team ${team.id}: ${delRes.status()}`);
      }
    }
  });
}

/**
 * Open the "Exhibit Teams" panel for `exhibitName` and return its region locator.
 *
 * The exhibits table only renders once a collection is chosen, and the team list only
 * loads on row expansion (`toggleExpand` -> `teamDataService.loadByExhibitId`), so both
 * steps are required before any team row exists.
 */
async function openExhibitTeamsPanel(page: Page, collectionName: string, exhibitName: string) {
  await gotoGalleryAdmin(page);
  await gotoAdminSection(page, 'Exhibits');

  await page.getByRole('combobox', { name: 'Select a Collection' }).click();
  await page.getByRole('option', { name: collectionName, exact: true }).click();

  const exhibitRow = page.getByRole('row').filter({ hasText: exhibitName }).first();
  await expect(exhibitRow).toBeVisible();
  await exhibitRow.getByRole('cell', { name: exhibitName }).click();

  const exhibitTeamsPanel = page.getByRole('button', { name: 'Exhibit Teams' });
  await expect(exhibitTeamsPanel).toBeVisible();
  await exhibitTeamsPanel.click();

  const teamsRegion = page.getByRole('region', { name: 'Exhibit Teams' });
  await expect(teamsRegion).toBeVisible();
  return teamsRegion;
}

test.describe('Team Management', () => {
  // Every team name this spec asks the UI to create, registered *before* the create
  // action so a mid-test failure still gets cleaned up. Both the original and the
  // renamed name are tracked, because after step 2 the row answers to the new name.
  let createdTeamNames: string[] = [];
  // The dedicated collection this spec seeds. Deleting it cascades to the exhibit and
  // any teams still attached (TeamConfiguration -> OnDelete(Cascade)), so it is the
  // backstop even if the per-name team cleanup below misses something.
  let ownCollectionId: string | undefined;
  let ownExhibitId: string | undefined;

  test.beforeEach(() => {
    createdTeamNames = [];
    ownCollectionId = undefined;
    ownExhibitId = undefined;
  });

  test.afterEach(async () => {
    if (ownExhibitId) {
      await apiDeleteExhibitTeamsByName(ownExhibitId, createdTeamNames);
    }
    if (ownCollectionId) {
      await apiDeleteCollectionById(ownCollectionId, 'create-manage-teams collection');
    }
  });

  test('Create and Manage Teams', async ({ galleryAuthenticatedPage: page }) => {
    const unique = `${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
    const teamName = `Managed Team ${unique}`;
    const teamShortName = `MT${unique}`.slice(0, 20);
    const renamedTeamName = `Renamed Team ${unique}`;

    // Seed the precondition records (a collection and an exhibit inside it) via the API;
    // creating them through the UI is covered by the collection/exhibit specs.
    // Register ids for teardown as soon as each one exists.
    const collection = await apiCreateCollection(
      `Manage Teams Collection ${unique}`,
      'Collection for the create-manage-teams spec'
    );
    ownCollectionId = collection.id;
    const exhibit = await apiCreateExhibit(collection.id, `Manage Teams Exhibit ${unique}`);
    ownExhibitId = exhibit.id;

    const teamsRegion = await openExhibitTeamsPanel(page, collection.name, exhibit.name);

    // A brand-new exhibit has no teams, which is also what keeps the null-shortName sort
    // crash described above out of the way.
    await expect(teamsRegion.getByRole('button', { name: `Edit ${teamName}` })).toHaveCount(0);

    // 1. Create a new team for the exhibit.
    await teamsRegion.getByRole('button', { name: 'Add Team' }).click();

    const addDialog = page.getByRole('dialog');
    await expect(addDialog).toBeVisible();

    // `exact: true` matters: "Name" would otherwise also match the "Short Name" field.
    // Register the name before saving so teardown covers a partial create.
    createdTeamNames.push(teamName);
    await addDialog.getByLabel('Name', { exact: true }).fill(teamName);
    await addDialog.getByLabel('Short Name', { exact: true }).fill(teamShortName);

    // Save is gated on `!errorFree() || !form.dirty`, so it only enables once both
    // required fields are filled — assert that rather than blind-clicking.
    const saveButton = addDialog.getByRole('button', { name: 'Save' });
    await expect(saveButton).toBeEnabled();

    const createResponse = page.waitForResponse(
      (r) => r.url().endsWith('/api/teams') && r.request().method() === 'POST'
    );
    await saveButton.click();

    // expect: Team is created ...
    const created = await createResponse;
    expect(created.status()).toBe(201);
    const createdTeam: { id: string; name: string; shortName: string; exhibitId: string } =
      await created.json();
    expect(createdTeam.name).toBe(teamName);
    // The dialog seeds `exhibitId` from the `[exhibitId]` input, which is what scopes the
    // new team to this exhibit rather than creating a dangling one.
    expect(createdTeam.exhibitId).toBe(exhibit.id);

    // expect: ... and appears in the team list.
    await expect(addDialog).toHaveCount(0);
    await expect(teamsRegion.getByText(teamName, { exact: true })).toBeVisible();
    await expect(teamsRegion.getByText(teamShortName, { exact: true })).toBeVisible();
    const editButton = teamsRegion.getByRole('button', { name: `Edit ${teamName}` });
    await expect(editButton).toHaveCount(1);

    // 2. Edit the team name.
    createdTeamNames.push(renamedTeamName);
    await editButton.click();

    const editDialog = page.getByRole('dialog');
    await expect(editDialog).toBeVisible();
    // The dialog is pre-populated from the row, proving it opened on *this* team.
    await expect(editDialog.getByLabel('Name', { exact: true })).toHaveValue(teamName);
    await editDialog.getByLabel('Name', { exact: true }).fill(renamedTeamName);

    const updateResponse = page.waitForResponse(
      (r) => r.url().endsWith(`/api/teams/${createdTeam.id}`) && r.request().method() === 'PUT'
    );
    await editDialog.getByRole('button', { name: 'Save' }).click();

    // expect: Team name is updated.
    const updated = await updateResponse;
    expect(updated.status()).toBe(200);
    expect((await updated.json()).name).toBe(renamedTeamName);

    await expect(editDialog).toHaveCount(0);
    await expect(teamsRegion.getByText(renamedTeamName, { exact: true })).toBeVisible();
    await expect(teamsRegion.getByText(teamName, { exact: true })).toHaveCount(0);

    // 3. Delete the team.
    await teamsRegion.getByRole('button', { name: `Delete ${renamedTeamName}` }).click();

    // `deleteTeam` routes through CrucibleDialogService.confirm, so the destructive
    // action is behind an explicit confirmation naming the team.
    const confirmDialog = page.getByRole('dialog');
    await expect(confirmDialog).toBeVisible();
    await expect(confirmDialog).toContainText(renamedTeamName);

    const deleteResponse = page.waitForResponse(
      (r) => r.url().endsWith(`/api/teams/${createdTeam.id}`) && r.request().method() === 'DELETE'
    );
    await confirmDialog.getByRole('button', { name: 'Delete', exact: true }).click();

    const deleted = await deleteResponse;
    expect(deleted.status()).toBe(204);

    // expect: Team is removed from the list.
    await expect(confirmDialog).toHaveCount(0);
    await expect(teamsRegion.getByText(renamedTeamName, { exact: true })).toHaveCount(0);
    await expect(
      teamsRegion.getByRole('button', { name: `Delete ${renamedTeamName}` })
    ).toHaveCount(0);
  });
});
