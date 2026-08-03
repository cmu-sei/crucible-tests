// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: gallery/gallery-test-plan.md
// seed: seed.spec.ts

import { test, expect, gotoExhibitSection } from '../../fixtures';

/**
 * Wall View Functionality §3.4 — Navigation to Archive.
 *
 * Read-only: no shared state is mutated, so the worker-scoped `seededExhibit` needs
 * no restoration.
 *
 * The Archive title's unread count is matched loosely: the Archive article store is not
 * scoped to the exhibit, so a UserArticle created for the same user in another exhibit
 * while this page is open inflates it (pending upstream:
 * `signalr.service.ts#addUserArticleHandlers` accepts UserArticle events for exhibits
 * other than the one being viewed). The article-level assertions are the substantive
 * ones for this navigation step.
 */
test.describe('Wall View Functionality', () => {
  test('Wall Navigation to Archive', async ({ galleryAuthenticatedPage: page, seededExhibit }) => {
    await gotoExhibitSection(page, seededExhibit.exhibitId, 'wall');
    await expect(page).toHaveTitle('Gallery Wall');

    // 1. Click the 'Archive' button on the Wall page.
    await page.getByRole('button', { name: 'Archive' }).click();

    // expect: User is navigated to the Archive view for the same exhibit — same
    // exhibit id in the query string, section switched to archive.
    await expect(page).toHaveURL(new RegExp(`exhibit=${seededExhibit.exhibitId}`));
    await expect(page).toHaveURL(/section=archive/);

    // expect: The page title changes to 'Gallery Archive', with the unread-article
    // count as a suffix.
    await expect(page).toHaveTitle(/^Gallery Archive \(\d+\)$/);

    // expect: Articles are listed with source type icons, dates, and action buttons.
    // Both of this exhibit's released articles are present, and nothing from a later
    // move/inject is.
    const articleCards = page.locator('section.cards mat-card');
    const intelArticle = articleCards.filter({ hasText: 'Intel Article 1' });
    await expect(intelArticle).toHaveCount(1);
    await expect(articleCards.filter({ hasText: 'News Article 1' })).toHaveCount(1);
    await expect(articleCards.filter({ hasText: 'Reporting Article 1' })).toHaveCount(0);
    // `archive.component.html` maps sourceType -> icon; Intel is mdi-shield-lock.
    await expect(intelArticle.locator('mat-icon.source-icon')).toHaveClass(/mdi-shield-lock/);
    await expect(intelArticle.getByText(/\d{1,2}\/\d{1,2}\/\d{2},? .*ET/)).toBeVisible();
    await expect(intelArticle.getByRole('button', { name: 'View' })).toBeVisible();
    await expect(intelArticle.getByRole('button', { name: 'Read' })).toBeVisible();
    await expect(intelArticle.getByRole('button', { name: 'Share' })).toBeVisible();

    // Navigate back to the Wall for step 2.
    await page.getByRole('button', { name: 'Wall' }).click();
    await expect(page).toHaveTitle('Gallery Wall');

    // 2. Click the 'Administration' button on the Wall page.
    await page.getByRole('button', { name: 'Administration' }).click();

    // expect: User is navigated to the admin section.
    await expect(page).toHaveTitle('Gallery Admin');
    await expect(page).toHaveURL(/\/admin/);
  });
});
