// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: cite/cite-test-plan.md
// seed: tests/seed.spec.ts

import { test, expect, Services, serviceUrlPattern, seedActiveEvaluation, apiDeleteEvaluation, apiDeleteEvaluationsByName, CITE_THEMES, setCiteTheme } from '../../fixtures';

/**
 * Open `evalName` from the home page's My Evaluations list.
 *
 * The evaluation is API-seeded with Admin User on one of its teams before the test
 * starts, so its row is on the list from the first load; the search narrows the
 * paginated list onto page 1.
 */
async function navigateToEvaluation(page: import('@playwright/test').Page, evalName: string) {
  await page.goto(Services.Cite.UI);
  await expect(page).toHaveURL(serviceUrlPattern(Services.Cite.UI), { timeout: 10000 });
  await expect(page.locator('text=My Evaluations')).toBeVisible({ timeout: 10000 });

  // The filter runs on keyup, so type rather than fill.
  await page.getByPlaceholder('Search').pressSequentially(evalName);
  const evalLink = page.getByRole('link', { name: evalName, exact: true });
  await expect(evalLink).toBeVisible({ timeout: 15000 });
  await evalLink.click();
}

for (const theme of CITE_THEMES) {
  test.describe(`${theme} theme › Report Interface`, () => {
    // Serial per theme, so a failure in one theme doesn't skip the other.
    test.describe.configure({ mode: 'serial' });

    // One API-seeded evaluation per theme group: an Active evaluation on the shared
    // scoresheet-ready scoring model, with a move 1 and Admin User on its team. Every
    // test here only reads it — the report and aggregate views, the print flow and the
    // User/Team toggle (which is saved in the browser's localStorage, not the
    // evaluation) — so the three tests share it. The name carries the project and
    // theme because the two theme groups can run on separate workers at once.
    let evalName = '';
    let evaluationId = '';

    test.beforeAll(async () => {
      evalName = `E2E Report ${test.info().project.name} ${theme} Evaluation`;
      // A crashed earlier run may have left this group's evaluation behind.
      await apiDeleteEvaluationsByName(evalName);
      ({ evaluationId } = await seedActiveEvaluation(evalName, { moves: 1 }));
    });

    test.afterAll(async () => {
      if (evaluationId) await apiDeleteEvaluation(evaluationId);
    });

    test('Report Display', async ({ citeAuthenticatedPage: page }) => {
      await setCiteTheme(page, theme);
      await navigateToEvaluation(page, evalName);

      // Click the Submission Review (Report) button
      const reportButton = page.locator('button[title="Submission Review"]');
      await expect(reportButton).toBeVisible({ timeout: 10000 });
      await reportButton.click();

      // Verify the report interface loads with the heading
      const reportHeading = page.locator('h2').filter({ hasText: /Responses for/ });
      await expect(reportHeading).toBeVisible({ timeout: 10000 });
      await expect(reportHeading).toContainText(evalName);

      // Verify the toggle and print buttons are present
      const viewButtons = page.getByRole('group', { name: 'Displayed responses' });
      await expect(viewButtons.getByRole('button', { name: 'User' })).toBeVisible({ timeout: 5000 });
      await expect(viewButtons.getByRole('button', { name: 'Team' })).toBeVisible({ timeout: 5000 });

      const printButton = page.getByRole('button', { name: 'Print' });
      await expect(printButton).toBeVisible({ timeout: 5000 });
    });

    test('Export Report Data', async ({ citeAuthenticatedPage: page }) => {
      await setCiteTheme(page, theme);
      await navigateToEvaluation(page, evalName);

      // Click the Aggregate Report button
      const aggregateButton = page.locator('button[title="Aggregate Report"]');
      await expect(aggregateButton).toBeVisible({ timeout: 10000 });
      await aggregateButton.click();

      // Verify the aggregate report is displayed
      const reportHeading = page.locator('h2').filter({ hasText: /Submissions Report/ });
      await expect(reportHeading).toBeVisible({ timeout: 10000 });

      // Verify the Print button is visible
      const printButton = page.getByRole('button', { name: 'Print' });
      await expect(printButton).toBeVisible({ timeout: 5000 });
      await expect(printButton).toBeEnabled({ timeout: 5000 });

      // Stub window.print to prevent the browser print dialog.
      // The component calls: replace body -> window.print() -> location.reload()
      // After reload the page returns to the home page.
      await page.evaluate(() => { window.print = () => {}; });

      await printButton.click();

      // The component triggers location.reload() after print, which navigates back
      await page.waitForLoadState('domcontentloaded', { timeout: 30000 });

      // After reload, page returns to the CITE app (confirms the print flow completed)
      await expect(page).toHaveURL(serviceUrlPattern(Services.Cite.UI), { timeout: 15000 });
    });

    test('View Team Comparison - Toggle User/Team Scores', async ({ citeAuthenticatedPage: page }) => {
      await setCiteTheme(page, theme);
      await navigateToEvaluation(page, evalName);

      // Click the Aggregate Report button
      const aggregateButton = page.locator('button[title="Aggregate Report"]');
      await expect(aggregateButton).toBeVisible({ timeout: 10000 });
      await aggregateButton.click();

      // Verify the aggregate report is displayed
      const reportHeading = page.locator('h2').filter({ hasText: /Submissions Report/ });
      await expect(reportHeading).toBeVisible({ timeout: 10000 });

      // Toggle between user and team scores.
      // NOTE: the report's initial User/Team state is persisted in localStorage and can
      // carry over from a previous test in the same worker, so do NOT assume it starts on
      // "User". Instead, read the current state and assert that each toggle FLIPS it.
      const viewButtons = page.getByRole('group', { name: 'Displayed submissions' });
      const userButton = viewButtons.getByRole('button', { name: 'User' });
      const teamButton = viewButtons.getByRole('button', { name: 'Team' });
      await expect(userButton).toBeVisible({ timeout: 5000 });

      const startUser = (await userButton.getAttribute('aria-pressed')) === 'true';

      // Selecting the opposite view flips the heading.
      await (startUser ? teamButton : userButton).click();
      await expect(reportHeading).toContainText(startUser ? 'Team' : 'User', { timeout: 5000 });

      // Selecting the starting view again returns it.
      await (startUser ? userButton : teamButton).click();
      await expect(reportHeading).toContainText(startUser ? 'User' : 'Team', { timeout: 5000 });
    });
  });
}
