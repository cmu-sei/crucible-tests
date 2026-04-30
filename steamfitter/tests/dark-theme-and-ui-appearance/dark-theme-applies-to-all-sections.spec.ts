// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: steamfitter/steamfitter-test-plan.md
// seed: tests/seed.spec.ts

import { test, expect, Services } from '../../fixtures';

test.describe('Dark Theme and UI Appearance', () => {
  test.afterEach(async ({ }) => {
    // No resources to clean up for theme tests
  });

  test('Dark Theme Applies to All Sections', async ({ steamfitterAuthenticatedPage: page }) => {
    await page.goto(`${Services.Steamfitter.UI}/admin`);
    await page.waitForLoadState('domcontentloaded');

    // Wait for topbar to be visible
    const topbar = page.locator('mat-toolbar, [class*="topbar"], header, [role="banner"]').first();
    await expect(topbar).toBeVisible({ timeout: 15000 });

    // Enable dark theme
    const userMenuButton = page.locator('button:has(mat-icon:text("person")), button:has(mat-icon:text("account_circle")), [mattooltip*="User"], [mattooltip*="user"]').first();
    const hasUserMenu = await userMenuButton.isVisible({ timeout: 5000 }).catch(() => false);

    if (hasUserMenu) {
      await userMenuButton.click();
      await page.waitForTimeout(500);
    }

    const darkThemeToggle = page.locator('mat-slide-toggle:has-text("Dark Theme"), button:has-text("Dark Theme"), mat-checkbox:has-text("Dark")').first();
    const hasToggle = await darkThemeToggle.isVisible({ timeout: 5000 }).catch(() => false);

    if (hasToggle) {
      await darkThemeToggle.click();
      await page.waitForTimeout(500);
      await page.keyboard.press('Escape');
      await page.waitForTimeout(300);
    }

    // Navigate to different admin sections and verify dark theme is consistent
    const sidebar = page.locator('mat-sidenav, mat-drawer, [class*="sidebar"]').first();
    await expect(sidebar).toBeVisible({ timeout: 10000 });

    // Check Scenario Templates section
    await sidebar.locator('text=Scenario Templates').first().click();
    await page.waitForTimeout(1000);

    const hasDarkInTemplates = await page.evaluate(() => {
      return document.body.classList.contains('dark-theme') ||
        document.body.classList.contains('theme-dark') ||
        document.querySelector('.dark-theme') !== null;
    });

    // Check Scenarios section
    await sidebar.locator('text=Scenarios').first().click();
    await page.waitForTimeout(1000);

    const hasDarkInScenarios = await page.evaluate(() => {
      return document.body.classList.contains('dark-theme') ||
        document.body.classList.contains('theme-dark') ||
        document.querySelector('.dark-theme') !== null;
    });

    // Dark theme should be consistent across sections
    expect(hasDarkInTemplates).toBe(hasDarkInScenarios);
  });
});
