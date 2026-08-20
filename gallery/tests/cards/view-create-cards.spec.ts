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
 * Cards are NOT a top-level admin section. `admin-container.component.html`
 * lists only Collections, Exhibits, Users, Roles and Groups. Card management
 * lives inside a collection row's expanded detail
 * (`admin-collections.component.html`), as a `<mat-expansion-panel>` wrapping
 * `<app-admin-cards [selectedCollectionId]="element.id">`. So the plan's
 * "Navigate to a collection's card management in admin (via exhibit or
 * collection editing)" resolves to: Collections -> search -> expand the row ->
 * expand the Cards panel.
 */
async function openCollectionCardsPanel(page: Page, collectionName: string) {
  await gotoGalleryAdmin(page);
  await gotoAdminSection(page, 'Collections');

  // The collections list paginates, so filter first — otherwise a freshly
  // seeded collection can land on page 2+ and the row lookup never resolves.
  // This must happen BEFORE the Cards panel opens: that panel renders its own
  // "Search" box, and an unscoped textbox lookup would then be ambiguous.
  await page.getByRole('textbox', { name: 'Search' }).fill(collectionName);

  const row = page.getByRole('row').filter({ hasText: collectionName });
  await expect(row).toHaveCount(1);

  // Click the *name* cell, not the first cell — the first cell holds the
  // Edit/Copy/Download/Delete buttons and clicking it triggers a Download.
  await row.getByRole('cell', { name: collectionName }).click();

  const cardsPanel = page.getByRole('region', { name: 'Cards' });
  await page.getByRole('button', { name: 'Cards', exact: true }).click();
  await expect(cardsPanel).toBeVisible();
  return cardsPanel;
}

/** The Cards panel, filtered to `filterText` if given. */
async function ensureCardsPanel(
  page: Page,
  collectionName: string,
  filterText?: string
): Promise<Locator> {
  const cardsPanel = page.getByRole('region', { name: 'Cards' });
  if (filterText !== undefined) {
    const panelSearch = cardsPanel.getByRole('textbox', { name: 'Search' });
    if ((await panelSearch.inputValue().catch(() => null)) !== filterText) {
      await panelSearch.fill(filterText);
    }
  }
  return cardsPanel;
}

/** Cached Gallery API bearer token (one Keycloak round-trip per worker). */
let cachedToken: string | undefined;

async function galleryApiPost<T>(path: string, data: unknown): Promise<T> {
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
    const response = await ctx.post(`${Services.Gallery.API}${path}`, {
      headers: { Authorization: `Bearer ${cachedToken}`, 'Content-Type': 'application/json' },
      data,
    });
    expect(response.ok(), `POST ${path} -> ${response.status()}`).toBeTruthy();
    return (await response.json()) as T;
  } finally {
    await ctx.dispose();
  }
}

test.describe('Card Management', () => {
  // Only ids this spec created are tracked; deleting the collection cascades to
  // its cards. Never purge by name prefix — other specs run against the same
  // stack and their live data would go with it.
  let createdCollectionIds: string[] = [];

  test.beforeEach(() => {
    createdCollectionIds = [];
  });

  test.afterEach(async () => {
    for (const id of createdCollectionIds) {
      await apiDeleteCollectionById(id);
    }
  });

  test('View and Create Cards', async ({ galleryAuthenticatedPage: page }) => {
    const unique = `${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
    const collectionName = `Card View Collection ${unique}`;
    const seededCardName = `Seeded Card ${unique}`;
    const seededCardDescription = `Seeded card description ${unique}`;
    const newCardName = `New Card ${unique}`;
    const newCardDescription = `New card description ${unique}`;

    // Setup: a collection with one pre-existing card, so step 1's "Cards list is
    // accessible with card details" has real details to assert on. The card is
    // API-seeded because the *create* dialog is what step 2 exercises.
    const collection = await apiCreateCollection(collectionName, 'Collection for card management tests');
    createdCollectionIds.push(collection.id);
    await galleryApiPost(`/api/cards`, {
      name: seededCardName,
      description: seededCardDescription,
      move: 0,
      inject: 0,
      collectionId: collection.id,
    });

    // 1. Navigate to a collection's card management in admin
    await openCollectionCardsPanel(page, collectionName);

    // expect: Cards list is accessible with card details
    // The panel is a mat-accordion, not a mat-table: its header cells are
    // `<div mat-sort-header>` elements, which expose the button role rather than
    // columnheader.
    const panel = await ensureCardsPanel(page, collectionName);
    await expect(panel.getByRole('button', { name: 'Name', exact: true })).toBeVisible();
    await expect(panel.getByRole('button', { name: 'Description', exact: true })).toBeVisible();
    await expect(panel).toContainText(seededCardName);
    await expect(panel).toContainText(seededCardDescription);
    // The per-row actions prove this is a management view, not a read-only list.
    await expect(panel.getByRole('button', { name: `Edit ${seededCardName}` })).toHaveCount(1);
    await expect(panel.getByRole('button', { name: `Delete ${seededCardName}` })).toHaveCount(1);

    // 2. Create a new card with name and description
    await panel.getByRole('button', { name: 'Add a Card' }).click();
    await expect(page.getByRole('dialog', { name: 'Add a Card' })).toBeVisible();

    // The dialog is titled by mode (admin-card-edit-dialog.component.html binds
    // [dialogTitle] to `data.card?.id ? 'Edit Card' : 'Add a Card'`), so the add dialog
    // is titled "Add a Card" rather than "Edit Card".
    const cardDialog = page.getByRole('dialog', { name: 'Add a Card' });
    await expect(cardDialog).toBeVisible();

    await cardDialog.getByRole('textbox', { name: 'Name' }).fill(newCardName);
    await cardDialog.getByRole('textbox', { name: 'Description' }).fill(newCardDescription);

    // Pair the click with the POST: the response is the proof the card was
    // persisted, and the list refresh is driven off it.
    const [createResponse] = await Promise.all([
      page.waitForResponse(
        (r) => r.url().endsWith('/api/cards') && r.request().method() === 'POST'
      ),
      cardDialog.getByRole('button', { name: 'Save', exact: true }).click(),
    ]);
    expect(createResponse.status()).toBe(201);
    await expect(cardDialog).toHaveCount(0);

    // expect: Card is created and appears in the list
    // The cards panel paginates too, so filter by the unique name first.
    const refreshedPanel = await ensureCardsPanel(page, collectionName, newCardName);
    await expect(refreshedPanel.getByRole('button', { name: `Edit ${newCardName}` })).toHaveCount(1);
    await expect(refreshedPanel).toContainText(newCardDescription);
  });
});
