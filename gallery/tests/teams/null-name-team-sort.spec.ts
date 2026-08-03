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
 * Team Management — sorting the Exhibit Teams list by Full Name with a null-name team
 * present.
 *
 * Pending upstream: `admin-teams`' sort comparator must guard a null `name`. This spec
 * asserts the guarded behaviour, so it fails until that change reaches the Gallery UI build
 * under test.
 *
 * `Team.Name` is nullable in the API (`Gallery.Api.Data/Models/Team.cs`) and the
 * generated Angular client types it `string | null | undefined`, so a team really can
 * carry a null name. `admin-teams.component.ts`'s `sortTeams()` compares
 * `a.name.toLowerCase() < b.name.toLowerCase()` unguarded in its `case 'name'`, which
 * throws `TypeError: Cannot read properties of null (reading 'toLowerCase')` the moment
 * such a team reaches the comparator.
 *
 * The failure is not confined to the offending row. `getSortedTeams()` sorts the whole
 * array in place and the exception escapes `Array.prototype.sort`, so `sortedTeams` is
 * never assigned and the `@for (team of sortedTeams; ...)` loop renders **nothing** — the
 * entire list disappears, not just the offending row. It is confined to the exhibit that
 * holds the null-name team, though: `getFilteredTeams()` filters on
 * `t.exhibitId === this.exhibitId` *before* the array reaches the comparator, so a sibling
 * exhibit's panel never sees the bad row. That is why the assertions below check both that
 * rows are present *and* that the null-name team is among them: "list is non-empty" is what
 * regresses, and "the null-name row is still listed" is what proves the guard neutralises
 * the null rather than dropping the record.
 *
 * `mat-sort-header="name"` sits on the "Full Name" header (`admin-teams.component.html`),
 * so one click on it reaches the comparator. Three teams are seeded — two named, one
 * null-named — because a comparator only runs when there is more than one element to
 * compare, and because with two named teams the resulting order is observable rather
 * than trivially correct.
 *
 * This spec seeds its own collection and exhibit rather than using the worker-scoped
 * `seededExhibit`: the team store is global and this spec's whole point is to put a
 * deliberately malformed team into it, which would perturb `view-exhibit-teams` and
 * `team-selector` if it landed on the shared exhibit.
 */
test.describe('Team Management', () => {
  // Recorded as soon as the collection exists so `afterEach` removes it even when the
  // test body throws partway through. Exhibit.CollectionId and Team.ExhibitId are both
  // configured DeleteBehavior.Cascade, so deleting the collection removes the exhibit
  // and every team seeded on it.
  let collectionId: string | undefined;

  test.afterEach(async () => {
    if (collectionId) {
      await apiDeleteCollectionById(collectionId, 'Null Name Team Sort Test collection');
    }
    collectionId = undefined;
  });

  test('Sorting Exhibit Teams by Full Name tolerates a team with no name', async ({
    galleryAuthenticatedPage: page,
  }) => {
    const suffix = `${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
    const collection = await apiCreateCollection(`Null Name Team Sort Test ${suffix}`);
    collectionId = collection.id;
    const exhibit = await apiCreateExhibit(collectionId, `Null Name Sort Exhibit ${suffix}`);

    // Short names are chosen so the default shortName-ascending order (AAA, BBB, CCC)
    // differs from Full-Name-ascending order — the null name lowercases to '' and so
    // sorts first, ahead of "Alpha" and "Zulu". If the click were a no-op the row order
    // below would not change, so the order assertion also proves the sort really ran.
    const nullNameShortName = `CCC-${suffix}`;
    const alphaName = `Alpha Named ${suffix}`;
    const zuluName = `Zulu Named ${suffix}`;
    await apiCreateTeam(exhibit.id, { name: zuluName, shortName: `AAA-${suffix}` });
    await apiCreateTeam(exhibit.id, { name: alphaName, shortName: `BBB-${suffix}` });
    // The team under test: a real record whose `name` is null.
    await apiCreateTeam(exhibit.id, { name: null, shortName: nullNameShortName });

    await gotoGalleryAdmin(page);
    await gotoAdminSection(page, 'Exhibits');
    const teamsRegion = await openExhibitTeamsPanel(page, collection.name, exhibit.name);

    // Baseline: all three teams render before the sort is touched. Establishing this
    // first separates "the comparator broke the list" from "the list never loaded",
    // which would otherwise both look like zero rows.
    await expect(teamRowShortNames(teamsRegion)).toHaveText([
      `AAA-${suffix}`,
      `BBB-${suffix}`,
      nullNameShortName,
    ]);

    // 1. Click the "Full Name" column header to sort by `name`.
    await teamsRegion.getByRole('button', { name: 'Full Name' }).click();

    // expect: the list still renders every team. Unguarded, the comparator throws and
    // `sortedTeams` is never reassigned, leaving the @for loop with nothing to render.
    // Asserting the exact expected order (null name first, then Alpha, then Zulu) is
    // strictly stronger than a count: it fails on an empty list, on a dropped row, and
    // on a sort that silently did not happen.
    await expect(teamRowFullNames(teamsRegion)).toHaveText(['', alphaName, zuluName]);

    // expect: the null-name team is still one of those rows, identified by the
    // shortName it does carry. This is the assertion that would fail if the fix had
    // filtered null-name teams out instead of ordering them.
    await expect(teamsRegion.getByText(nullNameShortName, { exact: true })).toBeVisible();

    // Sorting descending re-enters the same comparator with the arguments reversed, so
    // it exercises the `b.name` side of the original unguarded expression too.
    await teamsRegion.getByRole('button', { name: 'Full Name' }).click();
    await expect(teamRowFullNames(teamsRegion)).toHaveText([zuluName, alphaName, '']);
    await expect(teamsRegion.getByText(nullNameShortName, { exact: true })).toBeVisible();
  });
});
