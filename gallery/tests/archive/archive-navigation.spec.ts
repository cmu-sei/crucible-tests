// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: gallery/gallery-test-plan.md
// seed: seed.spec.ts

import { test, expect, gotoExhibitSection } from '../../fixtures';

/**
 * Archive Functionality §4.9 — Archive Navigation.
 *
 * Read-only: no shared state is mutated, so the worker-scoped `seededExhibit` needs no
 * restoration.
 *
 * The Archive title's unread count is matched loosely: the Archive article store is not
 * scoped to the exhibit, so a UserArticle created for the same user in another exhibit
 * while this page is open inflates it (pending upstream:
 * `signalr.service.ts#addUserArticleHandlers` accepts UserArticle events for exhibits
 * other than the one being viewed). This spec is about navigation, and the article-level
 * assertions below are what prove the right view rendered.
 */
test.describe('Archive Functionality', () => {
  test('Archive Navigation', async ({ galleryAuthenticatedPage: page, seededExhibit }) => {
    await gotoExhibitSection(page, seededExhibit.exhibitId, 'archive');
    await expect(page).toHaveTitle(/^Gallery Archive \(\d+\)$/);

    // 1. Click the 'Wall' button from the Archive view.
    await page.getByRole('button', { name: 'Wall' }).click();

    // expect: User is navigated to the Wall view for the same exhibit — the exhibit id
    // in the query string is unchanged and the wall's own content is rendered.
    await expect(page).toHaveTitle('Gallery Wall');
    await expect(page).toHaveURL(new RegExp(`exhibit=${seededExhibit.exhibitId}`));
    await expect(page).toHaveURL(/section=wall/);
    await expect(page.getByText('Move 0, Inject 0')).toBeVisible();
    await expect(page.locator('section.cards mat-card')).toHaveCount(3);

    // Navigate back to Archive for step 2.
    await page.getByRole('button', { name: 'Archive' }).click();
    await expect(page).toHaveTitle(/^Gallery Archive \(\d+\)$/);
    await expect(
      page.locator('section.cards mat-card').filter({ hasText: 'Intel Article 1' })
    ).toHaveCount(1);

    // 2. Click the 'Administration' button from the Archive view.
    await page.getByRole('button', { name: 'Administration' }).click();

    // expect: User is navigated to the admin section.
    await expect(page).toHaveTitle('Gallery Admin');
    await expect(page).toHaveURL(/\/admin/);

    // 3. Click the Gallery logo in the top navigation.
    // `topbar.component.html` renders it as an <a [routerLink]="['/']"> wrapping the
    // crucible-icon-gallery svg icon; there is no accessible name, hence the structural
    // locator.
    await page
      .locator('app-topbar a[href="/"]')
      .filter({ has: page.locator('mat-icon[svgicon="crucible-icon-gallery"]') })
      .click();

    // expect: User is navigated to the My Exhibits home page.
    await expect(page).toHaveTitle('Gallery');
    await expect(page.getByText('My Exhibits')).toBeVisible();
    await expect(page.getByRole('table')).toBeVisible();
  });
});
