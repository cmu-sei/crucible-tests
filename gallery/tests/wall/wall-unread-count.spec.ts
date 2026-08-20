// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: gallery/gallery-test-plan.md
// seed: seed.spec.ts

import { APIRequestContext, request as pwRequest } from '@playwright/test';
import { test, expect, gotoExhibitSection, Services } from '../../fixtures';
import { getUserToken } from '../../../keycloak-admin';

/**
 * Wall View Functionality §3.5 — Unread Article Count.
 *
 * This spec builds its own exhibit rather than using the worker-scoped `seededExhibit`:
 *  - Marking an article read writes `UserArticle.IsRead` for the admin user, which would
 *    outlive the test and change the unread counts later tests in the worker assert on.
 *    Owning the exhibit means the mutation dies with the fixture.
 *  - `seededExhibit` names its cards/articles identically in every worker, and the
 *    Wall/Archive Card, TeamCard and UserArticle stores are not scoped to the exhibit
 *    (pending upstream: `signalr.service.ts#addCardHandlers`, `addTeamCardHandlers` and
 *    `addUserArticleHandlers` accept events for exhibits other than the one being
 *    viewed), so a parallel worker's 'Intel Article 1' gets pushed into this page's list
 *    and a name-based locator resolves to two cards. Uniquely-named cards and articles
 *    make every assertion exact, including the tab-title count.
 * `afterEach` deletes exactly the ids created — never a name-prefix purge, which would
 * take out data other specs are using concurrently.
 *
 * The seeded card sits at (move 0, inject 0) with two articles, so the fresh exhibit's
 * Wall heading reads "2 unread articles" — `wall.component.ts#setShownCardList` computes
 * `unreadCount` as `userArticles.filter(ua => !ua.isRead).length`. Marking one of the two
 * read in the Archive must therefore take the heading to "1 unread article" (singular;
 * the trailing "s" is a separate conditional span). A second card at (1, 0) stays
 * unreleased, which is what keeps the tab-title count at exactly 2.
 */

/** Gallery.Api.Data Enumerations.cs `SourceType` — spaced by 10, not 0-based. */
const SOURCE_TYPE = { News: 10, Intel: 50 } as const;

interface UnreadFixture {
  collectionId: string;
  exhibitId: string;
  teamId: string;
  cardIds: string[];
  articleIds: string[];
  releasedCardName: string;
  intelArticleName: string;
  newsArticleName: string;
}

async function post<T>(api: APIRequestContext, path: string, data: unknown): Promise<T> {
  const response = await api.post(`${Services.Gallery.API}${path}`, { data });
  if (!response.ok()) {
    throw new Error(`POST ${path} failed: ${response.status()} ${await response.text()}`);
  }
  return (await response.json()) as T;
}

/** Unread count from the tab title, e.g. 'Gallery Archive (2)' -> 2. */
function unreadFromTitle(title: string): number {
  const match = /^Gallery Archive \((\d+)\)$/.exec(title);
  if (!match) {
    throw new Error(`Unexpected Archive title: ${JSON.stringify(title)}`);
  }
  return Number(match[1]);
}

async function seedUnreadExhibit(api: APIRequestContext): Promise<UnreadFixture> {
  const users: Array<{ id: string; name: string }> = await (
    await api.get(`${Services.Gallery.API}/api/users`)
  ).json();
  const admin = users.find((u) => u.name?.toLowerCase().includes('admin'));
  if (!admin) {
    throw new Error('Admin user not found in the Gallery database');
  }

  const stamp = `${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
  const collection = await post<{ id: string }>(api, '/api/collections', {
    name: `Unread Collection ${stamp}`,
    description: 'Auto-seeded collection for Playwright tests',
  });
  const exhibit = await post<{ id: string }>(api, '/api/exhibits', {
    name: `Unread Exhibit ${stamp}`,
    description: 'Auto-seeded exhibit for Playwright tests',
    collectionId: collection.id,
    showAdvanceButton: false,
  });
  const team = await post<{ id: string }>(api, '/api/teams', {
    name: `Unread Team ${stamp}`,
    shortName: 'UNRD',
    exhibitId: exhibit.id,
  });
  await post(api, '/api/teamusers', { teamId: team.id, userId: admin.id, isObserver: false });

  const releasedCardName = `Unread ${stamp} Card 1`;
  const laterCardName = `Unread ${stamp} Card 2`;
  const intelArticleName = `Unread ${stamp} Intel Article`;
  const newsArticleName = `Unread ${stamp} News Article`;

  const cardIds: string[] = [];
  const articleIds: string[] = [];
  const cardSpecs = [
    {
      name: releasedCardName,
      move: 0,
      inject: 0,
      articles: [
        { name: intelArticleName, sourceType: SOURCE_TYPE.Intel },
        { name: newsArticleName, sourceType: SOURCE_TYPE.News },
      ],
    },
    {
      name: laterCardName,
      move: 1,
      inject: 0,
      articles: [{ name: `Unread ${stamp} Later Article`, sourceType: SOURCE_TYPE.News }],
    },
  ];

  for (const cardSpec of cardSpecs) {
    const card = await post<{ id: string }>(api, '/api/cards', {
      name: cardSpec.name,
      description: 'Auto-seeded card for Playwright tests',
      move: cardSpec.move,
      inject: cardSpec.inject,
      collectionId: collection.id,
    });
    cardIds.push(card.id);
    await post(api, '/api/teamcards', {
      teamId: team.id,
      cardId: card.id,
      move: cardSpec.move,
      inject: cardSpec.inject,
      isShownOnWall: true,
      canPostArticles: true,
    });
    // TeamArticles (and hence UserArticles) are derived from the card's TeamCards, so
    // the TeamCard has to exist before the articles are posted.
    for (const articleSpec of cardSpec.articles) {
      const article = await post<{ id: string }>(api, '/api/articles', {
        name: articleSpec.name,
        summary: 'E2E unread-count test article',
        description: '<p>E2E unread-count test article</p>',
        collectionId: collection.id,
        exhibitId: exhibit.id,
        cardId: card.id,
        move: cardSpec.move,
        inject: cardSpec.inject,
        status: 0,
        sourceType: articleSpec.sourceType,
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
    releasedCardName,
    intelArticleName,
    newsArticleName,
  };
}

test.describe('Wall View Functionality', () => {
  let api: APIRequestContext;
  let fixture: UnreadFixture;

  test.beforeEach(async () => {
    const token = await getUserToken('admin', 'admin', 'gallery.ui', 'openid profile gallery');
    api = await pwRequest.newContext({
      ignoreHTTPSErrors: true,
      extraHTTPHeaders: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    });
    fixture = await seedUnreadExhibit(api);
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

  test('Wall Unread Article Count', async ({ galleryAuthenticatedPage: page }) => {
    const { releasedCardName, intelArticleName, newsArticleName } = fixture;

    // 1. Navigate to the Wall view and observe unread article counts on cards.
    await gotoExhibitSection(page, fixture.exhibitId, 'wall');
    await expect(page).toHaveTitle('Gallery Wall');

    const cards = page.locator('section.cards mat-card');
    const releasedCard = cards.filter({ hasText: releasedCardName });

    // expect: Each card shows the unread article count. Card 1's two articles are
    // released at (0, 0); card 2 sits at move 1 and so reports nothing posted yet.
    await expect(releasedCard.getByRole('heading', { level: 3 })).toHaveText('2 unread articles');
    await expect(cards.filter({ hasText: 'Card 2' }).getByRole('heading', { level: 3 })).toHaveText(
      'No articles posted'
    );

    // 2. Navigate to the Archive view and mark an article as 'Read'.
    await page.getByRole('button', { name: 'Archive' }).click();

    // Both of this exhibit's released articles are unread, and this exhibit's own
    // articles are the only ones in the store, so the count is exactly 2.
    await expect(page).toHaveTitle('Gallery Archive (2)');
    expect(unreadFromTitle(await page.title())).toBe(2);

    const archiveCards = page.locator('section.cards mat-card');
    const intelArticle = archiveCards.filter({ hasText: intelArticleName });
    await expect(intelArticle).toHaveCount(1);
    await expect(archiveCards.filter({ hasText: newsArticleName })).toHaveCount(1);

    // The card header carries `article-unread` until the article is read.
    await expect(intelArticle.locator('mat-card-header')).toHaveClass(/article-unread/);

    const readButton = intelArticle.getByRole('button', { name: 'Read' });
    await expect(readButton).toBeEnabled();
    // The generated client calls the lower-cased `/api/userarticles/{id}/isread` route,
    // so match case-insensitively rather than on the Swagger casing.
    const [readResponse] = await Promise.all([
      page.waitForResponse((r) => /\/api\/userarticles\/[^/]+\/isread$/i.test(r.url())),
      readButton.click(),
    ]);
    expect(readResponse.status()).toBe(200);

    // expect: The Read button toggles to indicate the article has been read.
    await expect(intelArticle.locator('mat-card-header')).toHaveClass(/article-read/);
    await expect(readButton.locator('mat-icon')).toHaveClass(/mdi-checkbox-marked-outline/);
    // The unread count in the tab title drops by exactly one.
    await expect.poll(async () => unreadFromTitle(await page.title())).toBe(1);

    // 3. Navigate back to the Wall view.
    await page.getByRole('button', { name: 'Wall' }).click();
    await expect(page).toHaveTitle('Gallery Wall');

    // expect: The unread article count on the corresponding card decreases.
    // Singular "article" here, so the assertion cannot be satisfied by the old
    // "2 unread articles" text.
    await expect(
      page
        .locator('section.cards mat-card')
        .filter({ hasText: releasedCardName })
        .getByRole('heading', { level: 3 })
    ).toHaveText('1 unread article');
  });
});
