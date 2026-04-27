// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: player/player-test-plan.md
// seed: seed.spec.ts

import { test, expect, Services } from '../../fixtures';

test.describe('View Player Interface', () => {
  test('View Player Sidebar - Resize', async ({ playerAuthenticatedPage: page }) => {
    // 1. Navigate to view player page
    await page.getByRole('link', { name: 'Project Lagoon TTX - Admin' }).click();
    await expect(page).toHaveURL(/\/view\//, { timeout: 10000 });

    // expect: Sidebar is visible
    await expect(page.getByRole('button', { name: 'Collapse to Icons Only' })).toBeVisible();

    // 2. Hover over the right edge of the sidebar (resize handle)
    // The sidebar separator/resize handle
    const separator = page.getByRole('separator');
    await expect(separator).toBeVisible();

    // expect: Cursor changes to indicate resize capability
    // 3. Drag the resize handle to increase sidebar width
    // Get the bounding box of the separator
    const box = await separator.boundingBox();
    if (box) {
      // Drag right to increase sidebar width
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
      await page.mouse.down();
      await page.mouse.move(box.x + box.width / 2 + 100, box.y + box.height / 2);
      await page.mouse.up();
    }

    // expect: Sidebar width increases
    // expect: Main content area adjusts accordingly
    await expect(page.getByRole('button', { name: 'Collapse to Icons Only' })).toBeVisible();

    // 4. Drag the resize handle to decrease sidebar width
    const box2 = await separator.boundingBox();
    if (box2) {
      await page.mouse.move(box2.x + box2.width / 2, box2.y + box2.height / 2);
      await page.mouse.down();
      await page.mouse.move(box2.x + box2.width / 2 - 100, box2.y + box2.height / 2);
      await page.mouse.up();
    }

    // expect: Sidebar width decreases
    // expect: Main content area expands
    await expect(page.getByRole('button', { name: 'Collapse to Icons Only' })).toBeVisible();
  });
});
