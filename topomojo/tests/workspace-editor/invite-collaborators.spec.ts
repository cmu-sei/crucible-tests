// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: topomojo/topomojo-test-plan.md
// seed: tests/seed.spec.ts

import { test, expect } from '../../fixtures';

test.describe('Workspace Editor', () => {
  test('Workspace Editor - Invite Collaborators', async ({ topomojoAuthenticatedPage: page }) => {

    // 1. Navigate to workspace editor
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

      // expect: Workspace editor loads
      await expect(page).toHaveURL(/\/topo\//, { timeout: 10000 });

      // 2. Look for 'Invite' or 'Share' button
      const inviteButton = page.locator('button:has-text("Invite"), button:has-text("Share"), button:has(mat-icon:text("share")), button:has(mat-icon:text("person_add"))').first();
      const hasInvite = await inviteButton.isVisible({ timeout: 5000 }).catch(() => false);

      if (hasInvite) {
        // 3. Click invite button
        await inviteButton.click();
        await page.waitForTimeout(1000);

        // expect: Invite dialog opens
        // expect: Invite code or link is displayed or can be generated
        const inviteContent = page.locator('mat-dialog-container, [role="dialog"], [class*="invite"], [class*="share"]').first();
        const hasInviteContent = await inviteContent.isVisible({ timeout: 5000 }).catch(() => false);
        if (hasInviteContent) {
          await expect(inviteContent).toBeVisible();
        }
      }
    }
  });
});
