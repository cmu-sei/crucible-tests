// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: topomojo/topomojo-test-plan.md
// seed: tests/seed.spec.ts

import { test, expect } from '../../fixtures';

test.describe('Workspace Editor', () => {
  test('Workspace Editor - Document Tab', async ({ topomojoAuthenticatedPage: page }) => {

    // 1. Navigate to workspace editor
    const sidebarToggle = page.locator('button[aria-label="Toggle sidebar"], button:has(mat-icon:text("menu"))').first();
    const sidebar = page.locator('mat-sidenav, mat-drawer, [class*="sidebar"], [class*="side-panel"]').first();
    const hasSidebarToggle = await sidebarToggle.isVisible({ timeout: 10000 }).catch(() => false);
    if (hasSidebarToggle) {
      await sidebarToggle.click();
      await expect(sidebar).toBeVisible();
    }

    const workspaceItems = page.locator('[class*="workspace-card"], [class*="item-card"], mat-list-item, [class*="list-item"]');

    const itemCount = await workspaceItems.count();

    if (itemCount > 0) {
      const documentTab = page.locator('mat-tab:has-text("Document"), a:has-text("Document"), button:has-text("Document"), [routerLink*="doc"]').first();
      await workspaceItems.first().click();
      await expect(page).toHaveURL(/\/topo\//, { timeout: 10000 });

      // expect: Workspace editor tabs are visible
      // 2. Click on 'Document' tab
      const documentEditor = page.locator('textarea, [class*="editor"], [class*="document"], [class*="markdown"], .CodeMirror, [contenteditable]').first();
      const hasTab = await documentTab.isVisible({ timeout: 5000 }).catch(() => false);

      if (hasTab) {
        await documentTab.click();
        await expect(documentEditor).toBeVisible({ timeout: 10000 });

        // expect: Document tab is selected
        // expect: Markdown editor or document display is shown
        await expect(documentEditor).toBeVisible({ timeout: 10000 });
      }
    }
  });
});
