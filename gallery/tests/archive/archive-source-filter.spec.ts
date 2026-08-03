// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: gallery/gallery-test-plan.md
// seed: seed.spec.ts

import { test, expect, gotoExhibitSection, apiSetExhibitMoveAndInject } from '../../fixtures';

/**
 * Archive Functionality §4.2 — Source Type Filtering.
 *
 * The Archive only shows articles released by the exhibit's current move/inject, and
 * at the seeded default (0, 0) that is just two of the six seeded articles. To exercise
 * every source-type button the exhibit is moved to its last position (1, 1) so all six
 * are visible: one each of Intel, Reporting, Orders, News, Social and Email, and none
 * of Phone — which makes Phone a useful "filters down to nothing" case.
 *
 * Move/inject is persistent state and `seededExhibit` is worker-scoped, so `afterEach`
 * restores (0, 0), including when the body throws.
 *
 * Assertions are scoped to the seeded article names via SEEDED_ARTICLE rather than
 * counting every card on the page: the Archive's article store is not scoped to the
 * exhibit, so a UserArticle created for the same user in another exhibit while this page
 * is open is pushed into the list by SignalR (pending upstream:
 * `signalr.service.ts#addUserArticleHandlers` accepts UserArticle events for exhibits
 * other than the one being viewed). Scoping keeps the filter assertions exact without
 * being at the mercy of unrelated exhibits.
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

const EXPECTED_BY_SOURCE: Record<string, string[]> = {
  Intel: ['Intel Article 1'],
  Reporting: ['Reporting Article 1'],
  Orders: ['Orders Article 1'],
  News: ['News Article 1'],
  Social: ['Social Article 1'],
  Phone: [],
  Email: ['Email Article 1'],
};

test.describe('Archive Functionality', () => {
  test.afterEach(async ({ seededExhibit }) => {
    await apiSetExhibitMoveAndInject(seededExhibit.exhibitId, 0, 0);
  });

  test('Archive Source Type Filtering', async ({ galleryAuthenticatedPage: page, seededExhibit }) => {
    await apiSetExhibitMoveAndInject(seededExhibit.exhibitId, 1, 1);
    await gotoExhibitSection(page, seededExhibit.exhibitId, 'archive');
    await expect(page).toHaveTitle(/Gallery Archive/);

    const articleCards = page.locator('section.cards mat-card');
    const titles = articleCards.locator('.article-title').filter({ hasText: SEEDED_ARTICLE });
    await expect(titles).toHaveText(ALL_SEEDED_IN_ORDER);

    // 1. Click the 'Intel' source type filter button.
    const intelButton = page.getByRole('button', { name: 'Intel' });
    await intelButton.click();

    // expect: Only articles with Intel source type are displayed.
    await expect(titles).toHaveText(['Intel Article 1']);

    // expect: The Intel button appears selected/active. `archive.component.html`
    // toggles `active-button`/`inactive-button` from `sourceTypeList`.
    await expect(intelButton).toHaveClass(/active-button/);
    await expect(intelButton).not.toHaveClass(/inactive-button/);

    // 2. Click the 'News' source type filter button. The filter is additive
    // (`sourceTypeList` is a concatenated string), so both types now show.
    const newsButton = page.getByRole('button', { name: 'News' });
    await newsButton.click();
    await expect(titles).toHaveText(['News Article 1', 'Intel Article 1']);

    // 3. Click the active filter buttons again to deselect them.
    await newsButton.click();
    await expect(titles).toHaveText(['Intel Article 1']);
    await intelButton.click();

    // expect: All articles are displayed again.
    await expect(titles).toHaveText(ALL_SEEDED_IN_ORDER);
    await expect(intelButton).toHaveClass(/inactive-button/);

    // 4./5. Test each source type button on its own.
    for (const [sourceType, expectedTitles] of Object.entries(EXPECTED_BY_SOURCE)) {
      const button = page.getByRole('button', { name: sourceType });
      await expect(button).toHaveClass(/inactive-button/);
      await button.click();

      // expect: Each button correctly filters to show only articles of that source
      // type. Phone has no seeded article, so it must filter down to nothing —
      // toHaveCount(0) rather than a not-visible check.
      await expect(button).toHaveClass(/active-button/);
      // `expectedTitles` is [] for Phone, so this is a toHaveCount(0) in effect.
      await expect(titles).toHaveText(expectedTitles);

      // Deselect before the next source type so each is measured in isolation.
      await button.click();
      await expect(titles).toHaveText(ALL_SEEDED_IN_ORDER);
    }
  });
});
