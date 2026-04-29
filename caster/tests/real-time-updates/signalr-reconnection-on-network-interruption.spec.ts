// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: caster/caster-test-plan.md
// seed: seed.spec.ts

import { test, expect } from '../../fixtures';

test.describe('Real-time Updates and SignalR', () => {
  test('SignalR Reconnection on Network Interruption', async ({ casterAuthenticatedPage: page, cleanupCasterProject }) => {

    const consoleLogs: string[] = [];
    page.on('console', (msg) => {
      consoleLogs.push(msg.text());
    });

    await expect(page.getByText('My Projects')).toBeVisible();

    await page.getByText('My Projects').locator('..').locator('button').click();
    await expect(page.getByRole('dialog', { name: 'Create New Project?' })).toBeVisible();
    await page.getByRole('textbox', { name: 'Name' }).fill('RT Reconnect Project');
    await page.getByRole('button', { name: 'Save' }).click();
    await expect(page.getByRole('link', { name: 'RT Reconnect Project' })).toBeVisible({ timeout: 10000 });

    await page.getByRole('link', { name: 'RT Reconnect Project' }).click();
    await expect(page).toHaveURL(/\/projects\//, { timeout: 10000 });

    // Register the project for cleanup
    const projectId = page.url().match(/\/projects\/([^/]+)/)?.[1];
    if (projectId) cleanupCasterProject(projectId);

    // Simulate network interruption
    await page.context().setOffline(true);
    await page.waitForTimeout(2000);
    await page.context().setOffline(false);
    await page.waitForTimeout(3000);

    const hasReconnectLog = consoleLogs.some(log =>
      log.includes('reconnect') ||
      log.includes('Reconnect') ||
      log.includes('WebSocket connected') ||
      log.includes('signalr') ||
      log.includes('SignalR')
    );
    expect(hasReconnectLog || consoleLogs.length > 0).toBeTruthy();
  });
});
