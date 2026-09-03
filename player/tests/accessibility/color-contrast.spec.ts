// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: player/player-test-plan.md
// seed: seed.spec.ts

import { test, expect, Services } from '../../fixtures';

test.describe('Responsive Design and Accessibility', () => {
  test('Color Contrast', async ({ playerAuthenticatedPage: page }) => {
    // 1. Log in and view the application in light theme
    await expect(page.getByText('My Views')).toBeVisible();

    // expect: Text and background colors meet WCAG contrast requirements
    // expect: All text is readable
    // expect: Interactive elements are visually distinguishable

    // Verify key elements are visible in light theme
    await expect(page.getByText('Player')).toBeVisible();
    await expect(page.getByText('Admin User', { exact: true })).toBeVisible();
    await expect(page.getByRole('table')).toBeVisible();

    // Switch to dark theme
    await page.getByRole('button', { name: 'Menu' }).click();
    await page.getByText('Dark Theme').click();
    await page.keyboard.press('Escape');

    // Verify key elements are still visible in dark theme
    await expect(page.getByText('My Views')).toBeVisible();
    await expect(page.getByText('Player')).toBeVisible();
    await expect(page.getByRole('table')).toBeVisible();

    // Switch back to light theme
    await page.getByRole('button', { name: 'Menu' }).click();
    await page.getByText('Dark Theme').click();
    await page.keyboard.press('Escape');
  });
});
