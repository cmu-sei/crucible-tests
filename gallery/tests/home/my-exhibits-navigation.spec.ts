// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: gallery/gallery-test-plan.md
// seed: seed.spec.ts

import { test, expect, Services } from '../../fixtures';

/**
 * My Exhibits Landing Page §2.4 — My Exhibits Navigation to Exhibit.
 *
 * Clicking an exhibit's name opens its **Archive**, not its Wall: the link carries
 * `section=archive` explicitly (`home-app.component.html:61`,
 * `[queryParams]="{ exhibit: exhibit.id, section: Section.archive }"`). The plan text
 * originally said "Wall view" — per the repository owner the Archive is the intended
 * landing view, and §2.4 of the plan now records that.
 *
 * The section used to be applied as a side effect instead: `getQueryParams()` called
 * `uiDataService.setSection(exhibit.id, Section.archive)` from inside the template binding,
 * so merely rendering the list overwrote the remembered section of every exhibit in it. The
 * landing view was the same, but a Wall visit was silently forgotten. That is why this spec
 * also asserts the section travels on the URL rather than through `localStorage['uiState']`.
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

    // expect: URL updates to include '?exhibit={exhibitId}' and 'section=archive'.
    await expect(page).toHaveURL(new RegExp(`exhibit=${seededExhibit.exhibitId}`));
    await expect(page).toHaveURL(/section=archive/);

    // expect: the user lands on the exhibit's Archive view.
    await expect(page).toHaveTitle(/^Gallery Archive \(\d+\)$/);
    await expect(page.locator('app-archive')).toBeVisible();
    await expect(page.locator('app-wall')).toHaveCount(0);

    // expect: The Archive view shows the exhibit's released articles. At the seeded
    // (move 0, inject 0) position exactly Test Card 1's two articles are released, and
    // nothing from a later move/inject has been.
    const articleCards = page.locator('section.cards mat-card');
    await expect(articleCards.locator('.article-title')).toHaveText([
      'News Article 1',
      'Intel Article 1',
    ]);
    for (const unreleased of ['Reporting Article 1', 'Social Article 1', 'Orders Article 1']) {
      await expect(articleCards.filter({ hasText: unreleased })).toHaveCount(0);
    }

    // 2. The section is carried by the link, not by remembered state: visiting the Wall
    // and returning to My Exhibits must not change where the link points, and must not
    // erase the exhibit's remembered section (which is what the old side-effecting
    // `getQueryParams()` did on every render).
    await page.getByRole('button', { name: 'Wall' }).click();
    await expect(page).toHaveTitle('Gallery Wall');
    await expect(page).toHaveURL(/section=wall/);

    await page
      .locator('app-topbar a[href="/"]')
      .filter({ has: page.locator('mat-icon[svgicon="crucible-icon-gallery"]') })
      .click();
    await expect(page).toHaveTitle('Gallery');
    await expect(page.getByRole('table')).toBeVisible();

    const remembered = await page.evaluate(
      (id: string) => JSON.parse(localStorage.getItem('uiState') ?? '{}')?.exhibitSection?.[id],
      seededExhibit.exhibitId
    );
    expect(remembered).toBe('wall');
  });
});
