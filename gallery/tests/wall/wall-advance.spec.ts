// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: gallery/gallery-test-plan.md
// seed: seed.spec.ts

import { APIRequestContext, request as pwRequest } from '@playwright/test';
import { test, expect, gotoExhibitSection, Services } from '../../fixtures';
import { getUserToken } from '../../../keycloak-admin';

/**
 * Wall View Functionality §3.3 — Advance Move and Inject.
 *
 * This spec builds its own exhibit instead of using the worker-scoped `seededExhibit`,
 * for two reasons:
 *  - Advancing writes CurrentMove/CurrentInject on the exhibit row, which would outlive
 *    the test and change what every later test in the worker sees.
 *  - `seededExhibit`'s cards are named 'Test Card 1..3' in every worker, and the Wall's
 *    Card/TeamCard stores are not scoped to the exhibit (pending upstream:
 *    `signalr.service.ts#addCardHandlers`/`addTeamCardHandlers` accept Card and TeamCard
 *    events for exhibits other than the one being viewed), so a parallel worker seeding
 *    its own 'Test Card 2' gets it pushed onto this wall and a name-based locator
 *    resolves to two cards. Uniquely-named cards make every assertion exact.
 * `afterEach` deletes exactly the ids created — never a name-prefix purge, which would
 * take out data other specs are using concurrently.
 *
 * The three cards sit at (move 0, inject 0), (1, 0) and (1, 1) with two articles each,
 * so advancing is observable twice: the indicator text changes AND a previously empty
 * card starts showing articles. `wall.component.html` renders
 * `Move {{ exhibit.currentMove }}, Inject {{ exhibit.currentInject }}` and only renders a
 * card's date/unread-count/Details block when the card has at least one released article
 * (`card.datePosted.getFullYear() > 1970`), so both halves of the plan's expectation are
 * checkable.
 */

/** Gallery.Api.Data Enumerations.cs `SourceType` — spaced by 10, not 0-based. */
const SOURCE_TYPE = { News: 10, Intel: 50 } as const;

interface WallFixture {
  collectionId: string;
  exhibitId: string;
  teamId: string;
  cardIds: string[];
  articleIds: string[];
  cardNames: string[];
}

async function post<T>(api: APIRequestContext, path: string, data: unknown): Promise<T> {
  const response = await api.post(`${Services.Gallery.API}${path}`, { data });
  if (!response.ok()) {
    throw new Error(`POST ${path} failed: ${response.status()} ${await response.text()}`);
  }
  return (await response.json()) as T;
}

/** Seed a wall exhibit with three uniquely-named cards at (0,0), (1,0) and (1,1). */
async function seedWallExhibit(api: APIRequestContext): Promise<WallFixture> {
  const users: Array<{ id: string; name: string }> = await (
    await api.get(`${Services.Gallery.API}/api/users`)
  ).json();
  const admin = users.find((u) => u.name?.toLowerCase().includes('admin'));
  if (!admin) {
    throw new Error('Admin user not found in the Gallery database');
  }

  const stamp = `${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
  const collection = await post<{ id: string }>(api, '/api/collections', {
    name: `Advance Collection ${stamp}`,
    description: 'Auto-seeded collection for Playwright tests',
  });
  const exhibit = await post<{ id: string }>(api, '/api/exhibits', {
    name: `Advance Exhibit ${stamp}`,
    description: 'Auto-seeded exhibit for Playwright tests',
    collectionId: collection.id,
    showAdvanceButton: true,
  });
  const team = await post<{ id: string }>(api, '/api/teams', {
    name: `Advance Team ${stamp}`,
    shortName: 'ADVNC',
    exhibitId: exhibit.id,
  });
  await post(api, '/api/teamusers', { teamId: team.id, userId: admin.id, isObserver: false });

  const positions = [
    { move: 0, inject: 0 },
    { move: 1, inject: 0 },
    { move: 1, inject: 1 },
  ];
  const cardIds: string[] = [];
  const articleIds: string[] = [];
  const cardNames: string[] = [];
  for (const [index, position] of positions.entries()) {
    // The card list is sorted by name, so a shared prefix plus the index keeps the
    // display order aligned with the move/inject order.
    const cardName = `Advance ${stamp} Card ${index + 1}`;
    cardNames.push(cardName);
    const card = await post<{ id: string }>(api, '/api/cards', {
      name: cardName,
      description: 'Auto-seeded card for Playwright tests',
      move: position.move,
      inject: position.inject,
      collectionId: collection.id,
    });
    cardIds.push(card.id);
    await post(api, '/api/teamcards', {
      teamId: team.id,
      cardId: card.id,
      move: position.move,
      inject: position.inject,
      isShownOnWall: true,
      canPostArticles: true,
    });
    // TeamArticles (and hence UserArticles) are derived from the card's TeamCards, so
    // the TeamCard has to exist before the articles are posted.
    for (const source of [
      { label: 'Intel', sourceType: SOURCE_TYPE.Intel },
      { label: 'News', sourceType: SOURCE_TYPE.News },
    ]) {
      const article = await post<{ id: string }>(api, '/api/articles', {
        name: `${cardName} ${source.label} Article`,
        summary: `E2E advance test ${source.label.toLowerCase()} article`,
        description: `<p>E2E advance test ${source.label.toLowerCase()} article</p>`,
        collectionId: collection.id,
        exhibitId: exhibit.id,
        cardId: card.id,
        move: position.move,
        inject: position.inject,
        status: 0,
        sourceType: source.sourceType,
        sourceName: 'E2E Test Source',
        datePosted: new Date().toISOString(),
        openInNewTab: false,
      });
      articleIds.push(article.id);
    }
  }

  return {
    collectionId: collection.id,
    exhibitId: exhibit.id,
    teamId: team.id,
    cardIds,
    articleIds,
    cardNames,
  };
}

test.describe('Wall View Functionality', () => {
  let api: APIRequestContext;
  let fixture: WallFixture;

  test.beforeEach(async () => {
    const token = await getUserToken('admin', 'admin', 'gallery.ui', 'openid profile gallery');
    api = await pwRequest.newContext({
      ignoreHTTPSErrors: true,
      extraHTTPHeaders: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    });
    fixture = await seedWallExhibit(api);
  });

  test.afterEach(async () => {
    try {
      for (const id of fixture.articleIds) {
        await api.delete(`${Services.Gallery.API}/api/articles/${id}`);
      }
      for (const id of fixture.cardIds) {
        await api.delete(`${Services.Gallery.API}/api/cards/${id}`);
      }
      await api.delete(`${Services.Gallery.API}/api/teams/${fixture.teamId}`);
      await api.delete(`${Services.Gallery.API}/api/exhibits/${fixture.exhibitId}`);
      await api.delete(`${Services.Gallery.API}/api/collections/${fixture.collectionId}`);
    } finally {
      await api.dispose();
    }
  });

  test('Wall Advance Move and Inject', async ({ galleryAuthenticatedPage: page }) => {
    const [card1Name, card2Name, card3Name] = fixture.cardNames;

    // 1. Navigate to an exhibit's Wall view that has the Advance button enabled.
    await gotoExhibitSection(page, fixture.exhibitId, 'wall');
    await expect(page).toHaveTitle('Gallery Wall');

    // expect: The 'Advance' button is visible (the exhibit is seeded with
    // showAdvanceButton: true and admin holds the manage permission).
    const advanceButton = page.getByRole('button', { name: 'Advance' });
    await expect(advanceButton).toBeVisible();

    // expect: Current move and inject values are displayed. A freshly created exhibit
    // starts at (0, 0).
    await expect(page.getByText('Move 0, Inject 0')).toBeVisible();

    const cards = page.locator('section.cards mat-card');
    await expect(cards.locator('mat-card-title')).toHaveText([card1Name, card2Name, card3Name]);
    const card2 = cards.filter({ hasText: card2Name });

    // Card 2 lives at move 1, so at (0, 0) its articles are not yet released: no unread
    // count and no Details button.
    await expect(card2.getByRole('heading', { level: 3 })).toHaveText('No articles posted');
    await expect(card2.getByRole('button', { name: 'Details' })).toHaveCount(0);
    // Card 1 is released, which is what makes the "cards update" assertion below a
    // change rather than a coincidence.
    await expect(
      cards.filter({ hasText: card1Name }).getByRole('heading', { level: 3 })
    ).toHaveText('2 unread articles');

    // 2. Click the 'Advance' button. Pair the click with the API round-trip so the
    // assertions below run against a settled store rather than a fixed sleep.
    const advanceUrl = (r: { url(): string }) =>
      r.url().startsWith(`${Services.Gallery.API}/api/exhibits/`) && r.url().endsWith('/advance');

    const [advanceResponse] = await Promise.all([
      page.waitForResponse(advanceUrl),
      advanceButton.click(),
    ]);
    expect(advanceResponse.status()).toBe(200);

    // expect: The move/inject indicator updates to show the next move or inject values.
    // Assert both the new value and the disappearance of the old one, so a stale
    // indicator cannot pass.
    await expect(page.getByText('Move 1, Inject 0')).toBeVisible();
    await expect(page.getByText('Move 0, Inject 0')).toHaveCount(0);

    // expect: The cards displayed on the wall update to reflect articles for the new
    // move/inject — Card 2's two articles are now released.
    await expect(card2.getByRole('heading', { level: 3 })).toHaveText('2 unread articles');
    await expect(card2.getByRole('button', { name: 'Details' })).toBeVisible();

    // Advance again: the exhibit steps along the inject axis this time, releasing Card 3
    // at (1, 1). This proves the button keeps stepping rather than being a one-shot.
    const card3 = cards.filter({ hasText: card3Name });
    await expect(card3.getByRole('heading', { level: 3 })).toHaveText('No articles posted');

    const [secondAdvance] = await Promise.all([
      page.waitForResponse(advanceUrl),
      advanceButton.click(),
    ]);
    expect(secondAdvance.status()).toBe(200);

    await expect(page.getByText('Move 1, Inject 1')).toBeVisible();
    await expect(page.getByText('Move 1, Inject 0')).toHaveCount(0);
    await expect(card3.getByRole('heading', { level: 3 })).toHaveText('2 unread articles');
    await expect(card3.getByRole('button', { name: 'Details' })).toBeVisible();

    // The exhibit row itself really moved — the UI is not just re-rendering local state.
    const exhibitResponse = await api.get(
      `${Services.Gallery.API}/api/exhibits/${fixture.exhibitId}`
    );
    expect(exhibitResponse.status()).toBe(200);
    const exhibitRow: { currentMove: number; currentInject: number } = await exhibitResponse.json();
    expect(exhibitRow).toMatchObject({ currentMove: 1, currentInject: 1 });
  });
});
