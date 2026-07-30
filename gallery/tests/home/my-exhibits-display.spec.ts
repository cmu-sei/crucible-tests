// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: gallery/gallery-test-plan.md
// seed: seed.spec.ts

import { test, expect, Services } from '../../fixtures';

/**
 * My Exhibits Landing Page §2.1 — My Exhibits Table Display.
 *
 * Read-only: navigates and asserts only, so the worker-scoped `seededExhibit`
 * needs no restoration.
 *
 * Two divergences from the plan text, both verified against the app source:
 *  - The plan lists columns "Name, Collection, Created By, Created". The real table
 *    (`home-app.component.html`, matHeaderRowDef `['name','description','collection',
 *    'dateCreated']`) renders **Name, Description, Collection, Created** — there is no
 *    'Created By' column, so the creator-name expectation cannot be asserted.
 *  - "the Gallery logo and title 'Gallery - Exercise Information Sharing'" is the topbar
 *    text (`AppTopBarText` in `assets/config/settings.json`, which contains double
 *    spaces around the dash); the document title at home is `AppTitle` = 'Gallery'.
 *
 * My Exhibits paginates at 10 rows and sibling specs seed exhibits concurrently, so the
 * seeded row is found by typing its unique name into the app's own Search box first.
 * The search input filters on `(keyup)`, so `fill()` must be followed by a key event.
 */
test.describe('My Exhibits Landing Page', () => {
  test('My Exhibits Table Display', async ({ galleryAuthenticatedPage: page, seededExhibit }) => {
    // 1. Log in and navigate to the Gallery home page.
    await page.goto(Services.Gallery.UI, { waitUntil: 'domcontentloaded' });

    // expect: The My Exhibits page loads with the Gallery logo and title.
    await expect(page).toHaveTitle('Gallery');
    await expect(page.locator('app-topbar').getByText('Gallery - Exercise Information Sharing'))
      .toBeVisible();
    await expect(page.locator('mat-icon.crucible-icon-gallery')).toBeVisible();
    await expect(page.getByText('My Exhibits')).toBeVisible();

    // expect: A table is displayed with columns Name, Description, Collection, Created
    // (see the note above about the plan's 'Created By').
    await expect(page.getByRole('table')).toBeVisible();
    await expect(page.locator('mat-header-cell')).toHaveText([
      'Name',
      'Description',
      'Collection',
      'Created',
    ]);

    // expect: Each row shows an exhibit with its name as a clickable link, collection
    // name and creation date. Assert every cell of the seeded row, not just that the
    // row exists.
    const search = page.getByRole('textbox', { name: 'Search' });
    await search.fill(seededExhibit.exhibitName);
    await search.press('End');

    const rows = page.locator('mat-row');
    await expect(rows).toHaveCount(1);
    const row = rows.first();
    // The name cell is an anchor to `/?exhibit={id}&section=wall` — that is what makes it
    // clickable. The explicit `section=wall` is load-bearing: the link used to carry no
    // section at all, and `home-app.component.ts#getQueryParams` wrote the remembered
    // section to `archive` as a side effect of rendering each row, so a click could never
    // land on the Wall. See `my-exhibits-navigation.spec.ts` for the navigation assertion.
    const nameLink = row.locator('.mat-column-name a');
    await expect(nameLink).toHaveText(seededExhibit.exhibitName);
    await expect(nameLink).toHaveAttribute(
      'href',
      `/?exhibit=${seededExhibit.exhibitId}&section=wall`
    );
    await expect(row.locator('.mat-column-description')).toHaveText(
      'Auto-seeded exhibit for Playwright tests'
    );
    await expect(row.locator('.mat-column-collection')).toHaveText(seededExhibit.collectionName);
    // `dateCreated | date:'yyyy-MM-dd HH:mm'`.
    await expect(row.locator('.mat-column-dateCreated')).toHaveText(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/);

    // The paginator is rendered and wired up (its range label reflects the filtered set).
    await expect(page.locator('mat-paginator')).toContainText('1 – 1 of 1');

    // 2. Observe the Administration button (gear icon) above the table.
    // expect: The Administration button is visible for admin users.
    const adminButton = page.getByRole('button', { name: 'Administration' });
    await expect(adminButton).toBeVisible();
    await expect(adminButton.locator('mat-icon')).toHaveClass(/mdi-cog/);
  });
});
