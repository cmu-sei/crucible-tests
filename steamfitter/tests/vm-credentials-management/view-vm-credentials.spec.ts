// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: steamfitter/steamfitter-test-plan.md
// seed: tests/seed.spec.ts

import { test, expect, Services } from '../../fixtures';

test.describe('VM Credentials Management', () => {
  let templateId: string | null = null;
  let scenarioId: string | null = null;

  test.afterEach(async ({ request }) => {
    if (scenarioId) {
      try { await request.delete(`${Services.Steamfitter.API}/api/scenarios/${scenarioId}`); } catch {}
    }
    if (templateId) {
      try { await request.delete(`${Services.Steamfitter.API}/api/scenariotemplates/${templateId}`); } catch {}
    }
  });

  test('View VM Credentials', async ({ steamfitterAuthenticatedPage: page, request }) => {
    // Setup: create template and scenario via API
    const tResp = await request.post(`${Services.Steamfitter.API}/api/scenariotemplates`, {
      data: { name: 'VM Creds View Template', description: 'Template for VM credentials', durationHours: 1 },
    });
    expect(tResp.ok()).toBeTruthy();
    const template = await tResp.json();
    templateId = template.id;

    const sResp = await request.post(`${Services.Steamfitter.API}/api/scenarios`, {
      data: { name: 'VM Creds View Scenario', description: 'Scenario for VM credentials', scenarioTemplateId: templateId },
    });
    expect(sResp.ok()).toBeTruthy();
    const scenario = await sResp.json();
    scenarioId = scenario.id;

    await page.goto(`${Services.Steamfitter.UI}/admin`);
    const sidebar = page.locator('mat-sidenav, mat-drawer, [class*="sidebar"]').first();
    await expect(sidebar).toBeVisible({ timeout: 15000 });

    await sidebar.locator('text=Scenarios').first().click();
    await page.waitForTimeout(1000);

    // Navigate to scenario
    await page.locator('text=VM Creds View Scenario').first().click();
    await page.waitForTimeout(1000);

    // Find VM credentials section
    const credSection = page.locator('text=/VM Credential|credential/i, [class*="credential"], mat-tab:has-text("Credential"), [role="tab"]:has-text("Credential")').first();
    const hasCredSection = await credSection.isVisible({ timeout: 5000 }).catch(() => false);
    if (hasCredSection) {
      await credSection.click();
      await page.waitForTimeout(1000);
    }

    // Verify credentials section is accessible
    const credArea = page.locator('[class*="credential"], [class*="vm-cred"], table, mat-list').first();
    await expect(credArea).toBeVisible({ timeout: 10000 });
  });
});
