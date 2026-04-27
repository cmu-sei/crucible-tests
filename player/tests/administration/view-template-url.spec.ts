// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: player/player-test-plan.md
// seed: seed.spec.ts

import { test, expect, Services } from '../../fixtures';

test.describe('Administration - Application Templates', () => {
  test('View Template URL', async ({ playerAuthenticatedPage: page }) => {
    // 1. Log in as admin and navigate to Administration > Application Templates
    await page.getByRole('button', { name: 'Menu' }).click();
    await page.getByRole('menuitem', { name: 'Administration' }).click();
    await page.getByRole('button', { name: 'Application Templates' }).click();

    // expect: The Application Templates section is displayed
    await expect(page.getByRole('columnheader', { name: 'Url' })).toBeVisible();

    // 2. Observe the template URLs
    // expect: URLs contain placeholders like {viewId} and {theme}
    await expect(page.getByText('{viewId}').first()).toBeVisible();

    // expect: URLs point to different Crucible services (Alloy, VM API)
    await expect(page.getByRole('button', { name: /localhost:4403/ })).toBeVisible();
    await expect(page.getByRole('button', { name: /localhost:4303/ }).first()).toBeVisible();
  });
});
