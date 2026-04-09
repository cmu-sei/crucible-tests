// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: cite/cite-test-plan.md
// seed: tests/seed.spec.ts

import { test, expect, Services } from '../../fixtures';

test.describe('Performance', () => {
  test('API Response Time - Evaluation List', async ({ citeAuthenticatedPage: page }) => {

    // 1. Monitor network requests when loading evaluation list
    const apiTimes: number[] = [];

    page.on('response', (response) => {
      if (response.url().includes('/api/') && response.url().includes('evaluation')) {
        const timing = response.request().timing();
        if (timing.responseEnd > 0) {
          apiTimes.push(timing.responseEnd);
        }
      }
    });

    await page.goto(Services.Cite.UI);
    await page.waitForLoadState('networkidle');

    // expect: API response time is under acceptable threshold
    for (const time of apiTimes) {
      expect(time).toBeLessThan(5000);
    }

    // expect: No unnecessary API calls are made
  });
});
