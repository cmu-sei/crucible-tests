// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: gallery/gallery-test-plan.md
// seed: seed.spec.ts

import { request as pwRequest } from '@playwright/test';
import { test, expect, gotoExhibitSection, Services } from '../../fixtures';
import { getUserToken } from '../../../keycloak-admin';

/**
 * Archive Functionality §4.7 — Article Read Toggle.
 *
 * Read state is persisted per UserArticle, and `seededExhibit` is worker-scoped, so a
 * left-behind "read" flag would change the unread counts other specs assert on. The
 * test body toggles back to unread itself, and `afterEach` additionally forces every
 * UserArticle on the seeded team back to unread through the API so the restoration also
 * happens when the body throws part-way through.
 *
 * Note the route casing: the generated Angular client calls the lower-case
 * `/api/userarticles/{id}/isread` even though Swagger documents `/api/userArticles/...`,
 * so response matchers here are case-insensitive.
 *
 * The tab-title unread count is asserted as a *delta* rather than an absolute number:
 * the Archive article store is not scoped to the exhibit, so a UserArticle created for
 * the same user in another exhibit while this page is open is pushed into the list by
 * SignalR and shifts the baseline (reported as an app bug against
 * `signalr.service.ts#addUserArticleHandlers`). The direction of the change is the
 * behaviour under test and is unaffected.
 */

/** Unread count from the tab title, e.g. 'Gallery Archive (2)' -> 2. */
function unreadFromTitle(title: string): number {
  const match = /^Gallery Archive \((\d+)\)$/.exec(title);
  if (!match) {
    throw new Error(`Unexpected Archive title: ${JSON.stringify(title)}`);
  }
  return Number(match[1]);
}
async function restoreAllUnread(exhibitId: string, teamId: string): Promise<void> {
  const token = await getUserToken('admin', 'admin', 'gallery.ui', 'openid profile gallery');
  const api = await pwRequest.newContext({
    ignoreHTTPSErrors: true,
    extraHTTPHeaders: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
  });
  try {
    const listResponse = await api.get(
      `${Services.Gallery.API}/api/exhibits/${exhibitId}/teams/${teamId}/userarticles`
    );
    if (!listResponse.ok()) {
      console.warn(`Could not list user articles for cleanup: ${listResponse.status()}`);
      return;
    }
    const userArticles: Array<{ id: string; isRead: boolean }> = await listResponse.json();
    for (const userArticle of userArticles.filter((ua) => ua.isRead)) {
      await api.put(`${Services.Gallery.API}/api/userArticles/${userArticle.id}/isread`, {
        data: JSON.stringify(false),
      });
    }
  } finally {
    await api.dispose();
  }
}

test.describe('Archive Functionality', () => {
  test.afterEach(async ({ seededExhibit }) => {
    await restoreAllUnread(seededExhibit.exhibitId, seededExhibit.teamId);
  });

  test('Archive Article Read Toggle', async ({ galleryAuthenticatedPage: page, seededExhibit }) => {
    await gotoExhibitSection(page, seededExhibit.exhibitId, 'archive');

    // Both released articles start unread, which the tab title's "(N)" suffix reflects.
    await expect(page).toHaveTitle(/^Gallery Archive \(\d+\)$/);
    const articleCards = page.locator('section.cards mat-card');
    const intelArticle = articleCards.filter({ hasText: 'Intel Article 1' });
    const newsArticle = articleCards.filter({ hasText: 'News Article 1' });
    await expect(intelArticle).toHaveCount(1);
    await expect(newsArticle).toHaveCount(1);
    const baselineUnread = unreadFromTitle(await page.title());
    expect(baselineUnread).toBeGreaterThanOrEqual(2);

    // 1. Observe an article's 'Read' button state.
    // expect: The Read button shows an unchecked icon indicating the article is unread.
    const readButton = intelArticle.getByRole('button', { name: 'Read' });
    await expect(readButton).toBeVisible();
    await expect(readButton.locator('mat-icon')).toHaveClass(/mdi-checkbox-blank-outline/);
    await expect(intelArticle.locator('mat-card-header')).toHaveClass(/article-unread/);

    // 2. Click the 'Read' button on an unread article.
    const isReadResponse = (r: { url(): string }) =>
      /\/api\/userarticles\/[^/]+\/isread$/i.test(r.url());
    const [markReadResponse] = await Promise.all([
      page.waitForResponse(isReadResponse),
      readButton.click(),
    ]);
    expect(markReadResponse.status()).toBe(200);

    // expect: The Read button icon changes to checked/filled indicating the article is
    // now read. The card header class and the tab-title unread count corroborate it.
    await expect(readButton.locator('mat-icon')).toHaveClass(/mdi-checkbox-marked-outline/);
    await expect(intelArticle.locator('mat-card-header')).toHaveClass(/article-read/);
    await expect
      .poll(async () => unreadFromTitle(await page.title()))
      .toBe(baselineUnread - 1);

    // Only the clicked article changed state.
    await expect(newsArticle.locator('mat-card-header')).toHaveClass(/article-unread/);

    // 3. Click the 'Read' button again to toggle back to unread.
    const [markUnreadResponse] = await Promise.all([
      page.waitForResponse(isReadResponse),
      readButton.click(),
    ]);
    expect(markUnreadResponse.status()).toBe(200);

    // expect: The Read button icon changes back to unchecked.
    await expect(readButton.locator('mat-icon')).toHaveClass(/mdi-checkbox-blank-outline/);
    await expect(intelArticle.locator('mat-card-header')).toHaveClass(/article-unread/);
    await expect.poll(async () => unreadFromTitle(await page.title())).toBe(baselineUnread);
  });
});
