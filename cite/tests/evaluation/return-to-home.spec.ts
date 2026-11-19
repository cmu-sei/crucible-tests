// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: cite/cite-test-plan.md
// seed: tests/seed.spec.ts

import { test, expect, Services, loadCiteSeedIds, CITE_THEMES, setCiteTheme } from '../../fixtures';

for (const theme of CITE_THEMES) {
  test.describe(`${theme} theme › Evaluation Dashboard Interface`, () => {
    test('Return to Home from Evaluation', async ({ citeAuthenticatedPage: page }) => {
      await setCiteTheme(page, theme);

      // The run-level shared evaluation (global-setup): Active, only the default move 0,
      // Admin User on its one team. This test only reads it.
      const seededData = { evaluationId: (await loadCiteSeedIds()).readOnlyEvaluationId };

      // 1. Navigate to evaluation dashboard
      await page.goto(`${Services.Cite.UI}/?evaluation=${seededData.evaluationId}`);
      await page.waitForLoadState('domcontentloaded');
      await expect(page).toHaveURL(new RegExp(seededData.evaluationId), { timeout: 15000 });

      // 2. Click on 'Home' link in the top bar
      const homeLink = page.getByRole('link', { name: 'Home' });
      await expect(homeLink).toBeVisible({ timeout: 10000 });
      await homeLink.click();

      // expect: User is navigated back to home page
      await page.waitForLoadState('domcontentloaded');
      await expect(page).toHaveURL(Services.Cite.UI, { timeout: 10000 });

      // expect: Home page content is displayed (user info and evaluation selector)
      const userButton = page.getByRole('button', { name: 'Admin User' });
      await expect(userButton).toBeVisible({ timeout: 10000 });
    });
  });
}
