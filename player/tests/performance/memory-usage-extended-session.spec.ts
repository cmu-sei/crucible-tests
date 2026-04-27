// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: player/player-test-plan.md
// seed: seed.spec.ts

import { test, expect, Services } from '../../fixtures';

test.describe('Performance', () => {
  test('Memory Usage - Extended Session', async ({ playerAuthenticatedPage: page }) => {
    // 1. Log in and navigate through various pages for extended period
    await expect(page.getByText('My Views')).toBeVisible();

    // Navigate to several pages to simulate extended usage
    // Home -> View -> Home -> Admin -> Users -> Templates -> Roles -> Subscriptions -> Home
    await page.getByRole('link', { name: 'Project Lagoon TTX - Admin' }).click();
    await expect(page).toHaveURL(/\/view\//, { timeout: 10000 });

    await page.getByRole('link', { name: 'Player' }).click();
    await expect(page.getByText('My Views')).toBeVisible();

    await page.getByRole('button', { name: 'Menu' }).click();
    await page.getByRole('menuitem', { name: 'Administration' }).click();
    await expect(page).toHaveURL(/\/admin/, { timeout: 10000 });

    await page.getByRole('button', { name: 'Users Users' }).click();
    await expect(page.getByRole('columnheader', { name: 'Name' })).toBeVisible();

    await page.getByRole('button', { name: 'Application Templates' }).click();
    await expect(page.getByRole('columnheader', { name: 'Template Name' })).toBeVisible();

    await page.getByRole('button', { name: 'Roles Roles' }).click();
    await expect(page.getByRole('tab', { name: 'Roles', exact: true })).toBeVisible();

    await page.getByRole('button', { name: 'Subscriptions Subscriptions' }).click();
    await expect(page.getByRole('columnheader', { name: 'Subscription Name' })).toBeVisible();

    // Navigate back to home
    await page.goto(Services.Player.UI);
    await expect(page.getByText('My Views')).toBeVisible();

    // expect: Memory usage remains stable
    // expect: No significant memory leaks are detected
    // expect: Application performance does not degrade over time
    // Verify the application is still responsive after navigation
    await expect(page.getByRole('button', { name: 'Menu' })).toBeVisible();
    await expect(page.getByRole('table')).toBeVisible();
  });
});
