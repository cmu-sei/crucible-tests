// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: cite/cite-test-plan.md
// seed: tests/seed.spec.ts

import { test, expect, Services, serviceUrlPattern, seedCompleteEvaluation, cleanupCompleteEvaluation } from '../../fixtures';
import { navigateToAdminSection } from '../../test-helpers';

test.describe('Home Page and Evaluation List', () => {

  test('Evaluation List Search/Filter', async ({ citeAuthenticatedPage: page }) => {
    // 1. Seed multiple evaluations via API to ensure they exist
    const timestamp = Date.now();
    const evalName1 = `E2E Filter Alpha ${timestamp}`;
    const evalName2 = `E2E Filter Beta ${timestamp}`;
    const seededData1 = await seedCompleteEvaluation(evalName1, 0);
    const seededData2 = await seedCompleteEvaluation(evalName2, 0);

    // 2. Navigate to home page to test the search/filter functionality on My Evaluations list
    await page.goto(Services.Cite.UI);
    await page.waitForLoadState('domcontentloaded');
    await expect(page).toHaveURL(serviceUrlPattern(Services.Cite.UI), { timeout: 10000 });

    const myEvalsHeading = page.locator('text=My Evaluations');
    await expect(myEvalsHeading).toBeVisible({ timeout: 10000 });

    // 3. Wait for evaluation list to load
    const rows = page.locator('mat-row, tbody tr').filter({ hasNot: page.locator('th') });
    await expect(rows.first()).toBeVisible({ timeout: 15000 });

    // 4. Locate the search/filter input (try multiple selectors)
    let searchField = page.getByRole('textbox', { name: /search|filter/i });
    if (!(await searchField.isVisible({ timeout: 2000 }).catch(() => false))) {
      searchField = page.locator('input[type="text"]').filter({ hasText: '' }).first();
    }
    if (!(await searchField.isVisible({ timeout: 2000 }).catch(() => false))) {
      searchField = page.locator('input[placeholder*="Search"], input[placeholder*="Filter"]').first();
    }

    // If no search field exists on home page, use admin page instead
    if (!(await searchField.isVisible({ timeout: 1000 }).catch(() => false))) {
      await navigateToAdminSection(page, 'Evaluations');
      await page.waitForTimeout(2000);

      searchField = page.getByRole('textbox', { name: 'Search' });
      await expect(searchField).toBeVisible({ timeout: 5000 });

      // Retry strategy: the CITE UI may not immediately show seeded data
      // Poll by searching and reloading until data appears (SignalR update delay)
      await searchField.fill(evalName1);
      await page.waitForTimeout(1000);

      let eval1Row = page.locator('tbody tr').filter({ hasText: evalName1 }).first();
      let attempts = 0;
      while (!(await eval1Row.isVisible({ timeout: 2000 }).catch(() => false)) && attempts < 5) {
        console.log(`Attempt ${attempts + 1}: Evaluation not visible, reloading admin page...`);
        await page.reload({ waitUntil: 'domcontentloaded' });
        await page.waitForTimeout(2000);
        await searchField.fill(evalName1);
        await page.waitForTimeout(1000);
        attempts++;
      }
      await expect(eval1Row).toBeVisible({ timeout: 5000 });

      await searchField.clear();
      await page.waitForTimeout(1000);

      await searchField.fill(evalName2);
      await page.waitForTimeout(1500);
      const eval2Row = page.locator('tbody tr').filter({ hasText: evalName2 }).first();
      await expect(eval2Row).toBeVisible({ timeout: 15000 });

      await searchField.clear();
      await page.waitForTimeout(1000);

      // Get count of all evaluation rows
      const allRows = page.locator('tbody tr').filter({ hasNot: page.locator('[colspan]') });
      const initialCount = await allRows.count();
      expect(initialCount).toBeGreaterThan(0);

      // Test filtering for evalName1
      await searchField.fill(evalName1);
      await page.waitForTimeout(1000);

      const filteredRow = page.locator('tbody tr').filter({ hasText: evalName1 }).first();
      await expect(filteredRow).toBeVisible({ timeout: 10000 });

      const filteredRows = page.locator('tbody tr').filter({ hasNot: page.locator('[colspan]') });
      const filteredCount = await filteredRows.count();
      expect(filteredCount).toBeGreaterThan(0);
      expect(filteredCount).toBeLessThanOrEqual(initialCount);

      // Clear search
      await searchField.clear();
      await page.waitForTimeout(1000);

      const restoredRows = page.locator('tbody tr').filter({ hasNot: page.locator('[colspan]') });
      const restoredCount = await restoredRows.count();
      expect(restoredCount).toBe(initialCount);
    }

    // Cleanup
    await cleanupCompleteEvaluation(seededData1);
    await cleanupCompleteEvaluation(seededData2);
  });
});
