// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: gallery/gallery-test-plan.md
// seed: seed.spec.ts

import { test, expect, gotoExhibitSection, apiSetExhibitMoveAndInject } from '../../fixtures';

/**
 * Archive Functionality §4.5 — Combined Filters.
 *
 * The exhibit is moved to (1, 1) so all six seeded articles are released, then the
 * search box, the source-type buttons and the card dropdown are combined. The three
 * filters are ANDed together in `archive.component.ts#sortChanged`, so the interesting
 * assertions are the ones that prove intersection rather than union: a search term and
 * a source type that cannot both match yield an empty list.
 *
 * `afterEach` restores (0, 0) — move/inject is persistent state on the worker-scoped
 * `seededExhibit`.
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

  test('Archive Combined Filters', async ({ galleryAuthenticatedPage: page, seededExhibit }) => {
    await apiSetExhibitMoveAndInject(seededExhibit.exhibitId, 1, 1);
    await gotoExhibitSection(page, seededExhibit.exhibitId, 'archive');
    await expect(page).toHaveTitle(/Gallery Archive/);

    const articleCards = page.locator('section.cards mat-card');
    const titles = articleCards.locator('.article-title').filter({ hasText: SEEDED_ARTICLE });
    await expect(titles).toHaveText(ALL_SEEDED_IN_ORDER);

    const searchField = page.getByRole('textbox', { name: 'Search the Archive' });
    const newsButton = page.getByRole('button', { name: 'News' });
    const socialButton = page.getByRole('button', { name: 'Social' });
    const cardFilter = page.getByRole('combobox');

    // 1. Enter a search term AND select a source type filter button.
    await searchField.fill('Social');
    await expect(titles).toHaveText(['Social Article 1']);

    await newsButton.click();

    // expect: Only articles matching both the search term and source type are
    // displayed — nothing is both a News article and a match for 'Social', so the
    // list is empty. This is the assertion that distinguishes AND from OR.
    await expect(titles).toHaveCount(0);

    // Adding Social to the (additive) source-type list brings exactly one article
    // back: News Article 1 still fails the search term, so it stays hidden.
    await socialButton.click();
    await expect(titles).toHaveText(['Social Article 1']);

    // 2. Additionally select a specific card from the dropdown.
    await cardFilter.click();
    await page.getByRole('option').filter({ hasText: 'Test Card 1' }).click();

    // expect: Articles are further filtered to match all three criteria — the Social
    // article belongs to Test Card 2, so restricting to Test Card 1 empties the list.
    await expect(titles).toHaveCount(0);

    await cardFilter.click();
    await page.getByRole('option').filter({ hasText: 'Test Card 2' }).click();
    await expect(titles).toHaveText(['Social Article 1']);

    // 3. Clear all filters one by one.
    // Clearing the search first leaves card = Test Card 2 and sources = News + Social.
    // Test Card 2 holds the Reporting and Social articles, so the visible set is
    // unchanged here — the list expands on the next removal.
    await page.getByRole('button', { name: 'Clear Search' }).click();
    await expect(searchField).toHaveValue('');
    await expect(titles).toHaveText(['Social Article 1']);

    // expect: Article list expands as each filter is removed.
    await cardFilter.click();
    await page.getByRole('option', { name: 'All Cards' }).click();
    await expect(titles).toHaveText(['Social Article 1', 'News Article 1']);

    // expect: All articles show when all filters are cleared.
    await socialButton.click();
    await newsButton.click();
    await expect(titles).toHaveText(ALL_SEEDED_IN_ORDER);
    await expect(newsButton).toHaveClass(/inactive-button/);
    await expect(socialButton).toHaveClass(/inactive-button/);
    await expect(cardFilter).toHaveText('All Cards');
  });
});
