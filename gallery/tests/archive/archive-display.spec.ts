// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: gallery/gallery-test-plan.md
// seed: seed.spec.ts

import { test, expect, gotoExhibitSection } from '../../fixtures';

/**
 * Archive Functionality §4.1 — Archive Page Display.
 *
 * Read-only: nothing here mutates shared state, so the worker-scoped `seededExhibit`
 * needs no restoration.
 *
 * At the seeded default position (move 0, inject 0) exactly Test Card 1's two articles
 * are released, so the title carries the "(N)" unread suffix the plan asks for and the
 * later-move articles must be absent.
 *
 * The unread number itself is asserted loosely because the Archive's article store is
 * not scoped to the exhibit: a UserArticle created for the same user in another exhibit
 * while this page is open is pushed into the list by the SignalR handler and inflates
 * the count (reported as an app bug against
 * `signalr.service.ts#addUserArticleHandlers`). The per-article assertions below are
 * the substantive ones and are unaffected. Tighten the title to an exact "(2)" once the
 * store is exhibit-scoped.
 */
test.describe('Archive Functionality', () => {
  test('Archive Page Display', async ({ galleryAuthenticatedPage: page, seededExhibit }) => {
    // 1. Navigate to the seeded exhibit's Archive view.
    await gotoExhibitSection(page, seededExhibit.exhibitId, 'archive');

    // expect: The Archive page loads with the title 'Gallery Archive (N)'.
    await expect(page).toHaveTitle(/^Gallery Archive \(\d+\)$/);

    // expect: Articles are displayed as cards showing source type icon, title,
    // source name, date, description.
    const articleCards = page.locator('section.cards mat-card');
    await expect(articleCards.locator('.article-title')).toHaveText([
      'News Article 1',
      'Intel Article 1',
    ]);
    // Nothing from a later move/inject has been released yet.
    for (const unreleased of ['Reporting Article 1', 'Social Article 1', 'Orders Article 1']) {
      await expect(articleCards.filter({ hasText: unreleased })).toHaveCount(0);
    }

    const intelArticle = articleCards.filter({ hasText: 'Intel Article 1' });
    await expect(intelArticle.locator('mat-icon.source-icon')).toHaveClass(/mdi-shield-lock/);
    await expect(intelArticle.locator('.article-subtitle')).toHaveText('E2E Test Source');
    await expect(intelArticle.getByText(/\d{1,2}\/\d{1,2}\/\d{2},? .*ET/)).toBeVisible();
    await expect(intelArticle.locator('.summary-text')).toHaveText('E2E test intel article');

    // expect: Each article has 'View', 'Read', and 'Share' action buttons.
    for (const articleName of ['Intel Article 1', 'News Article 1']) {
      const card = articleCards.filter({ hasText: articleName });
      await expect(card.getByRole('button', { name: 'View' })).toBeVisible();
      await expect(card.getByRole('button', { name: 'Read' })).toBeVisible();
      await expect(card.getByRole('button', { name: 'Share' })).toBeVisible();
    }

    // expect: Source type filter buttons are visible.
    for (const sourceType of ['Intel', 'Reporting', 'Orders', 'News', 'Social', 'Phone', 'Email']) {
      await expect(page.getByRole('button', { name: sourceType })).toBeVisible();
    }

    // expect: A search field 'Search the Archive' is visible.
    await expect(page.getByRole('textbox', { name: 'Search the Archive' })).toBeVisible();

    // expect: A card filter dropdown 'All Cards' is visible, defaulting to All Cards.
    const cardFilter = page.getByRole('combobox');
    await expect(cardFilter).toBeVisible();
    await expect(cardFilter).toHaveText('All Cards');

    // expect: Team indicator shows current team name.
    await expect(page.locator('app-team-selector').getByText('Team:')).toBeVisible();
  });
});
