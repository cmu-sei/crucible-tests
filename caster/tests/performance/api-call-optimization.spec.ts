// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: caster/caster-test-plan.md
// seed: seed.spec.ts

import { test, expect, Services } from '../../fixtures';

test.describe('Performance and Optimization', () => {
  test('API Call Optimization', async ({ casterAuthenticatedPage: page }) => {

    const apiCalls: string[] = [];
    page.on('request', (request) => {
      if (request.url().includes('/api/')) {
        apiCalls.push(request.url());
      }
    });

    await expect(page.getByText('My Projects')).toBeVisible();

    await page.goto(Services.Caster.UI + '/admin');
    await expect(page.getByRole('heading', { name: 'Administration' })).toBeVisible({ timeout: 10000 });

    expect(apiCalls.length).toBeGreaterThan(0);
    const uniqueCalls = [...new Set(apiCalls)];
    expect(apiCalls.length).toBeLessThan(uniqueCalls.length * 5);
  });
});
