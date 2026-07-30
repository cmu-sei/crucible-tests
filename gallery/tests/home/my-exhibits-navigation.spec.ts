// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: gallery/gallery-test-plan.md
// seed: seed.spec.ts

import { test, expect, Services } from '../../fixtures';

/**
 * My Exhibits Landing Page §2.4 — My Exhibits Navigation to Exhibit.
 *
 * Fixed (gallery.ui `0a37a10`): `home-app.component.html:61` now renders the exhibit-name
 * link with `[queryParams]="{ exhibit: exhibit.id, section: Section.wall }"` directly, and
 * `getQueryParams()` — which used to run during change detection and overwrite the
 * per-exhibit remembered section as a side effect — is gone. Clicking an exhibit's name now
 * lands on the Wall directly, satisfying test-plan §2.4.
 *
 * Read-only with respect to shared Gallery data (no move/inject change, no read toggles), so
 * the worker-scoped `seededExhibit` needs no restoration.
 */
test.describe('My Exhibits Landing Page', () => {
  test('My Exhibits Navigation to Exhibit', async ({
    galleryAuthenticatedPage: page,
    seededExhibit,
  }) => {
    await page.goto(Services.Gallery.UI, { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('table')).toBeVisible();

    // Collapse the paginated list onto the seeded row (the Search input filters on
    // `(keyup)`, so `fill()` alone would not apply the filter).
    const search = page.getByRole('textbox', { name: 'Search' });
    await search.fill(seededExhibit.exhibitName);
    await search.press('End');
    const rows = page.locator('mat-row');
    await expect(rows).toHaveCount(1);

    // 1. Click on an exhibit name link in the table.
    const nameLink = rows.first().locator('.mat-column-name a');
    await expect(nameLink).toHaveText(seededExhibit.exhibitName);
    await nameLink.click();

    // expect: URL updates to include '?exhibit={exhibitId}' and 'section=wall'.
    await expect(page).toHaveURL(new RegExp(`exhibit=${seededExhibit.exhibitId}`));
    await expect(page).toHaveURL(/section=wall/);

    // expect: the user lands on the Wall directly (test-plan §2.4).
    await expect(page).toHaveTitle('Gallery Wall');
    await expect(page.locator('app-wall')).toBeVisible();
    await expect(page.locator('app-archive')).toHaveCount(0);

    // expect: The Wall view shows the exhibit's cards with unread article counts.
    // Scoped to the seeded card names: the Wall's card store is not exhibit-scoped, so a
    // Card/TeamCard created for the same user in another exhibit while this page is open
    // is pushed onto the wall by SignalR (app bug against
    // `signalr.service.ts#addCardHandlers`/`addTeamCardHandlers`).
    const wallCards = page.locator('section.cards mat-card');
    await expect(wallCards.locator('mat-card-title').filter({ hasText: /^Test Card [123]$/ }))
      .toHaveText(['Test Card 1', 'Test Card 2', 'Test Card 3']);
    // Card 1's two articles are released at the seeded (move 0, inject 0) position, so it
    // carries the unread count; the later cards report nothing posted yet.
    await expect(
      wallCards.filter({ hasText: 'Test Card 1' }).getByRole('heading', { level: 3 })
    ).toHaveText('2 unread articles');
    await expect(
      wallCards.filter({ hasText: 'Test Card 2' }).getByRole('heading', { level: 3 })
    ).toHaveText('No articles posted');
  });
});
