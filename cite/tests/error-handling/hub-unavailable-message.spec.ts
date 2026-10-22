// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { Page } from '@playwright/test';
import { test, expect, Services, CITE_THEMES, CiteTheme, citeIsDarkTheme, setCiteTheme } from '../../fixtures';

// Abort SignalR negotiation for one hub, then reload so the app's start() fails.
//
// The theme is set through the user menu before the hub is blocked: the hub failure
// raises a bottom sheet as the app loads, and its backdrop covers the top bar's user
// menu, so the switch can't be reached afterward. The saved theme survives the
// reload, and so does the OIDC session (sessionStorage), so the reload doesn't go
// back through Keycloak the way a fresh page.goto from the bare `page` does.
async function blockHubAndReloadCite(page: Page, apiUrl: string, theme: CiteTheme) {
  await setCiteTheme(page, theme);
  await page.route(`${apiUrl}/hubs/**`, (route) => route.abort('connectionrefused'));
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.locator('app-root mat-toolbar').first().waitFor({ state: 'visible', timeout: 30000 });
  await expect.poll(() => citeIsDarkTheme(page)).toBe(theme === 'dark');
}

for (const theme of CITE_THEMES) {
  test.describe(`${theme} theme › Error Handling and Edge Cases`, () => {
    test('Gallery hub unreachable shows Gallery Unavailable', async ({ citeAuthenticatedPage: page }) => {
      // 1. Open CITE with the Gallery hub unreachable
      await blockHubAndReloadCite(page, Services.Gallery.API, theme);

      // expect: a message naming Gallery, not the CITE API
      const sheet = page.locator('mat-bottom-sheet-container');
      await expect(sheet).toContainText('Gallery Unavailable', { timeout: 20000 });
      await expect(sheet).toContainText('CITE could not connect to Gallery.');
      await expect(sheet).not.toContainText('Live Updates Unavailable');
    });

    test('CITE hub unreachable shows Live Updates Unavailable', async ({ citeAuthenticatedPage: page }) => {
      // 1. Open CITE with the CITE API hub unreachable
      await blockHubAndReloadCite(page, Services.Cite.API, theme);

      // expect: a message naming the CITE API, not Gallery
      const sheet = page.locator('mat-bottom-sheet-container');
      await expect(sheet).toContainText('Live Updates Unavailable', { timeout: 20000 });
      await expect(sheet).toContainText('CITE could not connect to the CITE API for live updates.');
      await expect(sheet).not.toContainText('Gallery Unavailable');
    });
  });
}
