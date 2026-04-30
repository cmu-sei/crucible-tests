// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: steamfitter/steamfitter-test-plan.md
// seed: tests/seed.spec.ts

import { test, expect, Services } from '../../fixtures';

test.describe('URL and Navigation Enhancements', () => {
  let templateId: string | null = null;

  test.afterEach(async ({ request }) => {
    if (templateId) {
      try {
        await request.delete(`${Services.Steamfitter.API}/api/scenariotemplates/${templateId}`);
      } catch { /* ignore cleanup errors */ }
      templateId = null;
    }
  });

  test('Deep Link to Scenario Template Query Param', async ({ steamfitterAuthenticatedPage: page, request }) => {
    // Setup: create template via API
    const createTemplateResp = await request.post(`${Services.Steamfitter.API}/api/scenariotemplates`, {
      data: { name: 'Deep Link Template Test', description: 'Test deep link to template', durationHours: 1 },
    });
    expect(createTemplateResp.ok()).toBeTruthy();
    const template = await createTemplateResp.json();
    templateId = template.id;

    // Navigate to admin with template query parameter
    await page.goto(`${Services.Steamfitter.UI}/admin?template=${templateId}`);
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(2000);

    // Verify the template is selected/highlighted
    const templateElement = page.locator(`text=Deep Link Template Test`).first();
    const isVisible = await templateElement.isVisible({ timeout: 10000 }).catch(() => false);
    expect(isVisible).toBe(true);

    // Switch sections (e.g., to Scenarios)
    const sidebar = page.locator('mat-sidenav, mat-drawer, [class*="sidebar"]').first();
    await expect(sidebar).toBeVisible({ timeout: 10000 });
    await sidebar.locator('text=Scenarios').first().click();
    await page.waitForTimeout(1000);

    // Verify query param is cleaned from URL
    const currentUrl = page.url();
    expect(currentUrl).not.toContain('template=');
  });
});
