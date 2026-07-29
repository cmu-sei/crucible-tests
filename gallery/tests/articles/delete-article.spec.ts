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
 *
 * This panel is destroyed by *unrelated* collection traffic, so it has to be
 * re-openable at any point; see `ensureArticlesPanel`.
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

  // Retry the section-header click: a concurrent rebuild (see
  // `ensureArticlesPanel`) can collapse the panel again immediately after it
  // opens, or tear down the header between resolving and clicking it.
  const articlesPanel = page.getByRole('region', { name: 'Articles' });
  await expect(async () => {
    if (!(await articlesPanel.isVisible().catch(() => false))) {
      await page.getByRole('button', { name: 'Articles', exact: true }).click({ timeout: 5_000 });
    }
    await expect(articlesPanel).toBeVisible({ timeout: 5_000 });
  }).toPass();
  return articlesPanel;
}

/**
 * Re-open the Articles panel if it has collapsed, and re-apply the row filter.
 *
 * The panel really does vanish underneath us, and not because of anything this
 * test does. `admin-collections.component.ts` subscribes to
 * `collectionQuery.selectAll()` and, on every emission, rebuilds `collectionList`
 * from scratch with `{ ...collection }` clones and reassigns
 * `dataSource.data`. The `<tr mat-row>` has no `trackBy`, so every row object is
 * a new identity and Angular tears the rows down and rebuilds them. The expanded
 * detail is behind `@if (element.id === expandedCollectionId)`, and
 * `<app-admin-articles>` is inside it, so the whole subtree — including the
 * Articles `mat-expansion-panel`, its open state and its Search box — is
 * destroyed and recreated collapsed.
 *
 * The store emits on any admin-group SignalR broadcast, not just on our own
 * actions: `MainHub.GetAdminIdList` puts every ViewCollections holder in the
 * `AdminCollectionGroup`, so a collection created or deleted by *any* other
 * concurrently-running spec collapses this panel. Proven by tagging the live
 * `<app-admin-articles>` element with an attribute, POSTing an unrelated
 * collection, and observing the attribute gone, `mat-expanded` count 0 and the
 * panel's Search box unmounted ~1s later.
 *
 * So a cached panel/button Locator is not stable across any await here. Every
 * fragile read goes through this helper inside `expect.toPass()`.
 */
async function ensureArticlesPanel(
  page: Page,
  collectionName: string,
  filterText: string
): Promise<Locator> {
  const articlesPanel = page.getByRole('region', { name: 'Articles' });
  if (!(await articlesPanel.isVisible().catch(() => false))) {
    // The rebuild keeps the collection row expanded — `expandedCollectionId`
    // lives on the component, not the row object — so the detail subtree and its
    // section headers are still mounted and only the inner
    // `mat-expansion-panel` reverted to collapsed. Re-clicking the section
    // header is enough and avoids a full re-navigation, which would be slower
    // and would widen the window for another rebuild.
    const sectionHeader = page.getByRole('button', { name: 'Articles', exact: true });
    if (await sectionHeader.isVisible().catch(() => false)) {
      await sectionHeader.click();
    } else {
      await openCollectionArticlesPanel(page, collectionName);
    }
    await expect(articlesPanel).toBeVisible({ timeout: 10_000 });
  }
  const panelSearch = articlesPanel.getByRole('textbox', { name: 'Search' });
  if ((await panelSearch.inputValue().catch(() => null)) !== filterText) {
    await panelSearch.fill(filterText);
  }
  return articlesPanel;
}

/** Assert an article row's presence, tolerating a panel rebuild mid-check. */
async function expectArticleRowCount(
  page: Page,
  collectionName: string,
  articleName: string,
  expected: number
) {
  await expect(async () => {
    const panel = await ensureArticlesPanel(page, collectionName, articleName);
    await expect(panel.getByRole('button', { name: `Delete ${articleName}` })).toHaveCount(
      expected
    );
  }).toPass();
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
    // Wrapped in toPass because a concurrent rebuild can detach the row between
    // resolving the button and clicking it.
    const openConfirmDialog = async () => {
      await expect(async () => {
        const panel = await ensureArticlesPanel(page, collectionName, articleName);
        await panel
          .getByRole('button', { name: `Delete ${articleName}` })
          .click({ force: true, timeout: 5_000 });
        await expect(page.getByRole('dialog').filter({ hasText: 'Delete Article' })).toBeVisible({
          timeout: 5_000,
        });
      }).toPass();
      return page.getByRole('dialog').filter({ hasText: 'Delete Article' });
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
