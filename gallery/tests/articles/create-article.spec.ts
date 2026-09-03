// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: gallery/gallery-test-plan.md
// seed: seed.spec.ts

import { request as pwRequest, type Locator, type Page } from '@playwright/test';
import {
  test,
  expect,
  Services,
  gotoGalleryAdmin,
  gotoAdminSection,
  apiCreateCollection,
  apiDeleteCollectionById,
  openMatSelect,
} from '../../fixtures';

/**
 * Articles are NOT a top-level admin section — `admin-container.component.html`
 * lists only Collections, Exhibits, Users, Roles and Groups. Article management
 * lives inside a collection row's expanded detail
 * (`admin-collections.component.html`), as a `<mat-expansion-panel>` wrapping
 * `<app-admin-articles [selectedCollectionId]="element.id">`. The plan's step 1
 * ("Navigate to the Archive view for an exhibit and locate the article creation
 * functionality (or via admin)") is taken down the admin branch, because the
 * Archive branch only exposes an author-your-own-post dialog restricted to
 * cards the active team has `canPostArticles` on.
 */
async function openCollectionArticlesPanel(
  page: Page,
  collectionName: string,
  options: { fromHome?: boolean } = {}
) {
  if (options.fromHome ?? true) {
    await gotoGalleryAdmin(page);
    await gotoAdminSection(page, 'Collections');
  } else {
    // Re-entry: go straight to the admin collections URL. `admin-app.component`
    // reads `section` off the query string, so this is the same code path the
    // sidebar uses, and it does not depend on the current view still offering an
    // "Administration" button.
    await page.goto(`${Services.Gallery.UI}/admin?section=collections`, {
      waitUntil: 'domcontentloaded',
    });
  }

  // Filter before expanding the row: the collections list paginates, and the
  // Articles panel renders its own "Search" box once open, which would make an
  // unscoped textbox lookup ambiguous.
  await page.getByRole('textbox', { name: 'Search' }).fill(collectionName);

  const row = page.getByRole('row').filter({ hasText: collectionName });
  await expect(row).toHaveCount(1);

  // The name cell, not the first cell — the first cell holds the
  // Edit/Copy/Download/Delete buttons and clicking it triggers a Download.
  await row.getByRole('cell', { name: collectionName }).click();

  const articlesPanel = page.getByRole('region', { name: 'Articles' });
  await page.getByRole('button', { name: 'Articles', exact: true }).click();
  await expect(articlesPanel).toBeVisible();
  return articlesPanel;
}

/**
 * The Articles panel, filtered to `filterText` if given.
 *
 * Driving the ngx-mat-datetime-picker opens a nested dialog whose backdrop can
 * collapse the collection row's expansion panel behind it, so callers that
 * exercise the date picker re-open via `openCollectionArticlesPanel` afterwards
 * rather than assuming this helper's handle is still mounted.
 */
async function ensureArticlesPanel(
  page: Page,
  collectionName: string,
  filterText?: string
): Promise<Locator> {
  const articlesPanel = page.getByRole('region', { name: 'Articles' });
  if (filterText !== undefined) {
    const panelSearch = articlesPanel.getByRole('textbox', { name: 'Search' });
    if ((await panelSearch.inputValue().catch(() => null)) !== filterText) {
      await panelSearch.fill(filterText);
    }
  }
  return articlesPanel;
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
  // Only collection ids this spec created. Deleting a collection cascades to its
  // cards and articles. Never purge by name prefix — sibling specs are running
  // against the same stack and their live data would be destroyed with it.
  let createdCollectionIds: string[] = [];

  test.beforeEach(() => {
    createdCollectionIds = [];
  });

  test.afterEach(async () => {
    for (const id of createdCollectionIds) {
      await apiDeleteCollectionById(id);
    }
  });

  test('Create New Article', async ({ galleryAuthenticatedPage: page }) => {
    const unique = `${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
    const collectionName = `Article Create Collection ${unique}`;
    const cardName = `Article Create Card ${unique}`;
    const articleName = `New Article ${unique}`;
    const articleSummary = `Summary for new article ${unique}`;
    const articleDescription = `Description body for new article ${unique}`;
    const articleUrl = `https://example.test/article/${unique}`;

    // Setup: an own collection with one card, so the Card dropdown in step 5 has
    // a known option to select. Both are API-seeded — the create-article dialog
    // is what this test exercises.
    //
    // The seededExhibit fixture is deliberately NOT used here: every article it
    // creates carries an exhibitId, and ArticleService.GetByCollectionAsync
    // filters `a.ExhibitId == null`, so none of them are visible in this admin
    // panel at all.
    const collection = await apiCreateCollection(collectionName, 'Collection for article create tests');
    createdCollectionIds.push(collection.id);
    const card = await galleryApi('post', '/api/cards', {
      name: cardName,
      description: `Card for ${articleName}`,
      move: 0,
      inject: 0,
      collectionId: collection.id,
    });
    expect(card.status, 'seed card').toBe(201);

    // 1. Locate the article creation functionality
    await openCollectionArticlesPanel(page, collectionName);

    // expect: Article creation interface is accessible
    const panel = await ensureArticlesPanel(page, collectionName);
    const addButton = panel.getByRole('button', { name: 'Add an Article' });
    await expect(addButton).toBeVisible();
    await addButton.click();
    await expect(page.getByRole('dialog', { name: 'Add Article' })).toBeVisible();

    const dialog = page.getByRole('dialog', { name: 'Add Article' });

    // 2. Fill in the article name
    // exact: true is required — a bare "Name" also matches "Source Name".
    const nameField = dialog.getByRole('textbox', { name: 'Name', exact: true });
    await nameField.fill(articleName);
    // expect: Name field accepts text
    await expect(nameField).toHaveValue(articleName);

    // 3. Fill in summary and description/content
    const summaryField = dialog.getByRole('textbox', { name: 'Summary' });
    await summaryField.fill(articleSummary);
    // expect: Summary field accepts text
    await expect(summaryField).toHaveValue(articleSummary);

    // The description is a @kolkov/angular-editor rich-text control, i.e. a
    // contenteditable div — not an <input>, so there is no accessible textbox
    // role and no value to assert. Assert its rendered text instead.
    const descriptionEditor = dialog.locator('.angular-editor-textarea');
    await descriptionEditor.click();
    await descriptionEditor.fill(articleDescription);
    // expect: Description field accepts text
    await expect(descriptionEditor).toHaveText(articleDescription);

    // 4. Select a source type from available options
    // openMatSelect, and options addressed through the panel it returns: the two
    // dropdowns share the cdk overlay container, so opening Card below would otherwise
    // race the Source Type panel's exit animation, and a page-scoped
    // getByRole('option') could pick up its dying options. See the helper.
    const sourceTypePanel = await openMatSelect(
      dialog.getByRole('combobox', { name: 'Source Type' })
    );
    // expect: the full list from admin-article-edit-dialog.component.ts is offered
    await expect(sourceTypePanel.getByRole('option')).toHaveText([
      'Intel',
      'News',
      'Reporting',
      'Social',
      'Phone',
      'Email',
      'Orders',
    ]);
    await sourceTypePanel.getByRole('option', { name: 'News', exact: true }).click();
    // expect: Source type is selected
    await expect(dialog.getByRole('combobox', { name: 'Source Type' })).toContainText('News');

    // 5. Select a card to associate with the article
    const cardPanel = await openMatSelect(dialog.getByRole('combobox', { name: 'Card' }));
    // expect: Card dropdown shows available cards
    const cardOption = cardPanel.getByRole('option', { name: cardName });
    await expect(cardOption).toBeVisible();
    await cardOption.click();
    // expect: Card is selected
    await expect(dialog.getByRole('combobox', { name: 'Card' })).toContainText(cardName);

    // 6. Set Move and Inject numbers
    const moveField = dialog.getByRole('textbox', { name: 'Move' });
    const injectField = dialog.getByRole('textbox', { name: 'Inject' });
    await moveField.fill('2');
    await injectField.fill('3');
    // expect: Move and Inject fields accept numeric values
    await expect(moveField).toHaveValue('2');
    await expect(injectField).toHaveValue('3');

    // 7. Set the date posted
    // The control is an ngx-mat-datetime-picker. Its calendar renders inline
    // inside the article dialog while the time spinner opens as a *second*,
    // nested dialog, so the day buttons and the Apply button must be reached at
    // page scope rather than through the article dialog.
    const dateDisplay = dialog.locator('.datetime-field span').first();
    const initialDate = await dateDisplay.innerText();
    await dialog.getByRole('button', { name: 'Open calendar' }).click();

    // Pick a day in the current month that is NOT today, so the displayed value
    // is guaranteed to change. Match on the day button's accessible name
    // ("July 15, 2026") rather than its "15" text: the gridcell wraps the button,
    // so a text filter on the cell does not resolve.
    const targetDay = new Date().getUTCDate() === 15 ? 16 : 15;
    await page.getByRole('button', { name: new RegExp(`^\\w+ ${targetDay}, \\d{4}$`) }).click();
    await page.locator('.mat-datepicker-actions').getByRole('button', { name: 'Save', exact: true }).click();
    await expect(page.locator('.mat-datepicker-actions')).toHaveCount(0);

    // expect: Date picker allows date selection
    await expect(dateDisplay).toContainText(`${targetDay} `);
    expect(await dateDisplay.innerText()).not.toBe(initialDate);

    // 8. Optionally set URL and 'Open in New Tab' option
    const urlField = dialog.getByRole('textbox', { name: 'URL' });
    await urlField.fill(articleUrl);
    // expect: URL field accepts a URL string
    await expect(urlField).toHaveValue(articleUrl);

    const openInNewTab = dialog.getByRole('checkbox', { name: 'Open URL in new tab' });
    await expect(openInNewTab).not.toBeChecked();
    await openInNewTab.check();
    // expect: Open in New Tab checkbox toggles
    await expect(openInNewTab).toBeChecked();

    // 9. Click 'Save'
    const [createResponse] = await Promise.all([
      page.waitForResponse(
        (r) => r.url().endsWith('/api/articles') && r.request().method() === 'POST'
      ),
      dialog.getByRole('button', { name: 'Save', exact: true }).click(),
    ]);

    // expect: Article is created successfully
    expect(createResponse.status()).toBe(201);
    await expect(dialog).toHaveCount(0);

    // expect: New article appears in the list
    // Re-open the panel rather than reusing the handle from before the save.
    // Driving the ngx-mat-datetime-picker opens a nested dialog whose backdrop
    // can collapse the collection row's expansion panel behind it, so the
    // previously-open Articles region is not reliably still mounted here.
    await openCollectionArticlesPanel(page, collectionName, { fromHome: false });

    // The panel paginates, so filter by the unique name first.
    const createdPanel = await ensureArticlesPanel(page, collectionName, articleName);
    await expect(createdPanel.getByRole('button', { name: `Edit ${articleName}` })).toHaveCount(1);
    await expect(createdPanel).toContainText(cardName);

    // Every field set through the dialog round-tripped to the API. This is the
    // real assertion behind "created successfully" — the list row only shows
    // card, title, source, move and inject.
    const stored = await galleryApi('get', `/api/collections/${collection.id}/articles`);
    expect(stored.status).toBe(200);
    const persisted = (stored.body as Array<any>).find((a) => a.name === articleName);
    expect(persisted, 'created article is returned by the collection articles endpoint').toBeTruthy();
    expect(persisted.summary).toBe(articleSummary);
    expect(persisted.description).toBe(articleDescription);
    expect(persisted.sourceType).toBe('News');
    expect(persisted.cardId).toBe(card.body.id);
    expect(persisted.move).toBe(2);
    expect(persisted.inject).toBe(3);
    expect(persisted.url).toBe(articleUrl);
    expect(persisted.openInNewTab).toBe(true);
    expect(new Date(persisted.datePosted).getUTCDate()).toBe(targetDay);
  });
});
