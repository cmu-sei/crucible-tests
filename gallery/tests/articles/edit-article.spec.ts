// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: gallery/gallery-test-plan.md
// seed: seed.spec.ts

import { request as pwRequest, type Locator, type Page } from '@playwright/test';
import {
  test,
  expect,
  Services,
  gotoExhibitSection,
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
 * The panel is destroyed by traffic this test never causes.
 * `admin-collections.component.ts` subscribes to `collectionQuery.selectAll()`
 * and rebuilds `collectionList` with `{ ...collection }` clones on every
 * emission, reassigning `dataSource.data`. `<tr mat-row>` has no `trackBy`, so
 * the rows are torn down and rebuilt; the expanded detail sits behind
 * `@if (element.id === expandedCollectionId)`, so `<app-admin-articles>` and the
 * Articles `mat-expansion-panel` are destroyed and recreated collapsed.
 *
 * The store emits on any admin-group SignalR broadcast:
 * `MainHub.GetAdminIdList` adds every ViewCollections holder to
 * `AdminCollectionGroup`, so a collection created or deleted by any other
 * concurrently-running spec (this config uses 2 local workers) collapses this
 * panel mid-test. Cached Locators are therefore not stable across awaits.
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

/** Cached Gallery API bearer token (one Keycloak round-trip per worker). */
let cachedToken: string | undefined;

async function galleryApi(
  method: 'get' | 'post' | 'put',
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
  // Only collection ids this spec created. Deleting a collection cascades to its
  // exhibits, teams, cards and articles. Never purge by name prefix — sibling
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

  test('Edit Existing Article', async ({ galleryAuthenticatedPage: page }) => {
    const unique = `${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
    const collectionName = `Article Edit Collection ${unique}`;
    const cardName = `Article Edit Card ${unique}`;
    const articleName = `Edit Article ${unique}`;
    const articleSummary = `Original summary ${unique}`;
    const articleDescription = `Original description ${unique}`;
    const updatedName = `Updated Article ${unique}`;
    const updatedSummary = `Updated summary ${unique}`;
    const updatedDescription = `Updated description ${unique}`;

    // Setup: an own collection with a card and one collection-level article
    // (exhibitId null) so it shows up in the admin panel — the seededExhibit
    // fixture's articles all carry an exhibitId and
    // ArticleService.GetByCollectionAsync filters `a.ExhibitId == null`, so they
    // are invisible there.
    const collection = await apiCreateCollection(collectionName, 'Collection for article edit tests');
    createdCollectionIds.push(collection.id);

    const card = await galleryApi('post', '/api/cards', {
      name: cardName,
      description: `Card for ${articleName}`,
      move: 0,
      inject: 0,
      collectionId: collection.id,
    });
    expect(card.status, 'seed card').toBe(201);

    const seededArticle = await galleryApi('post', '/api/articles', {
      name: articleName,
      summary: articleSummary,
      description: articleDescription,
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
    expect(seededArticle.status, 'seed article').toBe(201);

    await openCollectionArticlesPanel(page, collectionName);

    // 1. Open the edit dialog for an existing article
    // force: true is required. The button itself is enabled (disabled=null,
    // aria-disabled=null) but the enclosing `<mat-expansion-panel-header disabled>`
    // carries aria-disabled="true", and Playwright treats descendants of an
    // aria-disabled ancestor as disabled — a plain click waits out the timeout.
    //
    // Wrapped in toPass because a concurrent panel rebuild can detach the row
    // between resolving the button and clicking it.
    await expect(async () => {
      const panel = await ensureArticlesPanel(page, collectionName, articleName);
      await panel
        .getByRole('button', { name: `Edit ${articleName}` })
        .click({ force: true, timeout: 5_000 });
      await expect(page.getByRole('dialog', { name: 'Edit Article' })).toBeVisible({
        timeout: 5_000,
      });
    }).toPass();

    const dialog = page.getByRole('dialog', { name: 'Edit Article' });

    // expect: Article edit form opens with pre-populated data
    // exact: true on Name — a bare "Name" also matches "Source Name".
    const nameField = dialog.getByRole('textbox', { name: 'Name', exact: true });
    const summaryField = dialog.getByRole('textbox', { name: 'Summary' });
    const descriptionEditor = dialog.locator('.angular-editor-textarea');
    await expect(nameField).toHaveValue(articleName);
    await expect(summaryField).toHaveValue(articleSummary);
    await expect(descriptionEditor).toHaveText(articleDescription);
    await expect(dialog.getByRole('combobox', { name: 'Card' })).toContainText(cardName);
    await expect(dialog.getByRole('combobox', { name: 'Status' })).toContainText('Unused');
    await expect(dialog.getByRole('combobox', { name: 'Source Type' })).toContainText('Intel');
    await expect(dialog.getByRole('textbox', { name: 'Source Name' })).toHaveValue('Playwright');

    // Save starts disabled: crucible-dialog binds
    // [submitDisabled]="!errorFree() || !form.dirty", so an untouched form cannot
    // be submitted.
    await expect(dialog.getByRole('button', { name: 'Save', exact: true })).toBeDisabled();

    // 2. Modify the article name, summary, and description
    await nameField.fill(updatedName);
    await summaryField.fill(updatedSummary);
    await descriptionEditor.click();
    await descriptionEditor.fill(updatedDescription);
    // expect: Fields accept the changes
    await expect(nameField).toHaveValue(updatedName);
    await expect(summaryField).toHaveValue(updatedSummary);
    await expect(descriptionEditor).toHaveText(updatedDescription);

    // 3. Change the source type
    await dialog.getByRole('combobox', { name: 'Source Type' }).click();
    await page.getByRole('option', { name: 'Reporting', exact: true }).click();
    // expect: Source type dropdown allows selection change
    await expect(dialog.getByRole('combobox', { name: 'Source Type' })).toContainText('Reporting');

    // 4. Change the status
    await dialog.getByRole('combobox', { name: 'Status' }).click();
    // The plan lists the five statuses; admin-article-edit-dialog.component.ts
    // renders them in this order. They are string values ('Unused', 'Open', ...)
    // in the generated API model, not the numeric codes the plan mentions.
    await expect(page.getByRole('option')).toHaveText([
      'Unused',
      'Affected',
      'Closed',
      'Critical',
      'Open',
    ]);
    await page.getByRole('option', { name: 'Critical', exact: true }).click();
    // expect: Status dropdown allows selection
    await expect(dialog.getByRole('combobox', { name: 'Status' })).toContainText('Critical');

    // 5. Click 'Save'
    const [updateResponse] = await Promise.all([
      page.waitForResponse(
        (r) => /\/api\/articles\/[0-9a-f-]{36}$/.test(r.url()) && r.request().method() === 'PUT'
      ),
      dialog.getByRole('button', { name: 'Save', exact: true }).click(),
    ]);

    // expect: Article is updated successfully
    expect(updateResponse.status()).toBe(200);
    await expect(dialog).toHaveCount(0);

    await expect(async () => {
      const panel = await ensureArticlesPanel(page, collectionName, updatedName);
      await expect(panel.getByRole('button', { name: `Edit ${updatedName}` })).toHaveCount(1, {
        timeout: 5_000,
      });
    }).toPass();

    // The pre-edit name is gone.
    await expect(async () => {
      const panel = await ensureArticlesPanel(page, collectionName, articleName);
      await expect(panel.getByRole('button', { name: `Edit ${articleName}` })).toHaveCount(0, {
        timeout: 5_000,
      });
    }).toPass();

    // Every edited field round-tripped. The list row only shows card, title,
    // source, move and inject, so summary/description/status need the API.
    const stored = await galleryApi('get', `/api/collections/${collection.id}/articles`);
    expect(stored.status).toBe(200);
    const persisted = (stored.body as Array<any>).find((a) => a.id === seededArticle.body.id);
    expect(persisted, 'edited article is still returned by the collection').toBeTruthy();
    expect(persisted.name).toBe(updatedName);
    expect(persisted.summary).toBe(updatedSummary);
    expect(persisted.description).toBe(updatedDescription);
    expect(persisted.sourceType).toBe('Reporting');
    expect(persisted.status).toBe('Critical');

    // ---------------------------------------------------------------------
    // expect: Changes are reflected in the archive and wall views
    //
    // Only the wall half is asserted here, and only for status.
    //
    // Wall: wall.component.ts derives a card's `displayedStatus` from the most
    // recent UserArticle's article status and renders it purely as a CSS class
    // (`'card ' + displayedStatus.toLowerCase().replace(' ', '') + '-status'`).
    // So the status edit above is observable as `.critical-status`.
    //
    // Archive: archive.component.html renders sourceType icon, name, sourceName,
    // datePosted and summary — it never displays status at all (status appears
    // only in applyFilter's search text and sortArticles). There is therefore no
    // status indicator in the archive to assert on; see the skipped test below.
    //
    // Reaching the wall needs the article on an exhibit, a team the admin
    // belongs to, and a TeamCard with isShownOnWall=true. The admin panel only
    // manages collection-level articles (exhibitId null), which never reach the
    // wall, so the exhibit-scoped copy is seeded through the API and the *same*
    // status transition is applied to it.
    // ---------------------------------------------------------------------
    const exhibit = await galleryApi('post', '/api/exhibits', {
      name: `Article Edit Exhibit ${unique}`,
      description: 'Exhibit for wall-reflection check',
      collectionId: collection.id,
      showAdvanceButton: true,
    });
    expect(exhibit.status, 'seed exhibit').toBe(201);

    const users = await galleryApi('get', '/api/users');
    const adminUser = (users.body as Array<{ id: string; name?: string }>).find((u) =>
      u.name?.toLowerCase().includes('admin')
    );
    expect(adminUser, 'admin user exists in the Gallery database').toBeTruthy();

    const team = await galleryApi('post', '/api/teams', {
      name: `Article Edit Team ${unique}`,
      shortName: 'AET',
      exhibitId: exhibit.body.id,
    });
    expect(team.status, 'seed team').toBe(201);

    expect(
      (
        await galleryApi('post', '/api/teamusers', {
          teamId: team.body.id,
          userId: adminUser!.id,
          isObserver: false,
        })
      ).status,
      'add admin to team'
    ).toBe(201);

    // isShownOnWall is mandatory: setShownCardList() skips any card without a
    // TeamCard carrying it, so the wall would otherwise be empty.
    expect(
      (
        await galleryApi('post', '/api/teamcards', {
          teamId: team.body.id,
          cardId: card.body.id,
          move: 0,
          inject: 0,
          isShownOnWall: true,
          canPostArticles: true,
        })
      ).status,
      'seed team card'
    ).toBe(201);

    // The exhibit-scoped article starts Unused, mirroring the pre-edit state.
    const wallArticle = await galleryApi('post', '/api/articles', {
      name: `Wall ${articleName}`,
      summary: articleSummary,
      description: articleDescription,
      collectionId: collection.id,
      exhibitId: exhibit.body.id,
      cardId: card.body.id,
      move: 0,
      inject: 0,
      status: 'Unused',
      sourceType: 'Intel',
      sourceName: 'AET',
      datePosted: new Date().toISOString(),
      openInNewTab: false,
    });
    expect(wallArticle.status, 'seed wall article').toBe(201);

    await gotoExhibitSection(page, exhibit.body.id, 'wall');
    const wallCard = page.locator('mat-card.card').filter({ hasText: cardName });
    // 'Not Applicable' is what getDisplayedStatus() maps ItemStatus.Unused to;
    // the class strips the space.
    await expect(wallCard).toHaveClass(/notapplicable-status/);

    // Apply the same status change the dialog made, then confirm the wall follows.
    const wallStatusUpdate = await galleryApi('put', `/api/articles/${wallArticle.body.id}`, {
      ...wallArticle.body,
      status: 'Critical',
    });
    expect(wallStatusUpdate.status, 'set wall article status to Critical').toBe(200);

    await gotoExhibitSection(page, exhibit.body.id, 'wall');
    const wallCardAfter = page.locator('mat-card.card').filter({ hasText: cardName });
    await expect(wallCardAfter).toHaveClass(/critical-status/);
  });

  // eslint-disable-next-line playwright/no-skipped-test
  test.skip('Edit Existing Article - changes reflected in the archive view', () => {
    // Not implementable as written. The plan's step 5 expects "Changes are
    // reflected in the archive and wall views", but the archive has no status
    // indicator to reflect: archive.component.html renders each userArticle's
    // sourceType icon, name, sourceName, datePosted and summary plus the
    // View/Read/Share/More actions, and never renders `article.status`. In
    // archive.component.ts, `status` is only read inside applyFilter's search
    // predicate and sortArticles' comparator.
    //
    // The other edited fields (name, summary, sourceType) *are* rendered in the
    // archive, but only for exhibit-scoped articles reached through a team's
    // UserArticles — which the admin article panel cannot create, since it only
    // manages collection-level articles (exhibitId null; see
    // ArticleService.GetByCollectionAsync). Asserting the admin edit in the
    // archive would therefore mean editing a *different*, API-seeded article and
    // claiming it proved the admin dialog worked.
    //
    // Re-enable once either (a) the archive renders article status, or (b) the
    // admin panel can manage exhibit-scoped articles, at which point the same
    // record can be edited in admin and observed in the archive.
  });
});
