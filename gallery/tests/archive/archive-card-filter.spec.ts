// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: gallery/gallery-test-plan.md
// seed: seed.spec.ts

import {
  test,
  expect,
  gotoExhibitSection,
  apiSetExhibitMoveAndInject,
  openMatSelect,
} from '../../fixtures';

/**
 * Archive Functionality §4.4 — Archive Card Filtering.
 *
 * The exhibit is moved to (1, 1) so all three seeded cards have released articles and
 * therefore appear in the card dropdown. `afterEach` restores (0, 0) because move/inject
 * is persistent state on the worker-scoped `seededExhibit`.
 *
 * Assertions are scoped to the seeded article names: the Archive's article store is not
 * scoped to the exhibit, so a UserArticle created for the same user in another exhibit
 * while this page is open is pushed into the list by SignalR (pending upstream:
 * `signalr.service.ts#addUserArticleHandlers` accepts UserArticle events for exhibits
 * other than the one being viewed).
 */
const SEEDED_ARTICLE = /^(Intel|Reporting|Orders|News|Social|Email) Article 1$/;

/** Default order at (1, 1): descending move, then inject, then datePosted. */
const ALL_SEEDED_IN_ORDER = [
  'Email Article 1',
  'Orders Article 1',
  'Social Article 1',
  'Reporting Article 1',
  'News Article 1',
  'Intel Article 1',
];

test.describe('Archive Functionality', () => {
  test.afterEach(async ({ seededExhibit }) => {
    await apiSetExhibitMoveAndInject(seededExhibit.exhibitId, 0, 0);
  });

  test('Archive Card Filtering', async ({ galleryAuthenticatedPage: page, seededExhibit }) => {
    await apiSetExhibitMoveAndInject(seededExhibit.exhibitId, 1, 1);
    await gotoExhibitSection(page, seededExhibit.exhibitId, 'archive');
    await expect(page).toHaveTitle(/Gallery Archive/);

    const articleCards = page.locator('section.cards mat-card');
    const titles = articleCards.locator('.article-title').filter({ hasText: SEEDED_ARTICLE });
    await expect(titles).toHaveText(ALL_SEEDED_IN_ORDER);

    // 1. Click the 'All Cards' dropdown.
    // openMatSelect rather than a bare click on the trigger: each reopen below would
    // otherwise race the previous panel's exit animation, which fails consistently on
    // Firefox. See the helper for the mechanism.
    const cardFilter = page.getByRole('combobox');
    await expect(cardFilter).toHaveText('All Cards');
    let options = (await openMatSelect(cardFilter)).getByRole('option');

    // expect: A list of available cards is displayed — 'All Cards' plus one option per
    // seeded card.
    //
    // Asserted as a set, not a sequence: the application does not specify the card
    // order here. `setCardLists()` (archive.component.ts) builds `showCardList` by
    // iterating `teamCardList`, which carries the response order of
    // `TeamCardService.GetByExhibitAsync` — a query with no OrderBy at all, so
    // Postgres may return those rows in any order, and does once another test UPDATEs
    // one of them (apiSetTeamCardShownOnWall rewrites the tuple, moving it in the
    // heap). An earlier version asserted the literal sequence ['All Cards',
    // 'Test Card 1', 'Test Card 2', 'Test Card 3'] and failed intermittently with the
    // cards in 2, 1, 3 order.
    // 'All Cards' is a static first <mat-option> in the template, so unlike the card
    // options its position *is* deterministic.
    await expect(options.first()).toHaveText('All Cards');
    // toHaveCount(1) per card, so this still fails on a missing *or* duplicated
    // option. Matching by name rather than by total count for the same reason the
    // article assertions are scoped: the card and team-card stores are not
    // exhibit-scoped, so a parallel worker's cards can arrive over SignalR.
    for (const cardName of ['Test Card 1', 'Test Card 2', 'Test Card 3']) {
      await expect(options.filter({ hasText: cardName })).toHaveCount(1);
    }

    // 2. Select a specific card from the dropdown.
    await options.filter({ hasText: 'Test Card 2' }).click();

    // expect: Only articles belonging to the selected card are displayed. Test Card 2
    // carries the Reporting and Social articles; the other four must be gone.
    await expect(cardFilter).toHaveText('Test Card 2');
    await expect(titles).toHaveText(['Social Article 1', 'Reporting Article 1']);

    // Selecting a different card swaps the list rather than adding to it.
    options = (await openMatSelect(cardFilter)).getByRole('option');
    await options.filter({ hasText: 'Test Card 1' }).click();
    await expect(titles).toHaveText(['News Article 1', 'Intel Article 1']);

    // 3. Select 'All Cards' to clear the filter.
    options = (await openMatSelect(cardFilter)).getByRole('option');
    await options.filter({ hasText: 'All Cards' }).click();

    // expect: All articles are displayed again.
    await expect(cardFilter).toHaveText('All Cards');
    await expect(titles).toHaveText(ALL_SEEDED_IN_ORDER);
  });
});
