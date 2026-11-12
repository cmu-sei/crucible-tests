// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: topomojo/topomojo-test-plan.md
// seed: tests/seed.spec.ts

import { test, expect } from '../../fixtures';

test.describe('Gamespace Management', () => {
  test('Gamespace Document View', async ({ topomojoAuthenticatedPage: page }) => {

    // 1. Navigate to active gamespace
    const sidebarToggle = page.locator('button[aria-label="Toggle sidebar"], button:has(mat-icon:text("menu"))').first();
    const sidebar = page.locator('mat-sidenav, mat-drawer, [class*="sidebar"]').first();
    const hasSidebarToggle = await sidebarToggle.isVisible({ timeout: 10000 }).catch(() => false);
    if (hasSidebarToggle) {
      await sidebarToggle.click();
      await expect(sidebar).toBeVisible({ timeout: 5000 });
    }

    const gamespaceTab = page.locator('mat-button-toggle:has-text("Gamespace"), button:has-text("Gamespace")').first();
    const activeGamespaces = page.locator('[class*="gamespace-card"], [class*="item-card"], mat-list-item');
    const hasTab = await gamespaceTab.isVisible({ timeout: 5000 }).catch(() => false);
    if (hasTab) {
      await gamespaceTab.click();
      await expect(activeGamespaces.first()).toBeVisible({ timeout: 5000 });
    }

    const activeCount = await activeGamespaces.count();

    if (activeCount > 0) {
      const documentTab = page.locator('mat-tab:has-text("Document"), button:has-text("Document"), a:has-text("Document"), [class*="doc"]').first();
      await activeGamespaces.first().click();
      await expect(documentTab).toBeVisible({ timeout: 10000 });

      // expect: Gamespace page displays
      // 2. Look for document/instructions tab or panel
      const hasDoc = await documentTab.isVisible({ timeout: 5000 }).catch(() => false);

      if (hasDoc) {
        const docContent = page.locator('[class*="document"], [class*="markdown"], [class*="instructions"], [class*="rendered"]').first();
        await documentTab.click();
        await expect(docContent).toBeVisible({ timeout: 5000 });

        // expect: Document section is accessible
        // expect: Workspace instructions/document content is displayed
        const hasContent = await docContent.isVisible({ timeout: 5000 }).catch(() => false);
        if (hasContent) {
          await expect(docContent).toBeVisible();
        }
      }
    }
  });
});
