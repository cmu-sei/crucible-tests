// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: gallery/gallery-test-plan.md
// seed: seed.spec.ts

import { request as pwRequest, type Locator, type Page } from '@playwright/test';
import {
  test,
  expect,
  Services,
  apiCreateCollection,
  apiDeleteCollectionById,
} from '../../fixtures';

/**
 * Articles are managed inside a collection row's expanded detail, not as a
 * top-level admin section — see the note in create-article.spec.ts.
 */
async function openCollectionArticlesPanel(page: Page, collectionName: string) {
  await page.goto(`${Services.Gallery.UI}/admin?section=collections`, {
    waitUntil: 'domcontentloaded',
  });

  // Filter before expanding: the collections list paginates, and the Articles
  // panel adds a second "Search" box once open.
  await page.getByRole('textbox', { name: 'Search' }).fill(collectionName);

  const row = page.getByRole('row').filter({ hasText: collectionName });
  await expect(row).toHaveCount(1);

  // The name cell, not the first cell — the first cell is the actions cell and
  // clicking it fires a collection Download.
  await row.getByRole('cell', { name: collectionName }).click();

  const articlesPanel = page.getByRole('region', { name: 'Articles' });
  await page.getByRole('button', { name: 'Articles', exact: true }).click();
  await expect(articlesPanel).toBeVisible();
  return articlesPanel;
}

/** The Articles panel, filtered to `filterText`. */
async function ensureArticlesPanel(
  page: Page,
  collectionName: string,
  filterText: string
): Promise<Locator> {
  const articlesPanel = page.getByRole('region', { name: 'Articles' });
  const panelSearch = articlesPanel.getByRole('textbox', { name: 'Search' });
  if ((await panelSearch.inputValue().catch(() => null)) !== filterText) {
    await panelSearch.fill(filterText);
  }
  return articlesPanel;
}

/** Assert an article row's presence. */
async function expectArticleRowCount(
  page: Page,
  collectionName: string,
  articleName: string,
  expected: number
) {
  const panel = await ensureArticlesPanel(page, collectionName, articleName);
  await expect(panel.getByRole('button', { name: `Delete ${articleName}` })).toHaveCount(expected);
}

/** Cached Gallery API bearer token (one Keycloak round-trip per worker). */
let cachedToken: string | undefined;

async function galleryApi(
  method: 'get' | 'post',
  path: string,
  data?: unknown
): Promise<{ status: number; body: any }> {
  const ctx = await pwRequest.newContext({ ignoreHTTPSErrors: true });
  try {
    if (!cachedToken) {
      const tokenResponse = await ctx.post(
        `${Services.Keycloak}/realms/crucible/protocol/openid-connect/token`,
        {
          form: {
            grant_type: 'password',
            client_id: 'gallery.ui',
            username: 'admin',
            password: 'admin',
            scope: 'openid profile gallery',
          },
        }
      );
      expect(tokenResponse.ok(), 'Keycloak token request').toBeTruthy();
      cachedToken = (await tokenResponse.json()).access_token;
    }
    const response = await ctx[method](`${Services.Gallery.API}${path}`, {
      headers: { Authorization: `Bearer ${cachedToken}`, 'Content-Type': 'application/json' },
      ...(data === undefined ? {} : { data }),
    });
    return { status: response.status(), body: await response.json().catch(() => null) };
  } finally {
    await ctx.dispose();
  }
}

test.describe('Article Management', () => {
  // The UI delete is the subject of this test, so the removal assertion stays in
  // the body; the afterEach is the safety net for a failure before or during the
  // confirm step. Only ids this spec created are tracked — deleting a collection
  // cascades to its cards and articles. Never purge by name prefix: sibling
  // specs share this stack.
  let createdCollectionIds: string[] = [];

  test.beforeEach(() => {
    createdCollectionIds = [];
  });

  test.afterEach(async () => {
    for (const id of createdCollectionIds) {
      await apiDeleteCollectionById(id);
    }
  });

  test('Delete Article', async ({ galleryAuthenticatedPage: page }) => {
    const unique = `${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
    const collectionName = `Article Delete Collection ${unique}`;
    const cardName = `Article Delete Card ${unique}`;
    const articleName = `Delete Article ${unique}`;
    const keptArticleName = `Kept Article ${unique}`;

    // Setup: an own collection with a card and two collection-level articles
    // (exhibitId null, so they are visible in the admin panel —
    // ArticleService.GetByCollectionAsync filters `a.ExhibitId == null`). The
    // second article is the control: it must still be there afterwards, proving
    // the delete was targeted rather than clearing the list.
    const collection = await apiCreateCollection(collectionName, 'Collection for article delete tests');
    createdCollectionIds.push(collection.id);

    const card = await galleryApi('post', '/api/cards', {
      name: cardName,
      description: `Card for ${articleName}`,
      move: 0,
      inject: 0,
      collectionId: collection.id,
    });
    expect(card.status, 'seed card').toBe(201);

    const seededIds: Record<string, string> = {};
    for (const name of [articleName, keptArticleName]) {
      const created = await galleryApi('post', '/api/articles', {
        name,
        summary: `Summary for ${name}`,
        description: `<p>Description for ${name}</p>`,
        collectionId: collection.id,
        cardId: card.body.id,
        move: 0,
        inject: 0,
        status: 'Unused',
        sourceType: 'Intel',
        sourceName: 'Playwright',
        datePosted: new Date().toISOString(),
        openInNewTab: false,
      });
      expect(created.status, `seed article ${name}`).toBe(201);
      seededIds[name] = created.body.id;
    }

    await openCollectionArticlesPanel(page, collectionName);

    // 1. Open the delete action for an article
    await expectArticleRowCount(page, collectionName, articleName, 1);

    // force: true is required. The button itself is enabled (disabled=null,
    // aria-disabled=null) but the enclosing `<mat-expansion-panel-header disabled>`
    // carries aria-disabled="true", and Playwright treats descendants of an
    // aria-disabled ancestor as disabled — a plain click waits out the timeout.
    const openConfirmDialog = async () => {
      const panel = await ensureArticlesPanel(page, collectionName, articleName);
      await panel.getByRole('button', { name: `Delete ${articleName}` }).click({ force: true });
      const confirm = page.getByRole('dialog').filter({ hasText: 'Delete Article' });
      await expect(confirm).toBeVisible();
      return confirm;
    };

    const confirmDialog = await openConfirmDialog();

    // expect: Confirmation dialog appears
    // deleteArticle() in admin-articles.component.ts raises a
    // CrucibleDialogService.confirm titled 'Delete Article'.
    await expect(confirmDialog).toContainText(
      `Are you sure that you want to delete ${articleName}?`
    );

    // 2. Click 'Cancel' in the confirmation dialog
    await confirmDialog.getByRole('button', { name: 'Cancel' }).click();

    // expect: Dialog closes
    await expect(confirmDialog).toHaveCount(0);

    // expect: Article is not deleted. The row check is panel-rebuild tolerant;
    // the API check is the unambiguous one — Cancel must not have deleted
    // anything.
    await expectArticleRowCount(page, collectionName, articleName, 1);
    const afterCancel = await galleryApi('get', `/api/collections/${collection.id}/articles`);
    expect(afterCancel.status).toBe(200);
    expect(
      (afterCancel.body as Array<{ id: string }>).map((a) => a.id),
      'Cancel must not delete the article'
    ).toContain(seededIds[articleName]);

    // 3. Click Delete again and confirm
    const confirmDialog2 = await openConfirmDialog();

    const [deleteResponse] = await Promise.all([
      page.waitForResponse(
        (r) => /\/api\/articles\/[0-9a-f-]{36}$/.test(r.url()) && r.request().method() === 'DELETE'
      ),
      confirmDialog2.getByRole('button', { name: 'Delete', exact: true }).click(),
    ]);

    // expect: Article is deleted successfully
    expect(deleteResponse.status()).toBe(204);
    await expect(confirmDialog2).toHaveCount(0);

    // expect: Article is removed from the list
    await expectArticleRowCount(page, collectionName, articleName, 0);

    // ...and only that article went. The control row survives, and the API agrees.
    await expectArticleRowCount(page, collectionName, keptArticleName, 1);

    const remaining = await galleryApi('get', `/api/collections/${collection.id}/articles`);
    expect(remaining.status).toBe(200);
    const remainingIds = (remaining.body as Array<{ id: string }>).map((a) => a.id);
    expect(remainingIds).not.toContain(seededIds[articleName]);
    expect(remainingIds).toContain(seededIds[keptArticleName]);
  });
});
