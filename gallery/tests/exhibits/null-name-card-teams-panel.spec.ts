// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: gallery/gallery-test-plan.md
// seed: seed.spec.ts

import { type Locator, type Page } from '@playwright/test';
import {
  test,
  expect,
  gotoGalleryAdmin,
  gotoAdminSection,
  apiCreateCollection,
  apiCreateExhibit,
  apiCreateTeam,
  apiCreateCard,
  apiCreateTeamCard,
  apiDeleteCollectionById,
} from '../../fixtures';
import { waitForFirstVisible } from '../../../shared-fixtures';

/**
 * Exhibit Management — the "Card Teams" sub-panel of an expanded exhibit row tolerates a
 * team or a card whose `name` is null.
 *
 * Pending upstream: `admin-team-cards`' sort comparator and search predicate must guard a
 * null team name and a null card name. This spec asserts the guarded behaviour, so it fails
 * until that change reaches the Gallery UI build under test.
 *
 * `admin-team-cards.component.ts` renders one row per TeamCard, resolving the display
 * text through `getTeamName(teamId)` / `getCardName(cardId)`. Both helpers return the
 * found record's `name` verbatim, so both return `null` when that record's name is null —
 * and `Team.Name` and `Card.Name` are both nullable with no `[Required]`
 * (`Gallery.Api.Data/Models/Team.cs`, `.../Card.cs`). Four call sites lowercase those
 * results unguarded:
 *
 *   - `applyFilter`'s predicate, on both the team and the card name — wired to this
 *     panel's Search box (`admin-team-cards.component.html:36`).
 *   - the `teamId` and `cardId` cases of `sortTeamCards` — wired to the "Team" and "Card"
 *     column headers, which are `mat-sort-header="teamId"` / `="cardId"`
 *     (`admin-team-cards.component.html:54-55`).
 *
 * Any of them throws `TypeError: Cannot read properties of null (reading 'toLowerCase')`
 * as soon as such a record reaches it, and the exception escapes `Array.prototype.filter`
 * / `.sort()` before `filteredTeamCardList` is reassigned — so the
 * `@for (teamCard of filteredTeamCardList; ...)` loop renders **zero rows**. The rows do
 * not degrade; the list disappears.
 *
 * **The observed symptom is worse than an empty list, which is why
 * `openCardTeamsPanel` races an error sheet.** `ErrorService` is registered as Angular's
 * global `ErrorHandler` (`app.module.ts`) and turns any uncaught error into a *modal*
 * `MatBottomSheet` (`SystemMessageService.displayMessage`) titled with the error's name.
 * That sheet `aria-hidden`s the whole admin page, so the practical failure is not "the
 * Card Teams list is empty" but "the entire Administration screen is inert behind a
 * TypeError dialog" — reached just by expanding the exhibit row, before the Card Teams
 * sub-panel is even opened, because `<app-admin-team-cards>` is inside the detail row's
 * markup and its `ngOnInit` runs regardless of the sub-panel's collapsed state.
 *
 * **Why the two paths cannot be separated while unguarded, and what that means for these
 * tests.** Unlike `admin-teams`'s `getFilteredTeams()`, `applyFilter` here has no early exit
 * for an empty filter string — it calls both helpers on every TeamCard on every invocation,
 * and `ngOnInit` plus the `teamCardQuery.selectAll()` subscription invoke it as soon as the
 * panel's data arrives. So the crash happens before any header is clicked or anything is
 * typed, and the sort comparator is unreachable as an *independent* trigger: it takes the
 * same two helpers over the same records, so nothing crashes the comparator that has not
 * already crashed the predicate one statement earlier. Both tests below therefore fail at
 * the same place — `openCardTeamsPanel`, on the error sheet.
 *
 * That is a real failure, but on its own it would leave the two `sortTeamCards` cases
 * uncovered — a change that guarded only `applyFilter` would still pass a spec that merely
 * opened the panel. Hence the sort test asserts the **exact row order** after each header
 * click, in both directions, for both columns. That was verified by building a bundle with
 * *only* the two sort cases unguarded, keeping the filter guard: the panel then opens and
 * loads all three rows, the filter test passes in full, and the sort test fails on the first
 * order assertion after the "Team" header click — the comparator throws inside `.sort()`,
 * `filteredTeamCardList` is never reassigned, and the row locator resolves to 0 elements
 * with the error sheet up. So the sort path and the filter path are independently covered.
 *
 * **Blast radius.** `admin-teams` filters its list by `t.exhibitId === this.exhibitId`
 * before sorting; this component does no such filtering — it renders `teamCardQuery`,
 * `cardQuery` and `teamQuery` wholesale. What scopes it in practice is the loaders, which
 * `set()` (replace) each store per expanded exhibit. The card store is the loose one:
 * `cardDataService.loadByExhibit` returns every card in the exhibit's *collection*, so a
 * single null-named card blanks the Card Teams panel of every exhibit in that collection,
 * not just the one it is wired to.
 *
 * Both tests seed their own collection, exhibit, teams and cards rather than using the
 * worker-scoped `seededExhibit`: the team and card stores are global, and injecting
 * deliberately malformed records into the shared exhibit would perturb
 * `view-exhibit-teams`, `team-selector` and the `cards/` specs.
 */

/**
 * The app's global error sheet, if one is open, rendered as `"Title: body"`.
 *
 * `ErrorService` is registered as Angular's `ErrorHandler` (`app.module.ts`) and routes
 * every uncaught error to `SystemMessageService.displayMessage`, which opens a modal
 * `MatBottomSheet` carrying the error's `name` as an `<h2>` and its `message` in
 * `.messagebody`. Because the sheet is modal it `aria-hidden`s the page behind it, so
 * every role-based locator underneath stops resolving — which turns the interesting
 * failure ("a TypeError was raised") into a generic "element(s) not found" or "resolved to
 * 0 elements". This reads the sheet so the tests can report what actually happened.
 *
 * `isVisible()` does not wait, so calling this on a failure path costs nothing.
 */
async function appErrorSheetText(page: Page): Promise<string | null> {
  const sheet = page.locator('mat-bottom-sheet-container');
  if (!(await sheet.isVisible().catch(() => false))) {
    return null;
  }
  const title = await sheet.locator('h2').innerText().catch(() => '(unknown)');
  const body = await sheet.locator('.messagebody').innerText().catch(() => '');
  return `${title.trim()}: ${body.trim()}`;
}

/**
 * Run `fn`, and if it fails while the app's error sheet is open, re-throw with the sheet's
 * contents attached.
 *
 * Used around the sort and search assertions. A failed comparator or predicate does not
 * merely leave the list unsorted or unfiltered: the `TypeError` escapes `.sort()` /
 * `.filter()` up to the global `ErrorHandler`, which opens the modal sheet — so the raw
 * assertion failure is a locator that suddenly resolves to 0 elements rather than a wrong
 * order. Without this wrapper that reads as a flaky selector instead of the behaviour under
 * test. Confirmed against a bundle with only the sort cases unguarded, where the wrapped
 * failure reports the TypeError alongside the underlying order mismatch.
 */
async function withAppErrorDiagnostic<T>(page: Page, fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (err) {
    const sheetText = await appErrorSheetText(page);
    if (sheetText) {
      throw new Error(
        `The Card Teams list raised an application error: "${sheetText}". Expected cause: ` +
          `a null team or card name reaching an unguarded ` +
          `admin-team-cards.component.ts sortTeamCards/applyFilter. Underlying ` +
          `assertion failure: ${(err as Error).message}`
      );
    }
    throw err;
  }
}

/** Every TeamCard row currently rendered in the Card Teams panel, in render order. */
function teamCardRows(region: Locator): Locator {
  return region.locator('mat-expansion-panel-header');
}

/**
 * The Team column of every row, in render order.
 *
 * `admin-team-cards.component.html` lays each row out as a `mat-expansion-panel-header`
 * holding `.cell.two-cell` (the Edit/Delete buttons), then two `.cell.five-cell` divs for
 * Team and Card, then four `.cell.one-cell` divs. Team and Card share a class, so they
 * are told apart by position among their sibling divs. The column headers use
 * `.header-cell`, not `.cell`, so these selectors pick up data rows only.
 *
 * A row whose resolved name is null renders as an empty cell rather than being omitted,
 * which is what lets `toHaveText([...])` tell "row present, name empty" from "row gone".
 */
function rowTeamNames(scope: Locator): Locator {
  return scope.locator('mat-expansion-panel-header .cell.five-cell:nth-of-type(2)');
}

/** The Card column of every row, in render order. See `rowTeamNames`. */
function rowCardNames(scope: Locator): Locator {
  return scope.locator('mat-expansion-panel-header .cell.five-cell:nth-of-type(3)');
}

/** The Team / Card cell of a single already-located row. */
function cellTeamName(row: Locator): Locator {
  return row.locator('.cell.five-cell:nth-of-type(2)');
}
function cellCardName(row: Locator): Locator {
  return row.locator('.cell.five-cell:nth-of-type(3)');
}

interface SeededPanel {
  collectionId: string;
  collectionName: string;
  exhibitName: string;
  suffix: string;
  /** Team names. `nullTeam` has `name: null` and is identified by its card instead. */
  alphaTeamName: string;
  zuluTeamName: string;
  /** Card names. `nullCard` has `name: null` and is identified by its team instead. */
  alphaCardName: string;
  zuluCardName: string;
}

/**
 * Seed a collection + exhibit carrying three TeamCards, one of which resolves to a null
 * team name and one to a null card name.
 *
 *   TC1  team "Zulu Team …"   card "Alpha Card …"   — both names present
 *   TC2  team null            card "Zulu Card …"    — the null *team* name
 *   TC3  team "Alpha Team …"  card null             — the null *card* name
 *
 * The pairing is deliberately crossed so Team-ascending order (TC2, TC3, TC1) differs
 * from Card-ascending order (TC3, TC1, TC2) and from each other's reverse. A header click
 * that silently did not run, or a comparator that never reassigned the list, therefore
 * shows up as a wrong order rather than passing by coincidence.
 *
 * It also gives each null-valued row a populated value in the *other* column, which is
 * what makes the search assertions meaningful: the row has something left to match on.
 */
async function seedCardTeamsPanel(label: string): Promise<SeededPanel> {
  const suffix = `${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
  const collection = await apiCreateCollection(`${label} ${suffix}`);
  const exhibit = await apiCreateExhibit(collection.id, `${label} Exhibit ${suffix}`);

  const alphaTeamName = `Alpha Team ${suffix}`;
  const zuluTeamName = `Zulu Team ${suffix}`;
  const alphaCardName = `Alpha Card ${suffix}`;
  const zuluCardName = `Zulu Card ${suffix}`;

  const alphaTeam = await apiCreateTeam(exhibit.id, {
    name: alphaTeamName,
    shortName: `AT-${suffix}`,
  });
  const zuluTeam = await apiCreateTeam(exhibit.id, {
    name: zuluTeamName,
    shortName: `ZT-${suffix}`,
  });
  // The team under test: a real record whose `name` is null.
  const nullTeam = await apiCreateTeam(exhibit.id, { name: null, shortName: `NT-${suffix}` });

  const alphaCard = await apiCreateCard(collection.id, alphaCardName);
  const zuluCard = await apiCreateCard(collection.id, zuluCardName);
  // The card under test. Verified live: POST /api/cards answers 201 for an explicit null
  // name and GET /api/collections/{id}/cards reads it back as null, so both halves of the
  // scenario (team name and card name) are reachable through the API.
  const nullCard = await apiCreateCard(collection.id, null);

  await apiCreateTeamCard(zuluTeam.id, alphaCard.id);
  await apiCreateTeamCard(nullTeam.id, zuluCard.id);
  await apiCreateTeamCard(alphaTeam.id, nullCard.id);

  return {
    collectionId: collection.id,
    collectionName: collection.name,
    exhibitName: exhibit.name,
    suffix,
    alphaTeamName,
    zuluTeamName,
    alphaCardName,
    zuluCardName,
  };
}

/**
 * Open an exhibit's "Card Teams" panel and return the panel's region locator.
 *
 * Card Teams is not a top-level admin section: it lives inside the exhibit row's expanded
 * detail (`admin-exhibits.component.html`), as the sibling of "Exhibit Teams". So a
 * collection must be selected before the exhibits table renders at all, the exhibit row
 * must be clicked to expand it (`toggleExpand`, which also fires
 * `teamDataService.loadByExhibitId` and populates the team store the panel reads), and
 * only then can the sub-panel be expanded.
 *
 * Assumes the caller has already reached the admin area (`gotoGalleryAdmin`).
 */
async function openCardTeamsPanel(
  page: Page,
  collectionName: string,
  exhibitName: string
): Promise<Locator> {
  await gotoAdminSection(page, 'Exhibits');

  const collectionDropdown = page.getByRole('combobox', { name: 'Select a Collection' });
  await collectionDropdown.click();
  const option = page.getByRole('option', { name: collectionName, exact: true });
  await expect(option).toBeVisible();
  await option.click();

  const exhibitRow = page.getByRole('row').filter({ hasText: exhibitName }).first();
  await expect(exhibitRow).toBeVisible();
  await exhibitRow.getByRole('cell', { name: exhibitName }).click();

  // `exact: true` is required, not cosmetic. Every action button in the exhibit row is
  // titled "Edit/Copy/Download/Delete {{ exhibit.name }}", so a substring match on the
  // panel header's name also matches those four buttons for any exhibit whose name
  // happens to contain the phrase. The seeded names below deliberately avoid it as well.
  const cardTeamsHeader = page.getByRole('button', { name: 'Card Teams', exact: true });

  // Race the panel header against the app's global error sheet. Expanding the exhibit row
  // is already enough to trip the unguarded code: `<app-admin-team-cards>` sits inside the
  // detail row's markup, so its `ngOnInit` runs even while the sub-panel is collapsed, and
  // `applyFilter` throws as soon as `loadByExhibit`'s data lands. `ErrorService`
  // (registered as Angular's `ErrorHandler` in `app.module.ts`) catches that and opens a
  // *modal* `MatBottomSheet`, which `aria-hidden`s the rest of the page — so the header
  // below is not merely unclicked, it is unreachable, and a bare `toBeVisible()` would
  // fail with an unhelpful "element(s) not found". This branch reports the sheet's actual
  // title and message instead, which is the TypeError this spec exists to detect.
  const winner = await waitForFirstVisible(
    page,
    [
      { key: 'panel', locator: cardTeamsHeader },
      { key: 'error', locator: page.locator('mat-bottom-sheet-container') },
    ],
    { timeout: 15000 }
  );
  if (winner === 'error') {
    throw new Error(
      `Expanding the exhibit row raised an application error instead of rendering the ` +
        `Card Teams panel: "${await appErrorSheetText(page)}". Expected cause: a null team ` +
        `or card name reaching an unguarded admin-team-cards.component.ts ` +
        `applyFilter/sortTeamCards.`
    );
  }
  expect(winner, 'neither the Card Teams panel nor an error sheet appeared').toBe('panel');

  await cardTeamsHeader.click();

  const region = page.getByRole('region', { name: 'Card Teams' });
  await expect(region).toBeVisible();
  return region;
}

/**
 * Assert the panel has loaded all three seeded rows, without depending on their order.
 *
 * The component's initial `sort` is `{ active: 'team', ... }` — a column id that
 * `sortTeamCards` does not handle, so its `default: return 0` makes the initial sort a
 * no-op and the render order is whatever `GET /api/exhibits/{id}/teamcards` returned
 * (that query has no `ORDER BY`). Asserting an exact order here would be asserting
 * database order.
 *
 * Each row is pinned by the one seeded value unique to it, which incidentally proves both
 * stores are populated: two rows show a non-empty Team name and two a non-empty Card
 * name, so neither `getTeamName` nor `getCardName` is merely returning its
 * record-not-found `' '` fallback for everything — a state that would otherwise be
 * indistinguishable from a null name, since both normalise to '' in the DOM.
 */
async function expectAllThreeRowsLoaded(region: Locator, seeded: SeededPanel): Promise<void> {
  const rows = teamCardRows(region);
  await expect(rows).toHaveCount(3);

  const bothPresentRow = rows.filter({ hasText: seeded.zuluTeamName });
  const nullTeamNameRow = rows.filter({ hasText: seeded.zuluCardName });
  const nullCardNameRow = rows.filter({ hasText: seeded.alphaTeamName });

  await expect(bothPresentRow).toHaveCount(1);
  await expect(cellCardName(bothPresentRow)).toHaveText(seeded.alphaCardName);

  // The null-team-name row, identified by the card name it does carry.
  await expect(nullTeamNameRow).toHaveCount(1);
  await expect(cellTeamName(nullTeamNameRow)).toHaveText('');

  // The null-card-name row, identified by the team name it does carry.
  await expect(nullCardNameRow).toHaveCount(1);
  await expect(cellCardName(nullCardNameRow)).toHaveText('');
}

test.describe('Exhibit Management', () => {
  // Recorded as soon as the collection exists so `afterEach` removes it even when the
  // test body throws partway through. Exhibit.CollectionId, Team.ExhibitId and
  // Card.CollectionId are all DeleteBehavior.Cascade, and a TeamCard cascades with its
  // team, so deleting the collection removes the exhibit, the teams, the cards and the
  // TeamCards in one call.
  let collectionId: string | undefined;

  test.afterEach(async () => {
    if (collectionId) {
      await apiDeleteCollectionById(collectionId, 'Null Name TC Test collection');
    }
    collectionId = undefined;
  });

  test('Sorting Card Teams tolerates a team or card with no name', async ({
    galleryAuthenticatedPage: page,
  }) => {
    const seeded = await seedCardTeamsPanel('Null Name TC Sort Test');
    collectionId = seeded.collectionId;

    await gotoGalleryAdmin(page);
    const region = await openCardTeamsPanel(page, seeded.collectionName, seeded.exhibitName);

    // Baseline. While the helpers are unguarded both tests fail before reaching here, inside
    // `openCardTeamsPanel`: `applyFilter` runs unconditionally when the panel's data lands
    // and throws on the first null name it meets, so the error sheet is already up.
    await expectAllThreeRowsLoaded(region, seeded);

    const teamHeader = region.getByRole('button', { name: 'Team', exact: true });
    const cardHeader = region.getByRole('button', { name: 'Card', exact: true });

    await withAppErrorDiagnostic(page, async () => {
      // 1. Sort by Team ascending. `mat-sort-header="teamId"` starts at 'asc'.
      await teamHeader.click();

      // expect: every row still renders, ordered by team name with the null one first (it
      // falls back to '', which is lexically first). Asserting the exact order is strictly
      // stronger than a row count: it also fails on a dropped row, and on a comparator
      // that threw and left the previous, unsorted list in place.
      await expect(rowTeamNames(region)).toHaveText([
        '',
        seeded.alphaTeamName,
        seeded.zuluTeamName,
      ]);
      // The Card column pins which rows those are, so "the null-name row is still listed"
      // is checked by identity and not just by an empty cell appearing somewhere.
      await expect(rowCardNames(region)).toHaveText([
        seeded.zuluCardName,
        '',
        seeded.alphaCardName,
      ]);

      // 2. Sort by Team descending. The comparator is re-entered with its arguments
      //    swapped, so this exercises the `b.getTeamName()` side of the original
      //    expression.
      await teamHeader.click();
      await expect(rowTeamNames(region)).toHaveText([
        seeded.zuluTeamName,
        seeded.alphaTeamName,
        '',
      ]);
      await expect(rowCardNames(region)).toHaveText([
        seeded.alphaCardName,
        '',
        seeded.zuluCardName,
      ]);

      // 3. Sort by Card ascending. This is the second, independent call site
      //    (`case 'cardId'`, using `getCardName`) and it is the null *card* name that has
      //    to survive it. Switching the active column resets MatSort's direction to 'asc'.
      await cardHeader.click();
      await expect(rowCardNames(region)).toHaveText([
        '',
        seeded.alphaCardName,
        seeded.zuluCardName,
      ]);
      await expect(rowTeamNames(region)).toHaveText([
        seeded.alphaTeamName,
        seeded.zuluTeamName,
        '',
      ]);

      // 4. Sort by Card descending, for the `b.getCardName()` side.
      await cardHeader.click();
      await expect(rowCardNames(region)).toHaveText([
        seeded.zuluCardName,
        seeded.alphaCardName,
        '',
      ]);
      await expect(rowTeamNames(region)).toHaveText([
        '',
        seeded.zuluTeamName,
        seeded.alphaTeamName,
      ]);
    });
  });

  test('Searching Card Teams tolerates a team or card with no name', async ({
    galleryAuthenticatedPage: page,
  }) => {
    const seeded = await seedCardTeamsPanel('Null Name TC Filter Test');
    collectionId = seeded.collectionId;

    await gotoGalleryAdmin(page);
    const region = await openCardTeamsPanel(page, seeded.collectionName, seeded.exhibitName);

    await expectAllThreeRowsLoaded(region, seeded);

    // The panel's Search input is bound to a reactive `filterControl` whose `valueChanges`
    // subscription calls `applyFilter`, so `fill()` alone drives the filter.
    const searchBox = region.getByRole('textbox', { name: 'Search' });

    await withAppErrorDiagnostic(page, async () => {
      // 1. Search for the card name of the row whose *team* name is null.
      await searchBox.fill(seeded.zuluCardName);

      // expect: exactly that row. This is the load-bearing assertion of this test. The two
      // names are independent OR branches, so a correct guard neutralises only the null one
      // and still evaluates the other — whereas a "fix" that stopped the throw by skipping
      // records with a null name would render zero rows here and so satisfy "nothing
      // crashed" while quietly breaking search.
      await expect(rowCardNames(region)).toHaveText([seeded.zuluCardName]);
      await expect(rowTeamNames(region)).toHaveText(['']);

      // 2. The mirror case: search for the team name of the row whose *card* name is null.
      //    A guard applied to only one of the two names would pass step 1 and fail here.
      await searchBox.fill(seeded.alphaTeamName);
      await expect(rowTeamNames(region)).toHaveText([seeded.alphaTeamName]);
      await expect(rowCardNames(region)).toHaveText(['']);

      // 3. A term broad enough to match all three rows runs the predicate over both
      //    null-valued rows in a single pass, which is the state the panel is actually in
      //    while someone types a partial name. Every seeded value carries the same unique
      //    suffix, so this matches all three rows and nothing another spec seeded.
      await searchBox.fill(seeded.suffix);
      await expect(teamCardRows(region)).toHaveCount(3);
      await expect(teamCardRows(region).filter({ hasText: seeded.zuluCardName })).toHaveCount(1);
      await expect(teamCardRows(region).filter({ hasText: seeded.alphaTeamName })).toHaveCount(1);

      // 4. A term matching nothing must yield an empty list rather than an error. Paired
      //    with step 3 this pins the difference between "correctly filtered to zero" and
      //    an unguarded "crashed to zero": the empty result tracks the search term instead
      //    of being the component's failure mode.
      await searchBox.fill(`ZZZ-NO-SUCH-TEAM-CARD-${seeded.suffix}`);
      await expect(teamCardRows(region)).toHaveCount(0);

      // 5. Clearing the search restores all three rows, showing the component came through
      //    every step above with a live subscription rather than being left wedged.
      await region.getByRole('button', { name: 'Clear Search' }).click();
      await expectAllThreeRowsLoaded(region, seeded);
    });
  });
});
