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
  apiDeleteCollectionById,
} from '../../fixtures';
import { openExhibitTeamsPanel, teamRowShortNames, teamRowFullNames } from './null-team-helpers';

/**
 * Team Management — searching the Exhibit Teams list with a null-valued team present
 * (regression cover for gallery.ui `5eaa8b2`).
 *
 * `getFilteredTeams()`'s predicate in `admin-teams.component.ts` used to read
 * `a.shortName.toLowerCase().includes(...) || a.name.toLowerCase().includes(...)` with
 * neither field guarded. Both are nullable, so a team missing either one throws
 * `TypeError: Cannot read properties of null (reading 'toLowerCase')` — but only once
 * `this.filterString` is non-empty, since the predicate is skipped entirely for an empty
 * filter. That is why this spec must type a search term: the bug is unreachable without
 * one, and a spec that only loaded the panel would pass pre-fix.
 *
 * As with the sort bug, the blast radius is the whole list: the exception propagates out
 * of `Array.prototype.filter` before `sortedTeams` is reassigned, so the `@for` loop
 * renders nothing. Hence the assertions check that the expected row is *present*, not
 * merely that no exception surfaced.
 *
 * The interesting half of the fix is that guarding must not turn into dropping. The two
 * fields are tested as independent OR branches, so a team with a null `name` still
 * lowercases its `shortName` and can match on that branch — the null branch is
 * neutralised to non-matching, and critically does not short-circuit the other. The
 * central assertion below therefore searches for the null-name team's `shortName` and
 * requires it to match. A fix that merely stopped the throw by skipping null-valued
 * teams would satisfy "nothing crashed" but fail this.
 *
 * The mirror case matters too: `shortName` is nullable on its own, and pre-fix it was
 * the *first* term in the expression, so a team with a null `shortName` threw before the
 * name branch was ever evaluated. A second team covers that direction.
 *
 * This spec seeds its own collection and exhibit rather than using the worker-scoped
 * `seededExhibit`, because the team store is global and injecting malformed teams into
 * the shared exhibit would perturb `view-exhibit-teams` and `team-selector`.
 */
test.describe('Team Management', () => {
  // Recorded as soon as the collection exists so `afterEach` removes it even when the
  // test body throws partway through. Exhibit.CollectionId and Team.ExhibitId are both
  // DeleteBehavior.Cascade, so deleting the collection removes the exhibit and its teams.
  let collectionId: string | undefined;

  test.afterEach(async () => {
    if (collectionId) {
      await apiDeleteCollectionById(collectionId, 'Null Name Team Filter Test collection');
    }
    collectionId = undefined;
  });

  test('Searching Exhibit Teams tolerates a team with no name or no short name', async ({
    galleryAuthenticatedPage: page,
  }) => {
    const suffix = `${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
    const collection = await apiCreateCollection(`Null Name Team Filter Test ${suffix}`);
    collectionId = collection.id;
    const exhibit = await apiCreateExhibit(collectionId, `Null Name Filter Exhibit ${suffix}`);

    // Every seeded value carries the same unique `suffix`, so a search for the suffix
    // alone matches all three teams and nothing any concurrently-running spec seeded.
    const nullNameShortName = `NONAME-${suffix}`;
    const nullShortNameFullName = `No Short Name ${suffix}`;
    const bothSetShortName = `BOTH-${suffix}`;
    const bothSetFullName = `Both Fields ${suffix}`;

    await apiCreateTeam(exhibit.id, { name: bothSetFullName, shortName: bothSetShortName });
    // Null `name`, real `shortName` — must still be findable via the shortName branch.
    await apiCreateTeam(exhibit.id, { name: null, shortName: nullNameShortName });
    // Null `shortName`, real `name` — pre-fix this threw on the *first* term.
    await apiCreateTeam(exhibit.id, { name: nullShortNameFullName, shortName: null });

    await gotoGalleryAdmin(page);
    await gotoAdminSection(page, 'Exhibits');
    const teamsRegion = await openExhibitTeamsPanel(page, collection.name, exhibit.name);

    // The search input is bound to a reactive `formControl` whose `valueChanges`
    // subscription re-runs `getFilteredTeams()`, so `fill()` alone drives the filter.
    const searchBox = teamsRegion.getByRole('textbox', { name: 'Search' });

    // Baseline: all three teams render with no filter applied. The default sort is
    // shortName-ascending, and a null shortName lowercases to '' and sorts first.
    await expect(teamRowShortNames(teamsRegion)).toHaveText([
      '',
      bothSetShortName,
      nullNameShortName,
    ]);

    // 1. Filter by the null-name team's short name.
    await searchBox.fill(nullNameShortName);

    // expect: exactly that team is listed. Pre-fix, the predicate threw on its null
    // `name` and the list rendered zero rows; a "guard by skipping nulls" fix would
    // also render zero rows here. Only a fix that evaluates the shortName branch
    // independently produces this row.
    await expect(teamRowShortNames(teamsRegion)).toHaveText([nullNameShortName]);
    // Its Full Name cell is present but empty — the row really is the null-name team,
    // not some other record that happens to share the search string.
    await expect(teamRowFullNames(teamsRegion)).toHaveText(['']);

    // 2. Filter by the full name of the team whose `shortName` is null. Pre-fix this
    //    threw on `a.shortName.toLowerCase()`, the leading term, before the name branch
    //    was reached — so it fails for a different reason than step 1 and is worth
    //    asserting separately.
    await searchBox.fill(nullShortNameFullName);
    await expect(teamRowFullNames(teamsRegion)).toHaveText([nullShortNameFullName]);
    await expect(teamRowShortNames(teamsRegion)).toHaveText(['']);

    // 3. A filter broad enough to match all three teams runs the predicate over every
    //    null-valued row in one pass, which is the state the admin UI is actually in
    //    when someone types a partial name. Both null-valued teams and the fully
    //    populated one must survive it.
    await searchBox.fill(suffix);
    await expect(teamRowShortNames(teamsRegion)).toHaveText([
      '',
      bothSetShortName,
      nullNameShortName,
    ]);

    // 4. A filter matching nothing must yield an empty list rather than an error — this
    //    pins the difference between "correctly filtered to zero" and the pre-fix
    //    "crashed to zero" that step 1 detects. Paired with step 3 it shows the empty
    //    result tracks the search term rather than being the component's failure mode.
    await searchBox.fill(`ZZZ-NO-SUCH-TEAM-${suffix}`);
    await expect(teamRowShortNames(teamsRegion)).toHaveCount(0);

    // 5. Clearing the search restores all three rows, proving the component survived
    //    every step above with a live subscription rather than being left wedged.
    await teamsRegion.getByRole('button', { name: 'Clear Search' }).click();
    await expect(teamRowShortNames(teamsRegion)).toHaveText([
      '',
      bothSetShortName,
      nullNameShortName,
    ]);
  });
});
