// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: alloy/alloy-test-plan.md
// seed: seed.spec.ts

import { test, expect } from '@playwright/test';
import { authenticateWithKeycloak, Services } from '../../../shared-fixtures';

test.describe('Real-time Updates and SignalR', () => {
  test('SignalR Connection Establishment', async ({ page }) => {
    // Track network requests to verify SignalR connection
    const signalRRequests: string[] = [];
    page.on('request', (request) => {
      const url = request.url();
      if (url.includes('/hubs/engine')) {
        signalRRequests.push(url);
      }
    });

    // 1. Log in and navigate to admin section
    await authenticateWithKeycloak(page, Services.Alloy.UI);
    await page.goto(`${Services.Alloy.UI}/admin`);

    // expect: Admin page loads
    await expect(page.getByRole('heading', { name: 'Administration' })).toBeVisible();

    // 2. Wait briefly for SignalR connection to establish
    // The app connects to SignalR hub when the admin section loads
    await page.waitForTimeout(1000);

    // 3. Verify the admin section is functioning (SignalR connection supports real-time updates)
    await expect(page.getByRole('table')).toBeVisible();

    // expect: SignalR connection was established via WebSocket
    // Check if SignalR negotiation and connection requests were made
    const hasSignalRConnection = signalRRequests.some(
      url => url.includes('/hubs/engine/negotiate') || url.includes('/hubs/engine?')
    );
    expect(hasSignalRConnection).toBeTruthy();
  });
});
