// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: gallery/gallery-test-plan.md
// seed: seed.spec.ts

import { test, expect, gotoExhibitSection } from '../../fixtures';

/**
 * Archive Functionality §4.6 — Article View Action.
 *
 * 'View' calls `archive.component.ts#openMoreDialog`, which opens
 * `ArticleMoreDialogComponent` — a `crucible-dialog` titled with the article name whose
 * body renders `article.description` through angular-editor, with Cancel and
 * 'Open in New Tab' actions.
 *
 * Read-only: no shared state is mutated, so the worker-scoped `seededExhibit` needs no
 * restoration. Viewing does not mark the article read (that is the Read button), which
 * this spec asserts so a future regression there is caught here too.
 *
 * Note the read-state assertions are made per article (card header class + checkbox
 * icon) rather than through the tab title's unread count: the Archive store is not
 * filtered by exhibit, so a UserArticle created for the same user in *any* exhibit while
 * this page is open is pushed into the list and inflates that count (see the
 * cross-exhibit leak reported against `signalr.service.ts#addUserArticleHandlers`).
 * The per-article assertions are both stronger for this step and immune to that.
 */
test.describe('Archive Functionality', () => {
  test('Archive Article View Action', async ({ galleryAuthenticatedPage: page, seededExhibit }) => {
    await gotoExhibitSection(page, seededExhibit.exhibitId, 'archive');
    await expect(page).toHaveTitle(/Gallery Archive \(\d+\)/);

    const articleCards = page.locator('section.cards mat-card');
    const intelArticle = articleCards.filter({ hasText: 'Intel Article 1' });
    await expect(intelArticle).toHaveCount(1);
    await expect(articleCards.filter({ hasText: 'News Article 1' })).toHaveCount(1);

    // 1. Click the 'View' button on an article in the archive.
    const viewButton = intelArticle.getByRole('button', { name: 'View' });
    await expect(viewButton).toBeVisible();
    await viewButton.click();

    // expect: Article detail view opens.
    const dialog = page.locator('mat-dialog-container');
    await expect(dialog).toBeVisible();

    // expect: Full article content is displayed with all metadata. The dialog title is
    // the article name and the body is the seeded description HTML.
    await expect(dialog.getByRole('heading', { name: 'Intel Article 1' })).toBeVisible();
    await expect(dialog.locator('angular-editor')).toContainText(
      'This is a test article created by Playwright for E2E testing. E2E test intel article'
    );
    await expect(dialog.getByRole('button', { name: 'Open in New Tab' })).toBeVisible();

    // Closing the dialog returns to the article list unchanged, and viewing did not
    // silently mark the article read.
    await dialog.getByRole('button', { name: 'Cancel' }).click();
    await expect(dialog).toHaveCount(0);
    await expect(intelArticle.locator('mat-card-header')).toHaveClass(/article-unread/);
    await expect(
      intelArticle.locator('button[title="Read/Unread"] mat-icon')
    ).toHaveClass(/mdi-checkbox-blank-outline/);
  });
});
