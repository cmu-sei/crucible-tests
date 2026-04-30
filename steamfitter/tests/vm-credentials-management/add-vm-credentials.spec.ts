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

  test('Add VM Credentials', async ({ steamfitterAuthenticatedPage: page, request }) => {
    // Setup: create template and scenario via API
    const tResp = await request.post(`${Services.Steamfitter.API}/api/scenariotemplates`, {
      data: { name: 'VM Creds Add Template', description: 'Template for adding VM credentials', durationHours: 1 },
    });
    expect(tResp.ok()).toBeTruthy();
    const template = await tResp.json();
    templateId = template.id;

    const sResp = await request.post(`${Services.Steamfitter.API}/api/scenarios`, {
      data: { name: 'VM Creds Add Scenario', description: 'Scenario for adding VM credentials', scenarioTemplateId: templateId },
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
    await page.locator('text=VM Creds Add Scenario').first().click();
    await page.waitForTimeout(1000);

    // Navigate to credentials section
    const credTab = page.locator('text=/VM Credential|credential/i, mat-tab:has-text("Credential"), [role="tab"]:has-text("Credential")').first();
    const hasCredTab = await credTab.isVisible({ timeout: 5000 }).catch(() => false);
    if (hasCredTab) {
      await credTab.click();
      await page.waitForTimeout(1000);
    }

    // Add credentials
    const addButton = page.locator('button:has-text("Add"), button:has(mat-icon:text("add"))').first();
    await expect(addButton).toBeVisible({ timeout: 10000 });
    await addButton.click();
    await page.waitForTimeout(500);

    // Fill in username
    const usernameInput = page.locator('input[placeholder*="sername"], input[formcontrolname*="username"], input[name*="username"]').first();
    await expect(usernameInput).toBeVisible({ timeout: 10000 });
    await usernameInput.fill('testuser');

    // Fill in password
    const passwordInput = page.locator('input[placeholder*="assword"], input[formcontrolname*="password"], input[name*="password"], input[type="password"]').first();
    await expect(passwordInput).toBeVisible({ timeout: 10000 });
    await passwordInput.fill('testpass');

    // Save
    const saveButton = page.locator('button:has-text("Save"), button:has-text("Add"), button[type="submit"]').first();
    await saveButton.click();
    await page.waitForTimeout(1000);

    // Verify credentials appear
    await expect(page.locator('text=testuser').first()).toBeVisible({ timeout: 10000 });
  });
});
