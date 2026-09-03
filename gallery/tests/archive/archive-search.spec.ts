// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: gallery/gallery-test-plan.md
// seed: seed.spec.ts

import { test, expect, gotoExhibitSection, apiSetExhibitMoveAndInject } from '../../fixtures';

/**
 * Archive Functionality §4.3 — Archive Search.
 *
 * The exhibit is moved to its last position (1, 1) so all six seeded articles are
 * released; that gives the search something to narrow down. `afterEach` restores
 * (0, 0) because move/inject is persistent state on the worker-scoped `seededExhibit`.
 *
 * `archive.component.ts#sortChanged` matches the filter string against the article's
 * name, description, sourceType, sourceName and status, so 'Intel' matches exactly one
 * seeded article ('Intel Article 1' / sourceType Intel) while 'E2E' would match all six
 * via the shared sourceName.
 *
 * Assertions are scoped to the seeded article names: the Archive's article store is not
 * scoped to the exhibit, so a UserArticle created for the same user in another exhibit
 * while this page is open is pushed into the list by SignalR (pending upstream:
 * `signalr.service.ts#addUserArticleHandlers` accepts UserArticle events for exhibits
 * other than the one being viewed). Scoping keeps these exact without depending on what
 * other exhibits are doing.
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

  test('Archive Search', async ({ galleryAuthenticatedPage: page, seededExhibit }) => {
    await apiSetExhibitMoveAndInject(seededExhibit.exhibitId, 1, 1);
    await gotoExhibitSection(page, seededExhibit.exhibitId, 'archive');
    await expect(page).toHaveTitle(/Gallery Archive/);

    const articleCards = page.locator('section.cards mat-card');
    const titles = articleCards.locator('.article-title').filter({ hasText: SEEDED_ARTICLE });
    await expect(titles).toHaveText(ALL_SEEDED_IN_ORDER);

    // 1. Enter a keyword in the 'Search the Archive' field that matches an article title.
    // The input is bound to a reactive `formControl`, so fill() alone triggers the
    // valueChanges subscription that re-runs the filter (unlike the home page's
    // (keyup)-bound search box).
    const searchField = page.getByRole('textbox', { name: 'Search the Archive' });
    await searchField.fill('Intel');

    // expect: Only articles with matching titles or content are displayed.
    await expect(titles).toHaveText(['Intel Article 1']);

    // A term that appears only in the body text also filters, proving the match is not
    // title-only: every article's description ends with its own summary sentence.
    await searchField.fill('e2e test social article');
    await expect(titles).toHaveText(['Social Article 1']);

    // 2. Clear the search field. The suffix 'Clear Search' button only renders while
    // the control has a value, so this also covers that affordance.
    await page.getByRole('button', { name: 'Clear Search' }).click();

    // expect: All articles are displayed again.
    await expect(searchField).toHaveValue('');
    await expect(titles).toHaveText(ALL_SEEDED_IN_ORDER);

    // 3. Enter a keyword that matches no articles.
    await searchField.fill('ZZZZNONEXISTENT');

    // expect: No articles are displayed.
    await expect(articleCards).toHaveCount(0);

    // The plan also expects an empty state / 'no results' message here. The Archive
    // template (archive/archive.component.html) has no such element — it only @for's
    // over `filteredUserArticleList` — so the observable behaviour is an empty list.
    // Asserting that deliberately rather than skipping; if the app later adds an empty
    // state, extend this with an assertion on it.
    await expect(page.getByText(/no results/i)).toHaveCount(0);
  });
});
