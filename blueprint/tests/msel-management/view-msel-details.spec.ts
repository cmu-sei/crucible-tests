// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: specs/blueprint-test-plan.md
// seed: tests/seed.spec.ts

import { test, expect, Services } from '../../fixtures';

test.describe('MSEL Management', () => {
  test('View MSEL Details', async ({ blueprintAuthenticatedPage: page }) => {

    // 1. Navigate to MSELs list
    await page.goto(`${Services.Blueprint.UI}/build`);
    await expect(page).toHaveURL(/.*\/build.*/, { timeout: 10000 });
    await page.waitForLoadState('networkidle');

    // expect: MSELs list is visible
    const mselList = page.getByRole('table');
    await expect(mselList).toBeVisible({ timeout: 5000 });

    const mselRows = page.getByRole('row').filter({ hasNotText: 'Name Description Template Status Created By Date Created Date Modified' });

    const itemCount = await mselRows.count();

    if (itemCount > 0) {
      // 2. Click on a MSEL name or view button
      // Find a link with text content (skipping empty links)
      let firstMselLink = null;
      for (let i = 0; i < itemCount; i++) {
        const row = mselRows.nth(i);
        const links = row.getByRole('link');
        const linkCount = await links.count();
        for (let j = 0; j < linkCount; j++) {
          const link = links.nth(j);
          const linkText = await link.textContent();
          if (linkText && linkText.trim().length > 0) {
            firstMselLink = link;
            break;
          }
        }
        if (firstMselLink) break;
      }

      if (!firstMselLink) {
        test.skip();
        return;
      }

      await firstMselLink.click();
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(1000);
      
      // expect: The MSEL detail view is displayed
      const detailsContainer = page.locator(
        '[class*="msel-detail"], ' +
        '[class*="detail-view"], ' +
        '[class*="msel-container"]'
      ).first();
      
      // If no specific details container, just verify we're on a details page
      const hasNavigated = page.url().includes('msel') || 
                          await page.locator('[class*="detail"]').first().isVisible({ timeout: 2000 });
      expect(hasNavigated).toBeTruthy();
      
      // expect: All MSEL properties are shown: name, description, dates, status
      // Check for MSEL name
      const mselName = page.getByRole('textbox', { name: 'Name' });
      await expect(mselName).toBeVisible({ timeout: 5000 });
      const nameText = await mselName.inputValue();
      expect(nameText).toBeTruthy();
      expect(nameText.trim().length).toBeGreaterThan(0);
      
      // Check for description
      const description = page.getByRole('textbox', { name: 'Description' });
      const descriptionVisible = await description.isVisible({ timeout: 3000 }).catch(() => false);
      expect(descriptionVisible).toBe(true);
      
      // Check for dates
      const dateCreated = page.getByRole('textbox', { name: 'Date Created' });
      const dateCreatedVisible = await dateCreated.isVisible({ timeout: 3000 }).catch(() => false);
      expect(dateCreatedVisible).toBe(true);
      
      // Check for status
      const status = page.getByRole('combobox', { name: 'MSEL Status' });
      const statusVisible = await status.isVisible({ timeout: 3000 }).catch(() => false);
      expect(statusVisible).toBe(true);
      
      // expect: Teams and organizations associated with the MSEL are visible
      // Check for Teams tab in navigation
      const teamsTab = page.getByText('Teams');
      const teamsVisible = await teamsTab.isVisible({ timeout: 3000 }).catch(() => false);
      expect(teamsVisible).toBe(true);
      
      // expect: Scenario events timeline or list is displayed
      // Check for Scenario Events tab in navigation
      const scenarioEventsTab = page.getByText('Scenario Events', { exact: false });
      const scenarioEventsVisible = await scenarioEventsTab.first().isVisible({ timeout: 3000 }).catch(() => false);
      expect(scenarioEventsVisible).toBe(true);
      
      // expect: Creation and modification timestamps are shown
      const createdBy = page.getByRole('textbox', { name: 'Created By' });
      const createdByVisible = await createdBy.isVisible({ timeout: 3000 }).catch(() => false);
      expect(createdByVisible).toBe(true);
      
      // Verify the page has loaded completely
      await page.waitForLoadState('networkidle');
      
      // Take a screenshot for verification (optional)
      // await page.screenshot({ path: 'msel-details.png', fullPage: true });
      
    } else {
      // Skip test if no MSELs exist
      test.skip();
    }
  });
});
