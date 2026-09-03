// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: specs/blueprint-test-plan.md
// seed: tests/seed.spec.ts

import { test, expect, Services } from '../../fixtures';

test.describe('Accessibility and Usability', () => {
  test.beforeEach(async ({ blueprintAuthenticatedPage: page }) => {
    // 1. View application in desktop resolution (1920x1080)
    await page.setViewportSize({ width: 1920, height: 1080 });

    // Navigate to Blueprint application (auth state pre-loaded from setup)
    await page.goto(Services.Blueprint.UI);
    await page.waitForLoadState('domcontentloaded');
  });

  test('Responsive Layout - Desktop View', async ({ blueprintAuthenticatedPage: page }) => {
    // Verify page layout utilizes desktop space effectively
    const bodyWidth = await page.evaluate(() => document.body.scrollWidth);
    expect(bodyWidth).toBeGreaterThan(1280);

    // Check that main content area uses available space
    const mainContent = await page.locator('main, [role="main"], .content, .main-content').first();
    if (await mainContent.count() > 0) {
      await expect(mainContent).toBeVisible();
      
      const contentBox = await mainContent.boundingBox();
      if (contentBox) {
        // Content should utilize desktop space efficiently
        expect(contentBox.width).toBeGreaterThan(1000);
      }
    }

    // Verify no horizontal scrolling at desktop resolution
    const hasHorizontalScroll = await page.evaluate(() => {
      return document.documentElement.scrollWidth > document.documentElement.clientWidth;
    });
    expect(hasHorizontalScroll).toBe(false);

    // Verify navigation is fully visible and not collapsed
    const navigation = await page.locator('nav, [role="navigation"]').first();
    if (await navigation.count() > 0) {
      await expect(navigation).toBeVisible();
    }

    // Verify topbar spans full width
    const topbar = await page.locator('mat-toolbar, header, [role="banner"]').first();
    if (await topbar.count() > 0) {
      await expect(topbar).toBeVisible();
      
      const topbarBox = await topbar.boundingBox();
      if (topbarBox) {
        // Topbar should span most of the viewport width
        expect(topbarBox.width).toBeGreaterThan(1800);
      }
    }

    // 2. Resize window to various widths
    const testWidths = [1600, 1366, 1280];
    
    for (const width of testWidths) {
      await page.setViewportSize({ width, height: 1080 });

      // Wait for the layout to actually settle at the new width instead of sleeping: poll until
      // the document reports the resized viewport.
      await expect
        .poll(() => page.evaluate(() => document.documentElement.clientWidth), {
          timeout: 10000,
          intervals: [50, 100, 250],
          message: `layout should settle at ${width}px`,
        })
        .toBe(width);

      const newBodyWidth = await page.evaluate(() => document.body.scrollWidth);
      expect(newBodyWidth).toBeLessThanOrEqual(width);
      
      // Verify no content is cut off or inaccessible
      const hasHorizontalScroll = await page.evaluate(() => {
        return document.documentElement.scrollWidth > document.documentElement.clientWidth;
      });
      expect(hasHorizontalScroll).toBe(false);
      
      // Verify main content remains visible
      if (await mainContent.count() > 0) {
        await expect(mainContent).toBeVisible();
      }
      
      // Check if timeline scales appropriately (if present)
      const timeline = await page.locator('.timeline, [role="list"], .event-list, mat-list').first();
      if (await timeline.count() > 0) {
        const timelineBox = await timeline.boundingBox();
        if (timelineBox) {
          // Timeline should fit within viewport
          expect(timelineBox.width).toBeLessThanOrEqual(width);
        }
      }
    }

    // Reset to full desktop resolution
    await page.setViewportSize({ width: 1920, height: 1080 });

    // Verify multi-column layouts work properly on desktop
    const hasGridOrFlex = await page.evaluate(() => {
      const main = document.querySelector('main, [role="main"], .content');
      if (main) {
        const style = window.getComputedStyle(main);
        return style.display === 'grid' || style.display === 'flex';
      }
      return false;
    });

    // Verify tables and data grids display properly
    const tables = await page.locator('table, mat-table, [role="grid"]').all();
    for (const table of tables.slice(0, 2)) {
      const isVisible = await table.isVisible().catch(() => false);
      if (!isVisible) continue;

      await expect(table).toBeVisible();
      
      const tableBox = await table.boundingBox();
      if (tableBox) {
        // Table should fit comfortably in desktop view
        expect(tableBox.width).toBeLessThanOrEqual(1920);
      }
    }

    // The dialog-sizing block that used to live here was dead code and has been removed.
    // It was gated on `button:has-text("Create"), button:has-text("Add"), button:has-text("New")`,
    // and measured on the dashboard that locator matches **0** elements -- so neither its
    // `waitForTimeout(500)` nor any of its `expect`s ever ran. Dialog sizing on this surface is
    // covered by `focus-management-in-dialogs`, which opens a real dialog via
    // MSEL -> Teams -> New Team.

    // Verify text remains readable (not too large)
    const textElements = await page.locator('p, span, div').all();
    for (const element of textElements.slice(0, 5)) {
      const isVisible = await element.isVisible().catch(() => false);
      if (!isVisible) continue;

      const fontSize = await element.evaluate((el) => {
        return parseFloat(window.getComputedStyle(el).fontSize);
      });
      
      // Font size should be reasonable for desktop (typically 12-24px for body text)
      if (fontSize > 0) {
        expect(fontSize).toBeGreaterThan(10);
        expect(fontSize).toBeLessThan(48);
      }
    }

    // Verify sidebars or side panels display properly on desktop
    const sidebar = await page.locator('aside, .sidebar, mat-sidenav, [role="complementary"]').first();
    if (await sidebar.count() > 0) {
      const sidebarBox = await sidebar.boundingBox();
      if (sidebarBox) {
        // Sidebar should be visible and reasonably sized
        expect(sidebarBox.width).toBeGreaterThan(200);
        expect(sidebarBox.width).toBeLessThan(600);
      }
    }
  });
});
