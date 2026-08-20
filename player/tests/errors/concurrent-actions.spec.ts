// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: player/player-test-plan.md
// seed: seed.spec.ts

import fs from 'fs';
import { authSessionStatePath, authStatePath } from '../../../auth-paths';
import { test, expect, Services, serviceUrlPattern, waitForFirstVisible } from '../../fixtures';

test.describe('Error Handling and Edge Cases', () => {
  test('Concurrent User Actions - Race Conditions', async ({ playerAuthenticatedPage: page, browser }) => {
    // 1. Open two browser instances with same user logged in
    // First instance is already authenticated via fixture
    await expect(page.getByText('My Views')).toBeVisible();

    const statePath = authStatePath('player');
    const sessionStatePath = authSessionStatePath('player');
    const sessionState: Array<[string, string]> = fs.existsSync(sessionStatePath)
      ? JSON.parse(fs.readFileSync(sessionStatePath, 'utf8'))
      : [];
    const context2 = await browser.newContext({
      ignoreHTTPSErrors: true,
      storageState: fs.existsSync(statePath) ? statePath : undefined,
    });

    try {
      const page2 = await context2.newPage();
      if (sessionState.length > 0) {
        await page2.addInitScript((entries: Array<[string, string]>) => {
          for (const [key, value] of entries) {
            sessionStorage.setItem(key, value);
          }
        }, sessionState);
      }

      await page2.goto(Services.Player.UI, { waitUntil: 'domcontentloaded' });

      const secondSession = await waitForFirstVisible(
        page2,
        [
          { key: 'shell', locator: page2.getByRole('button', { name: 'Menu' }) },
          { key: 'keycloak', locator: page2.locator('input[name="username"]') },
        ],
        { timeout: 20000 }
      );

      if (secondSession !== 'shell') {
        await page2.getByRole('textbox', { name: 'Username or email' }).fill('admin');
        await page2.getByRole('textbox', { name: 'Password' }).fill('admin');
        await page2.getByRole('button', { name: 'Sign In' }).click();
        await page2.waitForURL(serviceUrlPattern(Services.Player.UI), { timeout: 30000 });
      }

      // expect: Both instances are authenticated
      await expect(page.getByText('My Views')).toBeVisible();
      await expect(page2.getByText('My Views')).toBeVisible();

      // 2. Perform actions in both instances
      // Both pages navigate to admin at the same time
      await Promise.all([
        page.getByRole('button', { name: 'Menu' }).click(),
        page2.getByRole('button', { name: 'Menu' }).click(),
      ]);

      // expect: Application handles concurrent access
      // expect: No data corruption occurs
      await expect(page.getByRole('menuitem', { name: 'Administration' })).toBeVisible();
      await expect(page2.getByRole('menuitem', { name: 'Administration' })).toBeVisible();
    } finally {
      await context2.close();
    }
  });
});
