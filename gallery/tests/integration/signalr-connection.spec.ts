// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: gallery/gallery-test-plan.md
// seed: seed.spec.ts

import { test, expect } from '@playwright/test';
import { authenticateGalleryWithKeycloak } from '../../fixtures';

test.describe('Integration and API', () => {
  test('SignalR Real-Time Connection', async ({ page }) => {
    // Set up console log listener before navigating
    const consoleMessages: string[] = [];
    page.on('console', (msg) => {
      consoleMessages.push(msg.text());
    });

    // 1. Log in and navigate to an exhibit Wall or Archive view
    await authenticateGalleryWithKeycloak(page);
    await expect(page.getByRole('table')).toBeVisible();

    // Navigate to an exhibit
    const exhibitLink = page.getByRole('cell').getByRole('link').first();
    await exhibitLink.click();
    await expect(page).toHaveURL(/\?exhibit=/);

    // Wait for SignalR messages to appear in console
    // expect: Console logs show SignalR WebSocket transport connected successfully
    // Give it some time for SignalR to establish
    await page.waitForFunction(() => true, null, { timeout: 5000 }).catch(() => {});

    const hasSignalRMessage = consoleMessages.some(
      (msg) => msg.includes('WebSocket') || msg.includes('SignalR') || msg.includes('signalr')
    );
    expect(hasSignalRMessage).toBeTruthy();
  });
});
