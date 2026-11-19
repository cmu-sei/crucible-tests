// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: cite/cite-test-plan.md
// seed: tests/seed.spec.ts

import { test, expect, Services, serviceUrlPattern, seedActiveEvaluation, apiDeleteEvaluationsByName, settleForResponse, CITE_THEMES, setCiteTheme } from '../../fixtures';
import {
  getKeycloakToken,
  createGalleryCollection,
  createGalleryCard,
  createGalleryArticle,
  createGalleryExhibit,
  createGalleryTeam,
  createGalleryTeamCard,
  addUserToGalleryTeam,
  getGalleryUsers,
  deleteGalleryExhibit,
  deleteGalleryCollection,
} from './gallery-api-helpers';

/**
 * Shared helper: set up Gallery resources via the API and create a CITE evaluation
 * that links to the gallery exhibit. Returns the CITE evaluation ID.
 */
async function setupGalleryAndCiteEvaluation(
  opts: {
    evalName: string;
    collectionName: string;
    teamName: string;
    teamShort: string;
    articleCount: number;
  }
): Promise<{ token: string; collectionId: string; exhibitId: string; citeEvaluationId: string }> {

  // ── Gallery API setup ──
  const token = await getKeycloakToken();

  const collection = await createGalleryCollection(token, {
    name: opts.collectionName,
    description: `Collection for ${opts.evalName}`,
  });

  const card = await createGalleryCard(token, {
    name: `${opts.evalName} Card`,
    description: 'Card for integration test',
    move: 0,
    inject: 0,
    collectionId: collection.id,
  });

  const exhibit = await createGalleryExhibit(token, {
    collectionId: collection.id,
    currentMove: 0,
    currentInject: 0,
  });

  const galleryTeam = await createGalleryTeam(token, {
    name: opts.teamName,
    shortName: opts.teamShort,
    exhibitId: exhibit.id,
  });

  await createGalleryTeamCard(token, {
    teamId: galleryTeam.id,
    cardId: card.id,
  });

  const users = await getGalleryUsers(token);
  const adminUser = users.find((u: any) => u.name === 'Admin User' || u.name === 'admin');
  if (adminUser) {
    await addUserToGalleryTeam(token, galleryTeam.id, adminUser.id);
  }

  for (let i = 1; i <= opts.articleCount; i++) {
    await createGalleryArticle(token, {
      name: `${opts.evalName} Article ${i}`,
      summary: `Test article ${i}`,
      description: `Full content of article ${i}`,
      collectionId: collection.id,
      exhibitId: exhibit.id,
      cardId: card.id,
      move: 0,
      inject: 0,
      status: 'Open',
      sourceType: 'News',
      sourceName: `E2E Source ${i}`,
      url: `https://example.com/article-${i}`,
      datePosted: new Date().toISOString(),
      openInNewTab: true,
    });
  }

  // ── CITE: the evaluation linked to the exhibit, with Admin User on a team ──
  // Seeded through the API: without the membership the evaluation isn't in Admin User's
  // My Evaluations and its dashboard won't open. Creating it is not this test's subject;
  // the dashboard's Gallery card is.
  const { evaluationId: citeEvaluationId } = await seedActiveEvaluation(opts.evalName, {
    galleryExhibitId: exhibit.id,
    teamName: opts.teamName,
  });

  return { token, collectionId: collection.id, exhibitId: exhibit.id, citeEvaluationId };
}

/**
 * Navigate from admin view to the evaluation dashboard.
 */
async function navigateToEvaluationDashboard(page: import('@playwright/test').Page, evalId: string) {
  const evalUrl = `${Services.Cite.UI}/?evaluation=${evalId}`;
  await page.evaluate((url) => { window.location.href = url; }, evalUrl);
  await page.waitForLoadState('domcontentloaded');

  await settleForResponse(page, '/unreadarticlecount', { timeout: 30000 });
}

// Run tests serially - they share Gallery API and Keycloak infrastructure
for (const theme of CITE_THEMES) {
  test.describe(`${theme} theme › Integration with Gallery`, () => {
    // Serial per theme, so a failure in one theme doesn't skip the other.
    test.describe.configure({ mode: 'serial' });

    // Each test's evaluation name carries the theme: the two theme groups can run on
    // separate workers at once. A crashed earlier run's copy is deleted before seeding.
    test('Gallery Integration - View Articles', async ({ citeAuthenticatedPage: page }) => {
      await setCiteTheme(page, theme);

      const TEST_EVAL_NAME = `E2E Gallery View Articles ${theme}`;
      await apiDeleteEvaluationsByName(TEST_EVAL_NAME);
      let cleanup: { token: string; collectionId: string; exhibitId: string } | undefined;

      try {
        const result = await setupGalleryAndCiteEvaluation({
          evalName: TEST_EVAL_NAME,
          collectionName: 'E2E View Articles Collection',
          teamName: 'View Articles Team',
          teamShort: 'VAT',
          articleCount: 1,
        });
        cleanup = result;

        await navigateToEvaluationDashboard(page, result.citeEvaluationId);

        // Verify the Gallery card's "X unread in Gallery" count
        const unreadNotification = page.getByText(/^\d+ unread in Gallery$/);
        await expect(unreadNotification).toBeVisible({ timeout: 15000 });

        // Verify the Gallery link
        const galleryLink = page.getByRole('link', { name: 'Open Gallery' });
        await expect(galleryLink).toBeVisible({ timeout: 5000 });
      } finally {
        // Cleanup
        await apiDeleteEvaluationsByName(TEST_EVAL_NAME);
        if (cleanup) {
          const t = cleanup.token;
          await deleteGalleryExhibit(t, cleanup.exhibitId).catch(() => {});
          await deleteGalleryCollection(t, cleanup.collectionId).catch(() => {});
        }
      }
    });

    test('Gallery Integration - Unread Articles Notification', async ({ citeAuthenticatedPage: page }) => {
      await setCiteTheme(page, theme);

      const TEST_EVAL_NAME = `E2E Gallery Unread Articles ${theme}`;
      await apiDeleteEvaluationsByName(TEST_EVAL_NAME);
      let cleanup: { token: string; collectionId: string; exhibitId: string } | undefined;

      try {
        const result = await setupGalleryAndCiteEvaluation({
          evalName: TEST_EVAL_NAME,
          collectionName: 'E2E Unread Articles Collection',
          teamName: 'Unread Articles Team',
          teamShort: 'UAT',
          articleCount: 3,
        });
        cleanup = result;

        await navigateToEvaluationDashboard(page, result.citeEvaluationId);

        // Verify the unread count matches the 3 seeded articles
        const unreadNotification = page.getByText(/^\d+ unread in Gallery$/);
        await expect(unreadNotification).toHaveText('3 unread in Gallery', { timeout: 15000 });

        // Verify Gallery link with correct URL
        const galleryLink = page.getByRole('link', { name: 'Open Gallery' });
        await expect(galleryLink).toBeVisible({ timeout: 5000 });

        const href = await galleryLink.getAttribute('href');
        expect(href).toMatch(serviceUrlPattern(Services.Gallery.UI));
      } finally {
        // Cleanup
        await apiDeleteEvaluationsByName(TEST_EVAL_NAME);
        if (cleanup) {
          const t = cleanup.token;
          await deleteGalleryExhibit(t, cleanup.exhibitId).catch(() => {});
          await deleteGalleryCollection(t, cleanup.collectionId).catch(() => {});
        }
      }
    });
  });
}
