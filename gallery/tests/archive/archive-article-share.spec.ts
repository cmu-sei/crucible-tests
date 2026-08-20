// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: gallery/gallery-test-plan.md
// seed: seed.spec.ts

import { APIRequestContext, request as pwRequest } from '@playwright/test';
import {
  test,
  expect,
  gotoExhibitSection,
  apiCreateCollection,
  apiCreateExhibit,
  apiDeleteCollectionById,
  apiDeleteExhibitById,
  Services,
} from '../../fixtures';
import { getUserToken } from '../../../keycloak-admin';

/**
 * Archive Functionality §4.8 — Article Share.
 *
 * Sharing is only observable when there is a *second* team with a member to share
 * to: `UserArticleService.ShareAsync` copies the UserArticle to every user on
 * `ToTeamIdList` who does not already have one, and logs
 * "There are no users on the selected teams to receive a shared article" otherwise.
 * The worker-scoped `seededExhibit` has exactly one team, so this spec builds its own
 * exhibit with team A (admin) and team B (a dedicated Gallery user) and tears the lot
 * down in `afterEach`. It never touches `seededExhibit`, so nothing shared here can
 * leak into another test's view.
 *
 * The share target is a Gallery-database user only (no Keycloak account): it never
 * logs in, it just needs to exist as a TeamUser so `ShareAsync` has somebody to copy
 * the UserArticle to. Its unread count via
 * `GET /api/exhibits/{id}/users/{userId}/Articles/unread` is the ground-truth proof
 * that the share actually happened, independent of any UI feedback.
 */

interface ShareFixtureData {
  collectionId: string;
  exhibitId: string;
  teamAId: string;
  teamBName: string;
  teamBId: string;
  targetUserId: string;
  cardId: string;
  articleId: string;
}

async function galleryApiContext(): Promise<APIRequestContext> {
  const token = await getUserToken('admin', 'admin', 'gallery.ui', 'openid profile gallery');
  return pwRequest.newContext({
    ignoreHTTPSErrors: true,
    extraHTTPHeaders: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
  });
}

async function postJson<T>(api: APIRequestContext, path: string, data: unknown): Promise<T> {
  const response = await api.post(`${Services.Gallery.API}${path}`, { data });
  if (!response.ok()) {
    throw new Error(`POST ${path} failed: ${response.status()} ${await response.text()}`);
  }
  return (await response.json()) as T;
}

/** Unread UserArticle count for a user on an exhibit, straight from the API. */
async function unreadCount(
  api: APIRequestContext,
  exhibitId: string,
  userId: string
): Promise<number> {
  const response = await api.get(
    `${Services.Gallery.API}/api/exhibits/${exhibitId}/users/${userId}/Articles/unread`
  );
  if (!response.ok()) {
    throw new Error(`Unread count lookup failed: ${response.status()} ${await response.text()}`);
  }
  const body: { count: string | number } = await response.json();
  return Number(body.count);
}

test.describe('Archive Functionality', () => {
  // Partially-built fixtures still need tearing down, so record ids as they are
  // created and let `afterEach` delete whatever exists.
  let created: Partial<ShareFixtureData> = {};

  test.afterEach(async () => {
    const api = await galleryApiContext();
    try {
      // Order matters: articles/cards before the exhibit, teams before the exhibit,
      // exhibit before its collection. Only exact ids — never a name-prefix purge,
      // which would take out data other specs are using concurrently.
      if (created.articleId) {
        await api.delete(`${Services.Gallery.API}/api/articles/${created.articleId}`);
      }
      if (created.cardId) {
        await api.delete(`${Services.Gallery.API}/api/cards/${created.cardId}`);
      }
      for (const teamId of [created.teamAId, created.teamBId]) {
        if (teamId) {
          await api.delete(`${Services.Gallery.API}/api/teams/${teamId}`);
        }
      }
      if (created.targetUserId) {
        await api.delete(`${Services.Gallery.API}/api/users/${created.targetUserId}`);
      }
      if (created.exhibitId) {
        await apiDeleteExhibitById(created.exhibitId);
      }
      if (created.collectionId) {
        await apiDeleteCollectionById(created.collectionId);
      }
    } finally {
      await api.dispose();
      created = {};
    }
  });

  test('Archive Article Share', async ({ galleryAuthenticatedPage: page }) => {
    const api = await galleryApiContext();
    let stamp: string;
    try {
      stamp = `${Date.now()}-${Math.floor(Math.random() * 1e6)}`;

      const collection = await apiCreateCollection(`Share Collection ${stamp}`);
      created.collectionId = collection.id;
      const exhibit = await apiCreateExhibit(collection.id, `Share Exhibit ${stamp}`);
      created.exhibitId = exhibit.id;

      const admin = await (async () => {
        const users: Array<{ id: string; name: string }> = await (
          await api.get(`${Services.Gallery.API}/api/users`)
        ).json();
        const found = users.find((u) => u.name?.toLowerCase().includes('admin'));
        if (!found) {
          throw new Error('Admin user not found in the Gallery database');
        }
        return found;
      })();

      // The share target. A Gallery user row is enough — it never authenticates.
      const targetUserId = crypto.randomUUID();
      await postJson(api, '/api/users', { id: targetUserId, name: `Share Target ${stamp}` });
      created.targetUserId = targetUserId;

      const teamA = await postJson<{ id: string; name: string }>(api, '/api/teams', {
        name: `Share Team A ${stamp}`,
        shortName: 'SHAREA',
        exhibitId: exhibit.id,
      });
      created.teamAId = teamA.id;
      const teamB = await postJson<{ id: string; name: string }>(api, '/api/teams', {
        name: `Share Team B ${stamp}`,
        shortName: 'SHAREB',
        exhibitId: exhibit.id,
      });
      created.teamBId = teamB.id;
      created.teamBName = teamB.name;

      await postJson(api, '/api/teamusers', { teamId: teamA.id, userId: admin.id, isObserver: false });
      await postJson(api, '/api/teamusers', {
        teamId: teamB.id,
        userId: targetUserId,
        isObserver: false,
      });

      const card = await postJson<{ id: string }>(api, '/api/cards', {
        name: `Share Card ${stamp}`,
        description: 'Auto-seeded card for the article-share test',
        move: 0,
        inject: 0,
        collectionId: collection.id,
      });
      created.cardId = card.id;
      // Only team A sees the card, so only admin gets the UserArticle up front —
      // team B's copy can then only come from the share under test.
      await postJson(api, '/api/teamcards', {
        teamId: teamA.id,
        cardId: card.id,
        move: 0,
        inject: 0,
        isShownOnWall: true,
        canPostArticles: true,
      });
      // `ArticleService.CreateAsync` derives the TeamArticles from the TeamCards of
      // the article's card, so no explicit /api/teamarticles POST is needed.
      const article = await postJson<{ id: string }>(api, '/api/articles', {
        name: `Share Article ${stamp}`,
        summary: 'E2E share test article',
        description: '<p>E2E share test article</p>',
        collectionId: collection.id,
        exhibitId: exhibit.id,
        cardId: card.id,
        move: 0,
        inject: 0,
        status: 0,
        sourceType: 0,
        sourceName: 'E2E Test Source',
        datePosted: new Date().toISOString(),
        openInNewTab: false,
      });
      created.articleId = article.id;

      // Baseline: the target user has nothing.
      expect(await unreadCount(api, exhibit.id, targetUserId)).toBe(0);

      await gotoExhibitSection(page, exhibit.id, 'archive');
      await expect(page).toHaveTitle(/Gallery Archive/);

      await expect(page.locator('section.cards mat-card')).toHaveCount(1);
      const articleCard = page
        .locator('section.cards mat-card')
        .filter({ hasText: `Share Article ${stamp}` });

      // 3 (done first, while the form is still pristine — `crucible-dialog` sets
      //    `guardUnsavedWork` from `form.dirty`, so cancelling after selecting a team
      //    would raise a discard-changes guard). Cancel the share dialog without sharing.
      await articleCard.getByRole('button', { name: 'Share' }).click();
      const dialog = page.getByRole('dialog');
      await expect(dialog).toBeVisible();
      await dialog.getByRole('button', { name: 'Cancel' }).click();

      // expect: Dialog closes without sharing the article.
      await expect(dialog).toHaveCount(0);
      expect(await unreadCount(api, exhibit.id, targetUserId)).toBe(0);

      // 1. Click the 'Share' button on an article.
      await articleCard.getByRole('button', { name: 'Share' }).click();
      await expect(dialog).toBeVisible();

      // expect: A share dialog opens.
      await expect(dialog.getByRole('heading', { name: 'Share Article' })).toBeVisible();

      // expect: Team selector is available to choose teams to share with. It lists
      // every team on the exhibit (`shareTeamList` comes from getTeamsByExhibit).
      const teamSelect = dialog.getByRole('combobox');
      await expect(teamSelect).toBeVisible();
      await teamSelect.click();
      await expect(page.getByRole('option', { name: teamA.name })).toBeVisible();
      await expect(page.getByRole('option', { name: teamB.name })).toBeVisible();

      // 2. Select one or more teams and click Share.
      await page.getByRole('option', { name: teamB.name }).click();
      // Multi-select stays open for further picks; close the overlay so the Share
      // button is clickable.
      await page.keyboard.press('Escape');
      await expect(page.getByRole('option')).toHaveCount(0);

      const shareSubmit = dialog.getByRole('button', { name: 'Share', exact: true });
      // Guarded by `[submitDisabled]="!form.dirty || !shareTeamsControl.value?.length"`,
      // so it becoming enabled proves the selection registered on the form.
      await expect(shareSubmit).toBeEnabled();

      const [shareResponse] = await Promise.all([
        page.waitForResponse((r) => /\/api\/userarticles\/[^/]+\/share$/i.test(r.url())),
        shareSubmit.click(),
      ]);
      expect(shareResponse.status()).toBe(200);
      await expect(dialog).toHaveCount(0);

      // expect: Success message appears. Asserted before the unread-count poll below
      // (which can take up to 10s) because the snackbar's `duration: 5000` means it
      // auto-dismisses well within that window — checking it after the poll would pass
      // vacuously regardless of whether the snackbar ever appeared.
      await expect(page.locator('mat-snack-bar-container')).toContainText('Article shared.');

      // expect: Article is shared with the selected teams. Proven at the data layer:
      // the target user on team B now has an (unread) copy of the article, which it
      // had no other route to.
      await expect
        .poll(() => unreadCount(api, exhibit.id, targetUserId), { timeout: 10000 })
        .toBe(1);
    } finally {
      await api.dispose();
    }
  });
});
