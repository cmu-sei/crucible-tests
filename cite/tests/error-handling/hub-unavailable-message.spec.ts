// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { Page } from '@playwright/test';
import { test, expect, Services, CITE_THEMES, CiteTheme, citeIsDarkTheme, citeThemeUrl } from '../../fixtures';

// Abort SignalR negotiation for one hub before the app loads, so its start() fails.
//
// The theme goes on the URL rather than through `setCiteTheme`: the hub failure raises a
// bottom sheet as the app loads, and its backdrop covers the top bar's user menu, so the
// switch can't be reached afterward. The param applies the theme from the first paint.
async function blockHubAndOpenCite(page: Page, apiUrl: string, theme: CiteTheme) {
  await page.route(`${apiUrl}/hubs/**`, (route) => route.abort('connectionrefused'));
  await page.goto(citeThemeUrl(Services.Cite.UI, theme), { waitUntil: 'domcontentloaded' });
  await page.locator('app-root mat-toolbar').first().waitFor({ state: 'visible', timeout: 30000 });
  await expect.poll(() => citeIsDarkTheme(page)).toBe(theme === 'dark');
}

for (const theme of CITE_THEMES) {
  test.describe(`${theme} theme › Error Handling and Edge Cases`, () => {
    test('Gallery hub unreachable shows Gallery Unavailable', async ({ page }) => {
      // 1. Open CITE with the Gallery hub unreachable
      await blockHubAndOpenCite(page, Services.Gallery.API, theme);

      // expect: a message naming Gallery, not the CITE API
      const sheet = page.locator('mat-bottom-sheet-container');
      await expect(sheet).toContainText('Gallery Unavailable', { timeout: 20000 });
      await expect(sheet).toContainText('CITE could not connect to Gallery.');
      await expect(sheet).not.toContainText('Live Updates Unavailable');
    });

    test('CITE hub unreachable shows Live Updates Unavailable', async ({ page }) => {
      // 1. Open CITE with the CITE API hub unreachable
      await blockHubAndOpenCite(page, Services.Cite.API, theme);

      // expect: a message naming the CITE API, not Gallery
      const sheet = page.locator('mat-bottom-sheet-container');
      await expect(sheet).toContainText('Live Updates Unavailable', { timeout: 20000 });
      await expect(sheet).toContainText('CITE could not connect to the CITE API for live updates.');
      await expect(sheet).not.toContainText('Gallery Unavailable');
    });
  });
}
