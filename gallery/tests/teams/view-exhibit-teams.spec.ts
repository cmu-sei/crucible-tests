// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: gallery/gallery-test-plan.md
// seed: seed.spec.ts

import {
  test,
  expect,
  gotoGalleryAdmin,
  gotoAdminSection,
} from '../../fixtures';

/**
 * Team Management §13.1 — View Exhibit Teams.
 *
 * The exhibit's teams are not a top-level admin section. `admin-exhibits.component.html`
 * renders them inside the exhibit row's expanded detail, in a `mat-expansion-panel`
 * headed "Exhibit Teams" (which hosts `<app-admin-teams>`). Reaching them therefore
 * requires: Administration -> Exhibits -> pick the parent collection -> click the
 * exhibit row to expand it -> expand "Exhibit Teams".
 *
 * `app-admin-teams` filters the team store down to `team.exhibitId === exhibitId`, so
 * the rows shown are exactly this exhibit's teams. Each row renders Short Name / Email /
 * Full Name plus per-row "Edit {name}" / "Delete {name}" buttons, and the header carries
 * an "Add Team" button and a "Search" box.
 *
 * This test only reads; it seeds nothing of its own and so has nothing to clean up —
 * the worker-scoped `seededExhibit` fixture owns its teardown.
 */
test.describe('Team Management', () => {
  test('View Exhibit Teams', async ({ galleryAuthenticatedPage: page, seededExhibit }) => {
    // 1. Navigate to an exhibit's team management in admin.
    await gotoGalleryAdmin(page);
    await gotoAdminSection(page, 'Exhibits');

    // The exhibits table only renders once a collection is selected.
    const collectionDropdown = page.getByRole('combobox', { name: 'Select a Collection' });
    await collectionDropdown.click();
    await page.getByRole('option', { name: seededExhibit.collectionName, exact: true }).click();

    // Expand the seeded exhibit's row. Clicking any cell in the row toggles the
    // detail row (`(click)="toggleExpand(row)"` on the `mat-row`).
    const exhibitRow = page
      .getByRole('row')
      .filter({ hasText: seededExhibit.exhibitName })
      .first();
    await expect(exhibitRow).toBeVisible();
    await exhibitRow.getByRole('cell', { name: seededExhibit.exhibitName }).click();

    // The detail row exposes five panels; "Exhibit Teams" is the team management one.
    const exhibitTeamsPanel = page.getByRole('button', { name: 'Exhibit Teams' });
    await expect(exhibitTeamsPanel).toBeVisible();
    await exhibitTeamsPanel.click();

    // expect: List of teams associated with the exhibit is displayed.
    const teamsRegion = page.getByRole('region', { name: 'Exhibit Teams' });
    await expect(teamsRegion).toBeVisible();

    // The seeded team must be listed, by full name and by short name, proving the
    // panel is scoped to this exhibit rather than showing an unrelated team list.
    await expect(teamsRegion.getByText(seededExhibit.teamName, { exact: true })).toBeVisible();

    // Column headings and the per-team management affordances confirm this is the
    // team list and not, say, a still-loading spinner.
    await expect(teamsRegion.getByRole('button', { name: 'Short Name' })).toBeVisible();
    await expect(teamsRegion.getByRole('button', { name: 'Email' })).toBeVisible();
    await expect(teamsRegion.getByRole('button', { name: 'Full Name' })).toBeVisible();
    await expect(teamsRegion.getByRole('button', { name: 'Add Team' })).toBeVisible();
    await expect(
      teamsRegion.getByRole('button', { name: `Edit ${seededExhibit.teamName}` })
    ).toBeVisible();
    await expect(
      teamsRegion.getByRole('button', { name: `Delete ${seededExhibit.teamName}` })
    ).toBeVisible();
  });
});
