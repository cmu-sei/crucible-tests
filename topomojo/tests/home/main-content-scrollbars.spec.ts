// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: topomojo/topomojo-test-plan.md
// seed: tests/seed.spec.ts

import { test, expect } from '../../fixtures';

test.describe('Home Page and Navigation', () => {
  test('Main Content - No Scrollbars Without Overflow', async ({ topomojoAuthenticatedPage: page }) => {

    // 1. Log in and land on home page - handled by fixture
    const main = page.locator('main');
    await expect(main).toBeVisible({ timeout: 10000 });

    // expect: Main content area only scrolls when needed
    await expect(main).toHaveCSS('overflow-x', 'auto');
    await expect(main).toHaveCSS('overflow-y', 'auto');

    // expect: Home page content fits, so no scrollbar gutters are drawn
    const gutters = await main.evaluate((el: HTMLElement) => ({
      vertical: el.offsetWidth - el.clientWidth,
      horizontal: el.offsetHeight - el.clientHeight,
    }));
    expect(gutters).toEqual({ vertical: 0, horizontal: 0 });
  });
});
