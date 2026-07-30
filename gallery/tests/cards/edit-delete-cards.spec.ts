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
} from '../../fixtures';

/**
 * Card management lives inside a collection row's expanded detail, not as a
 * top-level admin section — see the note in view-create-cards.spec.ts.
 */
async function openCollectionCardsPanel(page: Page, collectionName: string) {
  await gotoGalleryAdmin(page);
  await gotoAdminSection(page, 'Collections');

  // Filter before expanding: the collections list paginates, and the Cards panel
  // adds a second "Search" box once open.
  await page.getByRole('textbox', { name: 'Search' }).fill(collectionName);

  const row = page.getByRole('row').filter({ hasText: collectionName });
  await expect(row).toHaveCount(1);

  // The name cell, not the first cell — the first cell is the actions cell and
  // clicking it fires a collection Download.
  await row.getByRole('cell', { name: collectionName }).click();

  const cardsPanel = page.getByRole('region', { name: 'Cards' });
  await page.getByRole('button', { name: 'Cards', exact: true }).click();
  await expect(cardsPanel).toBeVisible();
  return cardsPanel;
}

/** The Cards panel, filtered to `filterText`. */
async function ensureCardsPanel(
  page: Page,
  collectionName: string,
  filterText: string
): Promise<Locator> {
  const cardsPanel = page.getByRole('region', { name: 'Cards' });
  const panelSearch = cardsPanel.getByRole('textbox', { name: 'Search' });
  if ((await panelSearch.inputValue().catch(() => null)) !== filterText) {
    await panelSearch.fill(filterText);
  }
  return cardsPanel;
}

/** Assert a card row's presence. */
async function expectCardRowCount(
  page: Page,
  collectionName: string,
  cardName: string,
  expected: number
) {
  const panel = await ensureCardsPanel(page, collectionName, cardName);
  await expect(panel.getByRole('button', { name: `Delete ${cardName}` })).toHaveCount(expected);
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

test.describe('Card Management', () => {
  // Only the collection ids this spec created. Deleting a collection cascades to
  // its cards and articles, so one delete per collection is enough. Never purge
  // by name prefix — sibling specs share this stack.
  let createdCollectionIds: string[] = [];

  test.beforeEach(() => {
    createdCollectionIds = [];
  });

  test.afterEach(async () => {
    for (const id of createdCollectionIds) {
      await apiDeleteCollectionById(id);
    }
  });

  test('Edit and Delete Cards', async ({ galleryAuthenticatedPage: page }) => {
    const unique = `${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
    const collectionName = `Card Edit Collection ${unique}`;
    const editCardName = `Edit Card ${unique}`;
    const editedCardName = `Edited Card ${unique}`;
    const editedCardDescription = `Edited card description ${unique}`;
    const deleteCardName = `Delete Card ${unique}`;
    const linkedCardName = `Linked Card ${unique}`;
    const linkedArticleName = `Linked Article ${unique}`;

    // Setup: one collection holding three cards — one to edit, one to delete,
    // and one that owns an article so step 2's "associated articles are handled
    // appropriately" has something real to observe. All API-seeded: the dialogs
    // under test are edit and delete, not create.
    const collection = await apiCreateCollection(collectionName, 'Collection for card edit/delete tests');
    createdCollectionIds.push(collection.id);

    for (const name of [editCardName, deleteCardName]) {
      const created = await galleryApi('post', '/api/cards', {
        name,
        description: `Original description for ${name}`,
        move: 0,
        inject: 0,
        collectionId: collection.id,
      });
      expect(created.status, `seed card ${name}`).toBe(201);
    }

    const linkedCard = await galleryApi('post', '/api/cards', {
      name: linkedCardName,
      description: `Original description for ${linkedCardName}`,
      move: 0,
      inject: 0,
      collectionId: collection.id,
    });
    expect(linkedCard.status, 'seed linked card').toBe(201);

    const linkedArticle = await galleryApi('post', '/api/articles', {
      name: linkedArticleName,
      summary: 'Article attached to a card that will be deleted',
      description: '<p>Article attached to a card that will be deleted</p>',
      collectionId: collection.id,
      cardId: linkedCard.body.id,
      move: 0,
      inject: 0,
      status: 'Unused',
      sourceType: 'Intel',
      sourceName: 'Playwright',
      datePosted: new Date().toISOString(),
      openInNewTab: false,
    });
    expect(linkedArticle.status, 'seed linked article').toBe(201);

    await openCollectionCardsPanel(page, collectionName);

    // ---------------------------------------------------------------------
    // 1. Edit an existing card by modifying its name and description
    // ---------------------------------------------------------------------
    // force: true is required. The buttons themselves are enabled
    // (disabled=null, aria-disabled=null) but each row is a
    // `<mat-expansion-panel disabled>` whose `<mat-expansion-panel-header>`
    // carries aria-disabled="true"; Playwright treats descendants of an
    // aria-disabled ancestor as disabled and would wait out the full timeout.
    const editPanel = await ensureCardsPanel(page, collectionName, editCardName);
    await editPanel.getByRole('button', { name: `Edit ${editCardName}` }).click({ force: true });
    // The dialog title is hardcoded to "Edit Card" in
    // admin-card-edit-dialog.component.html.
    await expect(page.getByRole('dialog', { name: 'Edit Card' })).toBeVisible();

    const editDialog = page.getByRole('dialog', { name: 'Edit Card' });

    // expect: the dialog is pre-populated with the current card values
    const nameField = editDialog.getByRole('textbox', { name: 'Name' });
    const descriptionField = editDialog.getByRole('textbox', { name: 'Description' });
    await expect(nameField).toHaveValue(editCardName);
    await expect(descriptionField).toHaveValue(`Original description for ${editCardName}`);

    await nameField.fill(editedCardName);
    await descriptionField.fill(editedCardDescription);

    const [updateResponse] = await Promise.all([
      page.waitForResponse(
        (r) => /\/api\/cards\/[0-9a-f-]{36}$/.test(r.url()) && r.request().method() === 'PUT'
      ),
      editDialog.getByRole('button', { name: 'Save', exact: true }).click(),
    ]);

    // expect: Changes are saved successfully
    expect(updateResponse.status()).toBe(200);
    await expect(editDialog).toHaveCount(0);

    const editedPanel = await ensureCardsPanel(page, collectionName, editedCardName);
    await expect(editedPanel.getByRole('button', { name: `Edit ${editedCardName}` })).toHaveCount(1);
    await expect(editedPanel).toContainText(editedCardDescription);

    // The pre-edit name is gone from the list.
    const preEditPanel = await ensureCardsPanel(page, collectionName, editCardName);
    await expect(preEditPanel.getByRole('button', { name: `Edit ${editCardName}` })).toHaveCount(0);

    // ---------------------------------------------------------------------
    // 2. Delete a card
    // ---------------------------------------------------------------------
    // deleteCard() in admin-cards.component.ts raises a
    // CrucibleDialogService.confirm with title 'Delete Card'.
    const openDeleteConfirm = async (cardName: string) => {
      const panel = await ensureCardsPanel(page, collectionName, cardName);
      await panel.getByRole('button', { name: `Delete ${cardName}` }).click({ force: true });
      const confirm = page.getByRole('dialog').filter({ hasText: 'Delete Card' });
      await expect(confirm).toBeVisible();
      return confirm;
    };

    const confirmDialog = await openDeleteConfirm(deleteCardName);
    await expect(confirmDialog).toContainText(
      `Are you sure that you want to delete ${deleteCardName}?`
    );

    // Cancel first: a confirm dialog that deletes on dismiss would be a bug.
    await confirmDialog.getByRole('button', { name: 'Cancel' }).click();
    await expect(confirmDialog).toHaveCount(0);
    await expectCardRowCount(page, collectionName, deleteCardName, 1);

    const confirmDialog2 = await openDeleteConfirm(deleteCardName);
    const [deleteResponse] = await Promise.all([
      page.waitForResponse(
        (r) => /\/api\/cards\/[0-9a-f-]{36}$/.test(r.url()) && r.request().method() === 'DELETE'
      ),
      confirmDialog2.getByRole('button', { name: 'Delete', exact: true }).click(),
    ]);
    expect(deleteResponse.status()).toBe(204);

    // expect: Card is removed from the list
    await expectCardRowCount(page, collectionName, deleteCardName, 0);

    // ---------------------------------------------------------------------
    // expect: Associated articles are handled appropriately
    //
    // "Appropriately" here means the article is never orphaned: the delete is
    // rejected with a 409 Conflict naming the blocking article(s)
    // (`CardService.DeleteAsync` counts `Articles.CardId == id` and throws a
    // `ConflictException` with a singular/plural message — see
    // `gallery.api/Gallery.Api/Services/CardService.cs`), and the article
    // survives.
    // ---------------------------------------------------------------------
    await expectCardRowCount(page, collectionName, linkedCardName, 1);
    const linkedConfirm = await openDeleteConfirm(linkedCardName);
    const [linkedDeleteResponse] = await Promise.all([
      page.waitForResponse(
        (r) => /\/api\/cards\/[0-9a-f-]{36}$/.test(r.url()) && r.request().method() === 'DELETE'
      ),
      linkedConfirm.getByRole('button', { name: 'Delete', exact: true }).click(),
    ]);
    expect(linkedDeleteResponse.status()).toBe(409);
    expect((await linkedDeleteResponse.json()).title).toBe(
      'This card has 1 article. Delete or reassign them before deleting the card.'
    );

    // The failure is surfaced to the user rather than silently swallowed.
    const errorDialog = page.getByRole('dialog').filter({ hasText: 'Conflict' });
    await expect(errorDialog).toContainText(
      'This card has 1 article. Delete or reassign them before deleting the card.'
    );

    // The error dialog is aria-modal, so everything behind it is aria-hidden and
    // no role-based locator in the cards panel resolves while it is open. Close
    // it before asserting the row survived.
    await errorDialog.getByRole('button').click();
    await expect(errorDialog).toHaveCount(0);

    // The card is still listed, and its article still exists.
    await expectCardRowCount(page, collectionName, linkedCardName, 1);
    const remainingArticles = await galleryApi(
      'get',
      `/api/collections/${collection.id}/articles`
    );
    expect(remainingArticles.status).toBe(200);
    expect(
      (remainingArticles.body as Array<{ name: string }>).map((a) => a.name)
    ).toContain(linkedArticleName);

    // A card WITHOUT articles still deletes successfully — the fix only blocks
    // deletes that would orphan an article, not deletes in general. The
    // `deleteCardName` card deleted via the UI above (204, removed from the list)
    // already covers this path.
  });
});
