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
  openMatSelect,
  GALLERY_THEMES,
  setGalleryTheme,
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

for (const theme of GALLERY_THEMES) {
  test.describe(`${theme} theme › Article Management`, () => {
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

    test('Article Status Workflow', async ({ galleryAuthenticatedPage: page }) => {
      await setGalleryTheme(page, theme);
      const unique = `${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
      const collectionName = `Article Status Collection ${unique}`;
      const cardName = `Article Status Card ${unique}`;
      const articleName = `Status Article ${unique}`;

      // The plan writes the statuses as numeric codes. They are not numbers in this
      // build: ItemStatus in the generated API model is a string union of color
      // names, and both the API and the dialog exchange
      // 'Gray' | 'Green' | 'Yellow' | 'Orange' | 'Red'. The names are what is
      // asserted; the plan's codes have no representation to assert against.
      const statusWorkflow = ['Gray', 'Green', 'Yellow', 'Orange', 'Red'] as const;

      // Setup: an own collection with a card and one collection-level article
      // (exhibitId null) so it is visible in the admin panel —
      // ArticleService.GetByCollectionAsync filters `a.ExhibitId == null`.
      const collection = await apiCreateCollection(
        collectionName,
        'Collection for article status tests'
      );
      createdCollectionIds.push(collection.id);

      const card = await galleryApi('post', '/api/cards', {
        name: cardName,
        description: `Card for ${articleName}`,
        move: 0,
        inject: 0,
        collectionId: collection.id,
      });
      expect(card.status, 'seed card').toBe(201);

      // Seeded as Orange, deliberately *not* the workflow's first status, so
      // step 1's "set status to Gray" is a real change rather than a no-op the
      // dirty-check would reject. It is sent under its legacy name, 'Critical':
      // the API still accepts the old names (Unused, Open, Affected, Critical,
      // Closed) for existing clients and answers with the color name.
      const seededArticle = await galleryApi('post', '/api/articles', {
        name: articleName,
        summary: `Summary for ${articleName}`,
        description: `<p>Description for ${articleName}</p>`,
        collectionId: collection.id,
        cardId: card.body.id,
        move: 0,
        inject: 0,
        status: 'Critical',
        sourceType: 'Intel',
        sourceName: 'Playwright',
        datePosted: new Date().toISOString(),
        openInNewTab: false,
      });
      expect(seededArticle.status, 'seed article').toBe(201);
      expect(seededArticle.body.status, 'legacy Critical comes back as Orange').toBe('Orange');

      await openCollectionArticlesPanel(page, collectionName);

      /** Drive one status transition through the admin edit dialog and prove it persisted. */
      const setStatusViaDialog = async (status: string) => {
        const panel = await ensureArticlesPanel(page, collectionName, articleName);
        // force: true is required. The button itself is enabled (disabled=null,
        // aria-disabled=null) but the enclosing
        // `<mat-expansion-panel-header disabled>` carries aria-disabled="true",
        // and Playwright treats descendants of an aria-disabled ancestor as
        // disabled — a plain click waits out the timeout.
        await panel.getByRole('button', { name: `Edit ${articleName}` }).click({ force: true });
        await expect(page.getByRole('dialog', { name: 'Edit Article' })).toBeVisible();

        const dialog = page.getByRole('dialog', { name: 'Edit Article' });
        const statusSelect = dialog.getByRole('combobox', { name: 'Status' });
        // openMatSelect, and options addressed through the panel it returns: this runs once
        // per status, and the previous iteration's panel is still in the DOM through its
        // exit animation, where it would both race this open and make a page-scoped
        // getByRole('option') ambiguous. See the helper.
        const statusPanel = await openMatSelect(statusSelect);

        // The dropdown offers exactly the five statuses, in severity order.
        await expect(statusPanel.getByRole('option')).toHaveText([
          'Gray',
          'Green',
          'Yellow',
          'Orange',
          'Red',
        ]);
        await statusPanel.getByRole('option', { name: status, exact: true }).click();

        // expect: the dropdown shows the new selection before saving
        await expect(statusSelect).toContainText(status);

        const [updateResponse] = await Promise.all([
          page.waitForResponse(
            (r) =>
              /\/api\/articles\/[0-9a-f-]{36}$/.test(r.url()) && r.request().method() === 'PUT'
          ),
          dialog.getByRole('button', { name: 'Save', exact: true }).click(),
        ]);
        expect(updateResponse.status(), `PUT status=${status}`).toBe(200);
        await expect(dialog).toHaveCount(0);

        // The list row renders card, title, source, move and inject — never
        // status — so persistence has to be read back from the API. This is the
        // actual "status updates to X" assertion.
        const stored = await galleryApi('get', `/api/collections/${collection.id}/articles`);
        expect(stored.status).toBe(200);
        const persisted = (stored.body as Array<any>).find((a) => a.id === seededArticle.body.id);
        expect(persisted, `article still present after setting ${status}`).toBeTruthy();
        expect(persisted.status, `persisted status after selecting ${status}`).toBe(status);
      };

      // 1. Set status to 'Gray'     -> expect: status is set to Gray
      // 2. Change status to 'Green' -> expect: status updates to Green
      // 3. Change to 'Yellow'       -> expect: status updates to Yellow
      // 4. Change to 'Orange'       -> expect: status updates to Orange
      // 5. Change to 'Red'          -> expect: status updates to Red
      for (const status of statusWorkflow) {
        await setStatusViaDialog(status);
      }

      // Re-opening the dialog shows the final persisted status, so the value
      // round-trips back into the form rather than only into the request body.
      const reopenPanel = await ensureArticlesPanel(page, collectionName, articleName);
      await reopenPanel.getByRole('button', { name: `Edit ${articleName}` }).click({ force: true });
      await expect(page.getByRole('dialog', { name: 'Edit Article' })).toBeVisible();
      const reopened = page.getByRole('dialog', { name: 'Edit Article' });
      await expect(reopened.getByRole('combobox', { name: 'Status' })).toContainText('Red');
      await reopened.getByRole('button', { name: 'Cancel' }).click();
      await expect(reopened).toHaveCount(0);

      // ---------------------------------------------------------------------
      // 6. Verify status is displayed correctly in the archive and wall views
      //
      // Only the wall is verifiable. wall.component.html puts the status on the
      // card as a `<color>-status` class (statusClass() lower-cases the status name)
      // and draws a colored strip across the top. Every status but Gray shows an
      // icon on the strip, which is a role="img" labelled "Status: <color>"; Gray
      // has no icon and its strip is a hidden `card-status-none` spacer.
      //
      // The archive displays no status at all: archive.component.html renders each
      // userArticle's sourceType icon, name, sourceName, datePosted and summary
      // plus the View/Read/Share/More actions. In archive.component.ts, `status` is
      // only read inside applyFilter's search predicate and sortArticles'
      // comparator. There is no archive status indicator to assert on — see the
      // skipped test below.
      //
      // Reaching the wall needs the article on an exhibit, a team the admin belongs
      // to, and a TeamCard with isShownOnWall=true (setShownCardList() skips any
      // card without one). The admin panel only manages collection-level articles
      // (exhibitId null), which never reach the wall, so the exhibit-scoped article
      // is seeded through the API and the same five transitions are applied to it.
      // ---------------------------------------------------------------------
      const exhibit = await galleryApi('post', '/api/exhibits', {
        name: `Article Status Exhibit ${unique}`,
        description: 'Exhibit for status display checks',
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
        name: `Article Status Team ${unique}`,
        shortName: 'AST',
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

      const wallArticle = await galleryApi('post', '/api/articles', {
        name: `Wall ${articleName}`,
        summary: `Summary for ${articleName}`,
        description: `<p>Description for ${articleName}</p>`,
        collectionId: collection.id,
        exhibitId: exhibit.body.id,
        cardId: card.body.id,
        move: 0,
        inject: 0,
        status: 'Gray',
        sourceType: 'Intel',
        sourceName: 'AST',
        datePosted: new Date().toISOString(),
        openInNewTab: false,
      });
      expect(wallArticle.status, 'seed wall article').toBe(201);

      // expect: Status indicator reflects the current status, for every status.
      const expectedStripIcon: Record<string, string | null> = {
        Gray: null,
        Green: 'mdi-check-circle',
        Yellow: 'mdi-alert',
        Orange: 'mdi-alert-octagon',
        Red: 'mdi-close-octagon',
      };

      for (const status of statusWorkflow) {
        const applied = await galleryApi('put', `/api/articles/${wallArticle.body.id}`, {
          ...wallArticle.body,
          status,
        });
        expect(applied.status, `set wall article status to ${status}`).toBe(200);

        await gotoExhibitSection(page, exhibit.body.id, 'wall');
        const wallCard = page.locator('mat-card.card').filter({ hasText: cardName });
        await expect(wallCard, `wall class for ${status}`).toHaveClass(
          new RegExp(`\\b${status.toLowerCase()}-status\\b`)
        );

        const strip = wallCard.locator('.card-status');
        const icon = expectedStripIcon[status];
        if (icon) {
          await expect(wallCard.getByRole('img', { name: `Status: ${status}` })).toBeVisible();
          await expect(strip.locator('mat-icon')).toHaveClass(new RegExp(icon));
          // The strip is color and icon only; the name is for screen readers.
          await expect(strip).toHaveText('');
        } else {
          await expect(strip).toHaveClass(/card-status-none/);
          await expect(strip).toHaveAttribute('aria-hidden', 'true');
          await expect(wallCard.getByRole('img', { name: /^Status:/ })).toHaveCount(0);
        }
      }
    });
  });
}
