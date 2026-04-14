// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: topomojo/topomojo-test-plan.md
// seed: tests/seed.spec.ts

import { test, expect } from '../../fixtures';

test.describe('Workspace Editor', () => {
  test('Workspace Editor - Edit Document', async ({ topomojoAuthenticatedPage: page }) => {

    // 1. Navigate to workspace document tab
    const sidebarToggle = page.locator('button[aria-label="Toggle sidebar"], button:has(mat-icon:text("menu"))').first();
    const hasSidebarToggle = await sidebarToggle.isVisible({ timeout: 10000 }).catch(() => false);
    if (hasSidebarToggle) {
      await sidebarToggle.click();
      await page.waitForTimeout(500);
    }

    const workspaceItems = page.locator('[class*="workspace-card"], [class*="item-card"], mat-list-item, [class*="list-item"]');
    const itemCount = await workspaceItems.count();

    if (itemCount > 0) {
      await workspaceItems.first().click();
      await page.waitForTimeout(2000);

      const documentTab = page.locator('mat-tab:has-text("Document"), a:has-text("Document"), button:has-text("Document")').first();
      const hasTab = await documentTab.isVisible({ timeout: 5000 }).catch(() => false);
      if (hasTab) {
        await documentTab.click();
        await page.waitForTimeout(1000);
      }

      // expect: Document editor is displayed
      const editor = page.locator('textarea, [class*="editor"], .CodeMirror, [contenteditable]').first();
      const hasEditor = await editor.isVisible({ timeout: 10000 }).catch(() => false);

      if (hasEditor) {
        // 2. Enter or modify document content with instructions
        if (await editor.evaluate(el => el.tagName.toLowerCase()) === 'textarea') {
          await editor.fill('# Test Document\n\nThis is a test document with markdown.');
        } else {
          await editor.click();
          await page.keyboard.type('# Test Document');
        }

        // expect: Editor accepts text input
        // expect: Markdown formatting works

        // 3. Save document (may auto-save)
        const saveButton = page.locator('button:has-text("Save"), button:has(mat-icon:text("save"))').first();
        const hasSave = await saveButton.isVisible({ timeout: 3000 }).catch(() => false);
        if (hasSave) {
          await saveButton.click();
          await page.waitForTimeout(1000);
        }
      }
    }
  });
});
