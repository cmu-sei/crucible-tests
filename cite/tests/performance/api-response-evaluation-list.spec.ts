// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: cite/cite-test-plan.md
// seed: tests/seed.spec.ts

import { test, expect, Services, CITE_THEMES, setCiteTheme } from '../../fixtures';

for (const theme of CITE_THEMES) {
  test.describe(`${theme} theme › Performance`, () => {
    test('API Response Time - Evaluation List', async ({ citeAuthenticatedPage: page }) => {
      await setCiteTheme(page, theme);

      // 1. Monitor network requests when loading evaluation list
      const apiTimes: number[] = [];

      page.on('requestfinished', (req) => {
        if (req.url().includes('/api/') && req.url().includes('evaluation')) {
          apiTimes.push(req.timing().responseEnd);
        }
      });

      // Set up promise to wait for evaluation API response before checking apiTimes
      const evaluationResponsePromise = page.waitForResponse(resp =>
        resp.url().includes('/api/') && resp.url().includes('evaluation')
      );

      await page.goto(Services.Cite.UI);
      await page.waitForLoadState('domcontentloaded');
      // Wait for evaluation list to load
      await expect(page.getByText('My Evaluations')).toBeVisible({ timeout: 10000 });
      // Ensure at least one evaluation API response has been received
      await evaluationResponsePromise;

      // Poll for timing data to be populated (responseEnd is only available when request finishes)
      await expect.poll(() => apiTimes.filter(t => t > 0).length, { timeout: 3000 }).toBeGreaterThan(0);
      // expect: API response time is under acceptable threshold
      const positiveTimes = apiTimes.filter(t => t > 0);
      for (const time of positiveTimes) {
        expect(time).toBeLessThan(5000);
      }

      // expect: No unnecessary API calls are made
    });
  });
}
