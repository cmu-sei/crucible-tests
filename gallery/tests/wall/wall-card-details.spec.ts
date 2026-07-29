// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: gallery/gallery-test-plan.md
// seed: seed.spec.ts

import { test, expect, gotoExhibitSection } from '../../fixtures';

/**
 * Wall View Functionality §3.2 — Card Details Navigation.
 *
 * "Card details" is not an expanding panel: `wall.component.html`'s Details button
 * calls `gotoArchive(card.id)`, and `home-app.component.ts#gotoSection` treats any
 * value that is not 'wall'/'archive'/'admin' as a card id — switching to the Archive
 * section with `?card={cardId}` and making that card the active card filter. So the
 * assertion is that we land on the Archive, filtered to exactly that card's articles.
 *
 * Read-only with respect to shared state (no move/inject change, no read toggles), so
 * the worker-scoped `seededExhibit` needs no restoration.
 */
test.describe('Wall View Functionality', () => {
  test('Wall Card Details Navigation', async ({ galleryAuthenticatedPage: page, seededExhibit }) => {
    await gotoExhibitSection(page, seededExhibit.exhibitId, 'wall');
    await expect(page).toHaveTitle('Gallery Wall');

    // At the seeded position (move 0, inject 0) only Test Card 1 has released
    // articles, so it is the only seeded card rendering a Details button. Scoped to the
    // seeded card names because the Wall's card store is not exhibit-scoped (see the
    // SignalR leak reported against
    // `signalr.service.ts#addCardHandlers`/`addTeamCardHandlers`).
    const cards = page.locator('section.cards mat-card');
    await expect(cards.locator('mat-card-title').filter({ hasText: /^Test Card [123]$/ }))
      .toHaveText(['Test Card 1', 'Test Card 2', 'Test Card 3']);
    const card1 = cards.filter({ hasText: 'Test Card 1' });

    // 1. Click the 'Details' button on a card.
    const detailsButton = card1.getByRole('button', { name: 'Details' });
    await expect(detailsButton).toBeVisible();
    await detailsButton.click();

    // expect: Card details are displayed showing associated articles.
    await expect(page).toHaveTitle(/Gallery Archive/);
    await expect(page).toHaveURL(new RegExp(`section=archive.*card=[0-9a-f-]{36}`));

    // The card filter is now set to the clicked card, not "All Cards".
    await expect(page.getByRole('combobox')).toHaveText('Test Card 1');

    // expect: Article information is visible — exactly Test Card 1's two seeded
    // articles, and nothing from the other cards. (The card filter is the app's own
    // filter, so this list is genuinely narrowed by the click under test.)
    const articleCards = page.locator('section.cards mat-card');
    await expect(articleCards).toHaveCount(2);
    await expect(articleCards.locator('.article-title')).toHaveText([
      'News Article 1',
      'Intel Article 1',
    ]);
    // Each article renders its metadata and action buttons.
    const intelArticle = articleCards.filter({ hasText: 'Intel Article 1' });
    await expect(intelArticle.locator('.article-subtitle')).toHaveText('E2E Test Source');
    await expect(intelArticle.getByText('E2E test intel article')).toBeVisible();
    await expect(intelArticle.getByRole('button', { name: 'View' })).toBeVisible();
  });
});
