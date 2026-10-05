// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: cite/cite-test-plan.md
// seed: tests/seed.spec.ts

import { test, expect, Services, serviceUrlPattern, oidcStorageKey, ensureScoringModelExists, ensureTeamTypeExists, purgeStaleEvaluations, settleForResponse, CITE_THEMES, setCiteTheme } from '../../fixtures';
import { deleteEvaluationByName, navigateToAdminSection } from '../../test-helpers';
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
const SHARED_TEAM_TYPE = 'E2E Shared Team Type';

async function setupGalleryAndCiteEvaluation(
  page: import('@playwright/test').Page,
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

  // ── CITE UI: create evaluation with gallery exhibit ID ──

  // Ensure a scoring model exists so the Scoring Model dropdown is populated.
  await ensureScoringModelExists();
  await ensureTeamTypeExists(SHARED_TEAM_TYPE);

  await navigateToAdminSection(page, 'Evaluations');

  const addButton = page.getByRole('button', { name: 'Add Evaluation' });
  await expect(addButton).toBeVisible({ timeout: 10000 });
  await addButton.click();

  const dialog = page.getByRole('dialog', { name: 'Add Evaluation' });
  await expect(dialog).toBeVisible({ timeout: 5000 });

  await page.getByRole('textbox', { name: 'Evaluation Description' }).fill(opts.evalName);

  const scoringModelSelect = page.getByRole('combobox', { name: 'Scoring Model' });
  await expect(scoringModelSelect).toBeVisible({ timeout: 5000 });
  await settleForResponse(page, '/api/scoringmodels');
  await scoringModelSelect.click();
  await page.waitForTimeout(1000);
  const firstOption = page.locator('mat-option').first();
  await expect(firstOption).toBeVisible({ timeout: 10000 });
  await firstOption.click();
  await page.waitForTimeout(500);

  const galleryExhibitField = page.getByRole('textbox', { name: 'Gallery Exhibit ID' });
  await expect(galleryExhibitField).toBeVisible({ timeout: 5000 });
  await galleryExhibitField.fill(exhibit.id);

  const saveButton = dialog.getByRole('button', { name: 'Save' });
  await expect(saveButton).toBeEnabled({ timeout: 5000 });

  const createPromise = page.waitForResponse(
    response => response.url().includes('/api/evaluations') && response.request().method() === 'POST' && response.ok(),
    { timeout: 15000 }
  );
  await saveButton.click();
  const createResponse = await createPromise.catch(() => null);
  let citeEvaluationId: string | undefined;
  if (createResponse) {
    const evalData = await createResponse.json().catch(() => null);
    citeEvaluationId = evalData?.id;
  }
  await expect(dialog).not.toBeVisible({ timeout: 15000 });
  await page.waitForTimeout(2000);

  // Fallback: fetch evaluation ID via in-page API call
  if (!citeEvaluationId) {
    const citeOidcKey = oidcStorageKey('cite.ui');
    citeEvaluationId = await page.evaluate(async ({ evalName, oidcKey, citeApi }) => {
      const userStr = sessionStorage.getItem(oidcKey) ||
                      Object.values(sessionStorage).find(v => v.includes('access_token')) || '';
      try {
        const userData = JSON.parse(userStr);
        const t = userData?.access_token;
        if (t) {
          const resp = await fetch(`${citeApi}/api/my-evaluations`, {
            headers: { Authorization: `Bearer ${t}` }
          });
          if (resp.ok) {
            const evals = await resp.json();
            return evals.find((e: any) => e.description === evalName)?.id;
          }
        }
      } catch { /* ignore */ }
      return undefined;
    }, { evalName: opts.evalName, oidcKey: citeOidcKey, citeApi: Services.Cite.API });
  }

  // ── CITE UI: add team with admin user ──

  const evalRow = page.locator('tbody tr').filter({ hasText: opts.evalName }).first();
  await expect(evalRow).toBeVisible({ timeout: 15000 });
  await evalRow.click();
  await page.waitForTimeout(2000);

  const teamsPanel = page.locator('mat-expansion-panel').filter({ hasText: 'Teams' }).first();
  await expect(teamsPanel).toBeVisible({ timeout: 10000 });
  await teamsPanel.locator('mat-expansion-panel-header').click();
  await page.waitForTimeout(1000);

  const addTeamButton = teamsPanel.locator('button[title="Add Team"]');
  await expect(addTeamButton).toBeVisible({ timeout: 5000 });
  await addTeamButton.click();

  const teamDialog = page.getByRole('dialog');
  await expect(teamDialog).toBeVisible({ timeout: 5000 });
  await teamDialog.getByRole('textbox').first().fill(opts.teamName);
  await teamDialog.getByRole('textbox').nth(1).fill(opts.teamShort);

  const teamTypeCombobox = teamDialog.getByRole('combobox', { name: 'Team Type' });
  await teamTypeCombobox.click();
  await page.waitForTimeout(500);
  // Select the shared team type. Not the first option: other specs' temporary team
  // types are deleted while this one runs, and saving against one gives a 500.
  const teamTypeOption = page.getByRole('option', { name: SHARED_TEAM_TYPE, exact: true }).first(); // parallel workers can each seed one on a fresh DB
  await expect(teamTypeOption).toBeVisible({ timeout: 5000 });
  await teamTypeOption.click();
  await page.waitForTimeout(500);

  const teamSaveButton = teamDialog.getByRole('button', { name: 'Save' });
  await expect(teamSaveButton).toBeEnabled({ timeout: 5000 });
  await teamSaveButton.click();
  // Wait for the team to appear in the teams panel (indicates the dialog closed and data saved)
  await page.waitForTimeout(3000);

  const teamRow = teamsPanel.locator('mat-expansion-panel-header').filter({ hasText: opts.teamName });
  await expect(teamRow).toBeVisible({ timeout: 10000 });
  await teamRow.click();
  await page.waitForTimeout(2000);

  const membershipArea = teamsPanel.locator('app-admin-team-memberships').first();
  await expect(membershipArea).toBeVisible({ timeout: 10000 });

  // The team is brand new, so Admin User starts in the non-members list. Add them, then
  // wait for the row to move into the member list — without the membership the evaluation
  // isn't in Admin User's "My Evaluations" and its dashboard won't open.
  const usersList2 = membershipArea.locator('app-admin-team-membership-list');
  // The non-member list is paginated and other suites leave users behind, so Admin
  // User may not be on page 1. Filter it first (the filter runs on keyup, so type).
  await usersList2.getByPlaceholder('Search').pressSequentially('Admin User');
  // The table re-renders as the filter applies and as memberships refresh, which can
  // detach the button mid-click. Retry until Admin User is actually a member.
  const adminRow2 = usersList2.locator('tr').filter({ hasText: 'Admin User' }).first();
  const adminMember = membershipArea.locator('app-admin-team-member-list tr').filter({ hasText: 'Admin User' }).first();
  await expect(async () => {
    if (await adminMember.isVisible()) return;
    await adminRow2.getByRole('button').last().click({ timeout: 3000 });
    await expect(adminMember).toBeVisible({ timeout: 3000 });
  }).toPass({ timeout: 30000, intervals: [500, 1000, 2000] });

  expect(citeEvaluationId).toBeTruthy();
  return { token, collectionId: collection.id, exhibitId: exhibit.id, citeEvaluationId: citeEvaluationId! };
}

/**
 * Navigate from admin view to the evaluation dashboard.
 */
async function navigateToEvaluationDashboard(page: import('@playwright/test').Page, evalId: string) {
  const evalUrl = `${Services.Cite.UI}/?evaluation=${evalId}`;
  await page.evaluate((url) => { window.location.href = url; }, evalUrl);
  await page.waitForLoadState('domcontentloaded');

  await settleForResponse(page, '/unreadarticlecount', { timeout: 30000 });
  await page.waitForTimeout(2000);
}

// Run tests serially - they share Gallery API and Keycloak infrastructure
for (const theme of CITE_THEMES) {
  test.describe(`${theme} theme › Integration with Gallery`, () => {
    // Serial per theme, so a failure in one theme doesn't skip the other.
    test.describe.configure({ mode: 'serial' });

    // Keep the evaluations list small/deterministic — the admin suite may have flooded it.
    test.beforeAll(async () => {
      // Purge only this file's own evaluations: a broader purge deletes the
      // evaluations other files are using on the other worker.
      await purgeStaleEvaluations(['E2E Gallery ']);
    });

    test('Gallery Integration - View Articles', async ({ citeAuthenticatedPage: page }) => {
      await setCiteTheme(page, theme);

      const TEST_EVAL_NAME = 'E2E Gallery View Articles';
      let cleanup: { token: string; collectionId: string; exhibitId: string } | undefined;

      try {
        const result = await setupGalleryAndCiteEvaluation(page, {
          evalName: TEST_EVAL_NAME,
          collectionName: 'E2E View Articles Collection',
          teamName: 'View Articles Team',
          teamShort: 'VAT',
          articleCount: 1,
        });
        cleanup = result;

        await navigateToEvaluationDashboard(page, result.citeEvaluationId);

        // Verify "You have X unread Gallery item(s)" notification
        const unreadNotification = page.locator('text=/unread Gallery item/');
        await expect(unreadNotification).toBeVisible({ timeout: 15000 });

        // Verify the Gallery link
        const galleryLink = page.locator('a', { hasText: 'click here to view them in Gallery' });
        await expect(galleryLink).toBeVisible({ timeout: 5000 });
      } finally {
        // Cleanup
        await deleteEvaluationByName(page, TEST_EVAL_NAME);
        if (cleanup) {
          const t = cleanup.token;
          await deleteGalleryExhibit(t, cleanup.exhibitId).catch(() => {});
          await deleteGalleryCollection(t, cleanup.collectionId).catch(() => {});
        }
      }
    });

    test('Gallery Integration - Unread Articles Notification', async ({ citeAuthenticatedPage: page }) => {
      await setCiteTheme(page, theme);

      const TEST_EVAL_NAME = 'E2E Gallery Unread Articles';
      let cleanup: { token: string; collectionId: string; exhibitId: string } | undefined;

      try {
        const result = await setupGalleryAndCiteEvaluation(page, {
          evalName: TEST_EVAL_NAME,
          collectionName: 'E2E Unread Articles Collection',
          teamName: 'Unread Articles Team',
          teamShort: 'UAT',
          articleCount: 3,
        });
        cleanup = result;

        await navigateToEvaluationDashboard(page, result.citeEvaluationId);

        // Verify unread notification with count
        const unreadNotification = page.locator('text=/unread Gallery item/');
        await expect(unreadNotification).toBeVisible({ timeout: 15000 });

        const notificationText = await unreadNotification.textContent();
        expect(notificationText).toMatch(/\d+ unread Gallery item/);

        // Verify Gallery link with correct URL
        const galleryLink = page.locator('a', { hasText: 'click here to view them in Gallery' });
        await expect(galleryLink).toBeVisible({ timeout: 5000 });

        const href = await galleryLink.getAttribute('href');
        expect(href).toMatch(serviceUrlPattern(Services.Gallery.UI));
      } finally {
        // Cleanup
        await deleteEvaluationByName(page, TEST_EVAL_NAME);
        if (cleanup) {
          const t = cleanup.token;
          await deleteGalleryExhibit(t, cleanup.exhibitId).catch(() => {});
          await deleteGalleryCollection(t, cleanup.collectionId).catch(() => {});
        }
      }
    });
  });
}
