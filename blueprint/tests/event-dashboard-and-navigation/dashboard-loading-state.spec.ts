// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: specs/blueprint-test-plan.md
// seed: tests/seed.spec.ts

import { test, expect, Services, serviceUrlPattern, BLUEPRINT_THEMES, applyBlueprintTheme } from '../../fixtures';
import { dashboardCard } from '../../test-helpers';

for (const theme of BLUEPRINT_THEMES) {
    test.describe(`${theme} theme › Event Dashboard and Navigation`, () => {
    test('Dashboard Loading State', async ({ blueprintAuthenticatedPage: page }) => {
    await applyBlueprintTheme(page, theme);
      // 1. Navigate to Event Dashboard immediately after login

      // Capture early loading state by listening for the page immediately
      // expect: During data initialization, a loading card may be displayed
      // expect: Loading card shows 'Initializing Data' title with 'Please wait ...' subtitle
      // expect: A progress spinner is visible
      // We check early DOM state before networkidle
      await expect(page).toHaveURL(serviceUrlPattern(Services.Blueprint.UI), { timeout: 30000 });

      // Check for loading indicators at initial page load (may appear briefly)
      // Check for any of these loading indicators
      const loadingIndicators = [
        page.getByText('Initializing Data'),
        page.getByText('Please wait'),
        page.locator('mat-spinner'),
        page.locator('[class*="loading-card"]'),
        page.locator('[class*="progress-spinner"]')
      ];

      // Loading state is transient — we check if any loading indicator was shown
      let loadingVisible = false;
      for (const indicator of loadingIndicators) {
        const isVisible = await indicator.isVisible({ timeout: 1000 }).catch(() => false);
        if (isVisible) {
          loadingVisible = true;
          break;
        }
      }

      // expect: After data loads, dashboard shows available cards.
      // The card assertion below is the wait — `toBeVisible` polls, so a separate
      // `waitForLoadState('networkidle')` added latency without adding certainty.
      // Admin user sees the BUILD card
      const buildCard = dashboardCard(page, 'BUILD');
      await expect(buildCard).toBeVisible({ timeout: 10000 });

      // Verify the card has the expected subtitle
      await expect(buildCard).toContainText('Design & Planning');

      // If loading was seen, confirm it is now gone
      if (loadingVisible) {
        const stillLoading = await page.getByText('Initializing Data').isVisible({ timeout: 1000 }).catch(() => false);
        expect(stillLoading).toBe(false);
      }
    });
    });
}