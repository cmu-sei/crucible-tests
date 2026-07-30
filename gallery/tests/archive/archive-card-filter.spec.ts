// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: gallery/gallery-test-plan.md
// seed: seed.spec.ts

import { test, expect, gotoExhibitSection, apiSetExhibitMoveAndInject } from '../../fixtures';

/**
 * Archive Functionality §4.4 — Archive Card Filtering.
 *
 * The exhibit is moved to (1, 1) so all three seeded cards have released articles and
 * therefore appear in the card dropdown. `afterEach` restores (0, 0) because move/inject
 * is persistent state on the worker-scoped `seededExhibit`.
 *
 * Assertions are scoped to the seeded article names: the Archive's article store is not
 * scoped to the exhibit, so a UserArticle created for the same user in another exhibit
 * while this page is open is pushed into the list by SignalR (reported as an app bug
 * against `signalr.service.ts#addUserArticleHandlers`).
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
    const cardFilter = page.getByRole('combobox');
    await expect(cardFilter).toHaveText('All Cards');
    await cardFilter.click();

    // expect: A list of available cards is displayed — 'All Cards' plus one option per
    // seeded card, in card order.
    const options = page.getByRole('option');
    await expect(options).toHaveText(['All Cards', 'Test Card 1', 'Test Card 2', 'Test Card 3']);

    // 2. Select a specific card from the dropdown.
    await options.filter({ hasText: 'Test Card 2' }).click();

    // expect: Only articles belonging to the selected card are displayed. Test Card 2
    // carries the Reporting and Social articles; the other four must be gone.
    await expect(cardFilter).toHaveText('Test Card 2');
    await expect(titles).toHaveText(['Social Article 1', 'Reporting Article 1']);

    // Selecting a different card swaps the list rather than adding to it.
    await cardFilter.click();
    await page.getByRole('option').filter({ hasText: 'Test Card 1' }).click();
    await expect(titles).toHaveText(['News Article 1', 'Intel Article 1']);

    // 3. Select 'All Cards' to clear the filter.
    await cardFilter.click();
    await page.getByRole('option', { name: 'All Cards' }).click();

    // expect: All articles are displayed again.
    await expect(cardFilter).toHaveText('All Cards');
    await expect(titles).toHaveText(ALL_SEEDED_IN_ORDER);
  });
});
