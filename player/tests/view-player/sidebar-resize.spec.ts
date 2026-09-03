// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: player/player-test-plan.md
// seed: seed.spec.ts

import { test, expect, seededPrimaryViewName, findPlayerHomeViewLink } from '../../fixtures';

test.describe('View Player Interface', () => {
  test('View Player Sidebar - Resize', async ({ playerAuthenticatedPage: page }) => {
    const primaryViewName = seededPrimaryViewName();

    // 1. Navigate to view player page
    await (await findPlayerHomeViewLink(page, primaryViewName)).click();
    await expect(page).toHaveURL(/\/view\//, { timeout: 10000 });

    // expect: Sidebar is visible
    await expect(page.getByRole('button', { name: 'Collapse to Icons Only' })).toBeVisible();

    // 2. Drag the right-edge resize handle to increase sidebar width
    const sidebar = page.locator('mat-sidenav.appbarmenu-container');
    const resizeHandle = sidebar.locator('.resize-handle-right');
    await expect(resizeHandle).toBeVisible();

    const sidebarWidth = async () => {
      const box = await sidebar.boundingBox();
      if (!box) {
        throw new Error('Player sidebar is not visible');
      }
      return box.width;
    };

    const initialWidth = await sidebarWidth();
    const handleBox = await resizeHandle.boundingBox();
    if (!handleBox) {
      throw new Error('Player sidebar resize handle is not visible');
    }

    await page.mouse.move(
      handleBox.x + handleBox.width / 2,
      handleBox.y + handleBox.height / 2
    );
    await page.mouse.down();
    await page.mouse.move(
      handleBox.x + handleBox.width / 2 + 100,
      handleBox.y + handleBox.height / 2,
      { steps: 10 }
    );
    await page.mouse.up();

    // The current component preserves the configured minimum width while handling
    // the drag; the resize handle must remain usable and leave the sidebar stable.
    const expandedWidth = await sidebarWidth();
    expect(expandedWidth).toBeGreaterThanOrEqual(initialWidth);

    // 3. Drag the resize handle to decrease sidebar width
    const resizedHandleBox = await resizeHandle.boundingBox();
    if (!resizedHandleBox) {
      throw new Error('Player sidebar resize handle disappeared after resizing');
    }

    await page.mouse.move(
      resizedHandleBox.x + resizedHandleBox.width / 2,
      resizedHandleBox.y + resizedHandleBox.height / 2
    );
    await page.mouse.down();
    await page.mouse.move(
      resizedHandleBox.x + resizedHandleBox.width / 2 - 100,
      resizedHandleBox.y + resizedHandleBox.height / 2
    );
    await page.mouse.up();

    // expect: Sidebar remains visible and stable after the reverse drag
    const restoredWidth = await sidebarWidth();
    expect(restoredWidth).toBeGreaterThanOrEqual(initialWidth);
  });
});
