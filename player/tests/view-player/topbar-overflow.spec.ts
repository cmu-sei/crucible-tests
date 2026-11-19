// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: player/player-test-plan.md
// seed: seed.spec.ts

import { Page } from '@playwright/test';
import { test, expect, Services, PLAYER_THEMES, setPlayerTheme } from '../../fixtures';
import { createView, deleteView, getPlayerToken } from '../../../player-helpers';
import { seededName } from '../../../theme-helpers';

// The top bar never wraps, so a view title that does not fit used to push the
// user menu past the right edge, where `body { overflow: hidden }` made it (and
// Administration, Logout, Dark Theme behind it) unreachable. The title now gives
// up room with an ellipsis, and on narrow screens the name drops to its tooltip.

const LONG_NAME_BASE =
  'Regional Critical Infrastructure Cyber Defense Tabletop Exercise With A View Name Far Too Long For The Top Bar';

async function expectMenuInsideViewport(page: Page) {
  const menu = page.getByRole('button', { name: 'Menu', exact: true });
  await expect(menu).toBeVisible();
  const box = await menu.boundingBox();
  expect(box, 'Menu button has a box').not.toBeNull();
  expect(box!.x + box!.width).toBeLessThanOrEqual(page.viewportSize()!.width);
}

for (const theme of PLAYER_THEMES) {
  test.describe(`${theme} theme › View Player Interface`, () => {
    let token: string;
    let viewId: string | undefined;

    test.afterEach(async () => {
      if (viewId) {
        await deleteView(token, viewId);
        viewId = undefined;
      }
    });

    test('Top Bar Keeps the User Menu On Screen', async ({ playerAuthenticatedPage: page }) => {
      token = await getPlayerToken();
      const viewName = seededName(LONG_NAME_BASE, test.info());
      viewId = (await createView(token, viewName)).id;
      await setPlayerTheme(page, theme);
      await page.setViewportSize({ width: 1280, height: 800 });

      // 1. Open a view whose name is longer than the top bar
      await page.goto(`${Services.Player.UI}/view/${viewId}`);
      const toolbar = page.locator('mat-toolbar');
      const title = toolbar.locator('.view-text');
      await expect(title).toHaveText(viewName);

      // expect: The view title is cut short instead of pushing the menu away
      expect(await title.evaluate((el) => el.scrollWidth > el.clientWidth)).toBe(true);

      // expect: The user's name is shown on the Menu button, which is fully on screen
      const userName = toolbar.locator('.user-name');
      await expect(userName).toBeVisible();
      const name = (await userName.innerText()).trim();
      expect(name.length).toBeGreaterThan(0);
      await expectMenuInsideViewport(page);

      // 2. Hover the view title
      await title.hover();

      // expect: A tooltip shows the full view name
      await expect(page.locator('mat-tooltip-component')).toHaveText(viewName);

      // 3. Hover the Menu button
      await page.getByRole('button', { name: 'Menu', exact: true }).hover();

      // expect: A tooltip shows the user's name
      await expect(page.locator('mat-tooltip-component')).toHaveText(name);

      // 4. Open the Menu
      await page.getByRole('button', { name: 'Menu', exact: true }).click();

      // expect: The menu opens and Logout is reachable
      await expect(page.getByRole('menuitem', { name: 'Logout' })).toBeVisible();
      await page.keyboard.press('Escape');

      // 5. Return home and narrow the window to phone width
      await page.goto(Services.Player.UI);
      await page.setViewportSize({ width: 480, height: 800 });

      // expect: The name is dropped, leaving the Menu button's chevron fully on screen
      await expect(userName).toBeHidden();
      await expectMenuInsideViewport(page);

      // 6. Hover the Menu button
      await page.getByRole('button', { name: 'Menu', exact: true }).hover();

      // expect: A tooltip still shows the user's name
      await expect(page.locator('mat-tooltip-component')).toHaveText(name);
    });
  });
}
