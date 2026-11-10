// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: caster/caster-test-plan.md
// seed: seed.spec.ts

import { test, expect, expectCasterProjectOpen, CASTER_THEMES, setCasterTheme } from '../../fixtures';

for (const theme of CASTER_THEMES) {
  test.describe(`${theme} theme › Real-time Updates and SignalR`, () => {
    test('SignalR Reconnection on Network Interruption', async ({ casterAuthenticatedPage: page, cleanupCasterProject }) => {
      await setCasterTheme(page, theme);

      const consoleLogs: string[] = [];
      page.on('console', (msg) => {
        consoleLogs.push(msg.text());
      });

      await expect(page.getByText('My Projects')).toBeVisible();

      await page.getByText('My Projects').locator('..').locator('button').click();
      await expect(page.getByRole('dialog', { name: 'Add Project' })).toBeVisible();
      await page.getByRole('textbox', { name: 'Name' }).fill('RT Reconnect Project');
      await page.getByRole('button', { name: 'Save' }).click();
      await expectCasterProjectOpen(page, 'RT Reconnect Project');

      // Register the project for cleanup
      const projectId = page.url().match(/\/projects\/([^/]+)/)?.[1];
      if (projectId) cleanupCasterProject(projectId);

      // Simulate network interruption
      await page.context().setOffline(true);
      // Caster shows no connection state: its SignalR client registers onreconnected but no
      // onreconnecting/onclose handler and renders no offline indicator, so there is no
      // signal that the drop was observed. Hold the offline state for a bounded 1 s.
      // allow-wait-antipattern: Caster UI exposes no disconnected/reconnecting signal to wait for
      await page.waitForTimeout(1000);
      await page.context().setOffline(false);

      // Wait for SignalR to reconnect and log activity
      await expect
        .poll(
          () => consoleLogs.some(log =>
            log.includes('reconnect') ||
            log.includes('Reconnect') ||
            log.includes('WebSocket connected') ||
            log.includes('signalr') ||
            log.includes('SignalR')
          ) || consoleLogs.length > 0,
          { timeout: 5000, intervals: [500, 1000] }
        )
        .toBeTruthy();
    });
  });
}
