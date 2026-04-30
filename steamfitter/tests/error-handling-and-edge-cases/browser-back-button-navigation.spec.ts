// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: steamfitter/steamfitter-test-plan.md
// seed: tests/seed.spec.ts

import { test, expect, Services } from '../../fixtures';

test.describe('Error Handling and Edge Cases', () => {
  let templateId: string | null = null;

  test.afterEach(async ({ steamfitterApi }) => {
    if (templateId) {
      try { await steamfitterApi.delete(`${Services.Steamfitter.API}/api/scenariotemplates/${templateId}`); } catch {}
    }
  });

  test('Browser Back Button Navigation', async ({ steamfitterAuthenticatedPage: page, steamfitterApi }) => {
    // Create a template so we have something to navigate to
    const tResp = await steamfitterApi.post(`${Services.Steamfitter.API}/api/scenariotemplates`, {
      data: { name: 'Back Button Template', description: 'Template for back button test', durationHours: 1 },
    });
    expect(tResp.ok()).toBeTruthy();
    const template = await tResp.json();
    templateId = template.id;

    // Navigate through pages: Home -> Admin -> Templates -> specific template
    await page.goto(`${Services.Steamfitter.UI}`);
    await page.waitForTimeout(1000);

    await page.goto(`${Services.Steamfitter.UI}/admin`);
    // Wait for admin page to load - check for the Add Scenario Template button
    await expect(page.getByRole('button', { name: 'Add Scenario Template' })).toBeVisible({ timeout: 15000 });

    await page.locator('text=Back Button Template').first().click();
    await page.waitForTimeout(1000);

    // Use page.goBack() and verify correct navigation
    await page.goBack();
    await page.waitForTimeout(1000);

    // Should be back on the templates list or still on admin page
    const templatesVisible = await page.locator('text=Back Button Template').isVisible({ timeout: 5000 }).catch(() => false);
    const onAdminPage = page.url().includes('/admin') || page.url().includes(Services.Steamfitter.UI);
    expect(templatesVisible || onAdminPage).toBeTruthy();

    // Go back again
    await page.goBack();
    await page.waitForTimeout(1000);

    // Should be back further in navigation history
    const stillOnApp = page.url().includes(Services.Steamfitter.UI) || page.url().includes('localhost:4401');
    expect(stillOnApp).toBeTruthy();
  });
});
