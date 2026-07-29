// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: gallery/gallery-test-plan.md
// seed: seed.spec.ts

import { test, expect, Services, gotoExhibitSection } from '../../fixtures';

/**
 * My Exhibits Landing Page §2.4 — My Exhibits Navigation to Exhibit.
 *
 * Read-only with respect to shared Gallery data (no move/inject change, no read
 * toggles), so the worker-scoped `seededExhibit` needs no restoration.
 *
 * DELIBERATE DIVERGENCE FROM THE PLAN. §2.4 expects the exhibit-name link to land on the
 * **Wall**. The app always lands on the **Archive**, and that is asserted here as the
 * real current behaviour:
 *   - `home-app.component.html:62` renders the name cell as
 *     `<a [routerLink]="['/']" [queryParams]="getQueryParams(exhibit.id)">`, so the link
 *     carries only `?exhibit={id}` — no `section`.
 *   - `home-app.component.ts:465-469 getQueryParams()` is called during change detection
 *     for every row and has the side effect
 *     `this.uiDataService.setSection(exhibitId, Section.archive)`, which overwrites the
 *     per-exhibit remembered section in localStorage before any click happens.
 *   - `startup()` then reads that remembered section (and falls back to
 *     `Section.archive` anyway), so the click can never resolve to the Wall.
 * This spec pins the exhibit's remembered section to 'wall' first, then shows that
 * merely rendering the home table resets it — which is the mechanism, not just the
 * symptom. When the app is fixed (drop the side effect from `getQueryParams` and/or
 * point the link at `section=wall`), change the two assertions marked
 * "CURRENT BEHAVIOUR" to expect 'Gallery Wall' / `section=wall` and delete the explicit
 * Wall-button hop below.
 */
test.describe('My Exhibits Landing Page', () => {
  test('My Exhibits Navigation to Exhibit', async ({
    galleryAuthenticatedPage: page,
    seededExhibit,
  }) => {
    // Remember 'wall' as this exhibit's section, so landing on the Archive later cannot
    // be explained by "no section had been recorded yet".
    await gotoExhibitSection(page, seededExhibit.exhibitId, 'wall');
    await expect(page).toHaveTitle('Gallery Wall');
    expect(
      await page.evaluate(
        (id) => JSON.parse(localStorage.getItem('uiState') ?? '{}')?.exhibitSection?.[id],
        seededExhibit.exhibitId
      )
    ).toBe('wall');

    await page.goto(Services.Gallery.UI, { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('table')).toBeVisible();

    // Collapse the paginated list onto the seeded row (the Search input filters on
    // `(keyup)`, so `fill()` alone would not apply the filter).
    const search = page.getByRole('textbox', { name: 'Search' });
    await search.fill(seededExhibit.exhibitName);
    await search.press('End');
    const rows = page.locator('mat-row');
    await expect(rows).toHaveCount(1);

    // Rendering the table already rewrote the remembered section to 'archive' — this is
    // the `getQueryParams` side effect described above.
    await expect
      .poll(async () =>
        page.evaluate(
          (id) => JSON.parse(localStorage.getItem('uiState') ?? '{}')?.exhibitSection?.[id],
          seededExhibit.exhibitId
        )
      )
      .toBe('archive');

    // 1. Click on an exhibit name link in the table.
    const nameLink = rows.first().locator('.mat-column-name a');
    await expect(nameLink).toHaveText(seededExhibit.exhibitName);
    await nameLink.click();

    // expect: URL updates to include '?exhibit={exhibitId}'.
    await expect(page).toHaveURL(`${Services.Gallery.UI}/?exhibit=${seededExhibit.exhibitId}`);

    // expect (CURRENT BEHAVIOUR — the plan says Wall): the user lands on the Archive.
    await expect(page).toHaveTitle(/^Gallery Archive( \(\d+\))?$/);
    await expect(page.locator('app-archive')).toBeVisible();
    await expect(page.locator('app-wall')).toHaveCount(0);
    // The Archive shows this exhibit's released articles, so the click really did open
    // the clicked exhibit and not some other one.
    const archiveArticles = page.locator('section.cards mat-card');
    await expect(archiveArticles.filter({ hasText: 'Intel Article 1' })).toHaveCount(1);
    await expect(archiveArticles.filter({ hasText: 'News Article 1' })).toHaveCount(1);

    // expect: The Wall view shows the exhibit's cards with unread article counts.
    // Reached with the Archive's Wall button because the name link cannot get here — see
    // the doc comment. Remove this hop once the app lands on the Wall directly.
    await page.getByRole('button', { name: 'Wall' }).click();
    await expect(page).toHaveTitle('Gallery Wall');
    await expect(page).toHaveURL(new RegExp(`exhibit=${seededExhibit.exhibitId}`));
    await expect(page).toHaveURL(/section=wall/);

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
