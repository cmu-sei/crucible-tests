// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { Page } from '@playwright/test';
import { test, expect, Services } from '../../fixtures';

// Abort SignalR negotiation for one hub before the app loads, so its start() fails.
async function blockHubAndOpenCite(page: Page, apiUrl: string) {
  await page.route(`${apiUrl}/hubs/**`, (route) => route.abort('connectionrefused'));
  await page.goto(Services.Cite.UI, { waitUntil: 'domcontentloaded' });
  await page.locator('app-root mat-toolbar').first().waitFor({ state: 'visible', timeout: 30000 });
}

test.describe('Error Handling and Edge Cases', () => {
  test('Gallery hub unreachable shows Gallery Unavailable', async ({ page }) => {
    // 1. Open CITE with the Gallery hub unreachable
    await blockHubAndOpenCite(page, Services.Gallery.API);

    // expect: a message naming Gallery, not the CITE API
    const sheet = page.locator('mat-bottom-sheet-container');
    await expect(sheet).toContainText('Gallery Unavailable', { timeout: 20000 });
    await expect(sheet).toContainText('CITE could not connect to Gallery.');
    await expect(sheet).not.toContainText('Live Updates Unavailable');
  });

  test('CITE hub unreachable shows Live Updates Unavailable', async ({ page }) => {
    // 1. Open CITE with the CITE API hub unreachable
    await blockHubAndOpenCite(page, Services.Cite.API);

    // expect: a message naming the CITE API, not Gallery
    const sheet = page.locator('mat-bottom-sheet-container');
    await expect(sheet).toContainText('Live Updates Unavailable', { timeout: 20000 });
    await expect(sheet).toContainText('CITE could not connect to the CITE API for live updates.');
    await expect(sheet).not.toContainText('Gallery Unavailable');
  });
});
