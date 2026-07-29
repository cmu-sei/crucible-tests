// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: gallery/gallery-test-plan.md
// seed: seed.spec.ts

import { test, expect, gotoExhibitSection } from '../../fixtures';

/**
 * Wall View Functionality §3.1 — Wall Page Display.
 *
 * Read-only: this spec navigates and asserts, and mutates no shared state, so the
 * worker-scoped `seededExhibit` needs no restoration here.
 *
 * At the seeded default position (move 0, inject 0) all three TeamCards are shown on
 * the wall (`isShownOnWall: true`), but only Test Card 1's articles are released, so
 * card 1 carries a simulated date + unread count and cards 2/3 carry "No articles
 * posted" — that is the shape §3.1's "each card shows: name, description, date
 * posted, and unread article count" takes for this data.
 *
 * Card assertions are scoped to the seeded card names rather than counting every card
 * on the wall: the Wall's card store is not scoped to the exhibit, so a Card/TeamCard
 * created for the same user in another exhibit while this page is open is pushed onto
 * the wall by SignalR (reported as an app bug against
 * `signalr.service.ts#addCardHandlers`/`addTeamCardHandlers`).
 */
const SEEDED_CARD = /^Test Card [123]$/;
test.describe('Wall View Functionality', () => {
  test('Wall Page Display', async ({ galleryAuthenticatedPage: page, seededExhibit }) => {
    // 1. Navigate to the seeded exhibit's Wall view.
    await gotoExhibitSection(page, seededExhibit.exhibitId, 'wall');

    // expect: The Wall page loads with the page title 'Gallery Wall'.
    await expect(page).toHaveTitle('Gallery Wall');

    // expect: The Move/Inject indicator is displayed.
    await expect(page.getByText('Move 0, Inject 0')).toBeVisible();

    // expect: The team indicator shows the current team name. `team-selector.component.html`
    // renders "Team:&nbsp;" plus the team's short name when the user's own team is
    // selected, so the label proves the selector resolved a team rather than
    // rendering the "Observing:" branch.
    await expect(page.locator('app-team-selector').getByText('Team:')).toBeVisible();

    // expect: Cards are displayed in a grid layout — one per seeded TeamCard.
    const cards = page.locator('section.cards mat-card');
    await expect(cards.locator('mat-card-title').filter({ hasText: SEEDED_CARD })).toHaveText([
      'Test Card 1',
      'Test Card 2',
      'Test Card 3',
    ]);

    // expect: Each card shows: name, description, date posted, and unread article count.
    for (const cardName of ['Test Card 1', 'Test Card 2', 'Test Card 3']) {
      const card = cards.filter({ hasText: cardName });
      await expect(card.locator('mat-card-title')).toHaveText(cardName);
      await expect(card.locator('mat-card-subtitle')).toHaveText(
        'Auto-seeded card for Playwright tests'
      );
    }

    // Card 1's articles are released at (0, 0): simulated date/time, an unread count
    // and a Details button. Cards 2 and 3 are at later positions and say so.
    const card1 = cards.filter({ hasText: 'Test Card 1' });
    await expect(card1.getByRole('heading', { level: 3 })).toHaveText('2 unread articles');
    await expect(card1.locator('mat-icon[fontIcon="mdi-calendar-clock-outline"]')).toBeVisible();
    await expect(card1.getByText(/\d{1,2}\/\d{1,2}\/\d{2},? .*ET/)).toBeVisible();
    await expect(cards.filter({ hasText: 'Test Card 2' }).getByRole('heading', { level: 3 }))
      .toHaveText('No articles posted');
    await expect(cards.filter({ hasText: 'Test Card 3' }).getByRole('heading', { level: 3 }))
      .toHaveText('No articles posted');

    // 2. Observe the navigation controls at the top.
    // expect: An 'Archive' button is visible.
    await expect(page.getByRole('button', { name: 'Archive' })).toBeVisible();

    // expect: An 'Administration' button is visible (for admin users).
    await expect(page.getByRole('button', { name: 'Administration' })).toBeVisible();

    // expect: The 'Advance' button is visible (the exhibit is seeded with
    // showAdvanceButton: true).
    await expect(page.getByRole('button', { name: 'Advance' })).toBeVisible();
  });
});
