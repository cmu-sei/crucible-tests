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

  test('Edit VM Credentials', async ({ steamfitterAuthenticatedPage: page, request }) => {
    // Setup: create template and scenario via API
    const tResp = await request.post(`${Services.Steamfitter.API}/api/scenariotemplates`, {
      data: { name: 'VM Creds Edit Template', description: 'Template for editing VM credentials', durationHours: 1 },
    });
    expect(tResp.ok()).toBeTruthy();
    const template = await tResp.json();
    templateId = template.id;

    const sResp = await request.post(`${Services.Steamfitter.API}/api/scenarios`, {
      data: { name: 'VM Creds Edit Scenario', description: 'Scenario for editing VM credentials', scenarioTemplateId: templateId },
    });
    expect(sResp.ok()).toBeTruthy();
    const scenario = await sResp.json();
    scenarioId = scenario.id;

    // Add VM credentials via API
    await request.post(`${Services.Steamfitter.API}/api/scenarios/${scenarioId}/vmcredentials`, {
      data: { username: 'olduser', password: 'oldpass', description: 'Original credential' },
    });

    await page.goto(`${Services.Steamfitter.UI}/admin`);
    const sidebar = page.locator('mat-sidenav, mat-drawer, [class*="sidebar"]').first();
    await expect(sidebar).toBeVisible({ timeout: 15000 });

    await sidebar.locator('text=Scenarios').first().click();
    await page.waitForTimeout(1000);

    // Navigate to scenario
    await page.locator('text=VM Creds Edit Scenario').first().click();
    await page.waitForTimeout(1000);

    // Navigate to credentials section
    const credTab = page.locator('text=/VM Credential|credential/i, mat-tab:has-text("Credential"), [role="tab"]:has-text("Credential")').first();
    const hasCredTab = await credTab.isVisible({ timeout: 5000 }).catch(() => false);
    if (hasCredTab) {
      await credTab.click();
      await page.waitForTimeout(1000);
    }

    // Click edit on existing credential
    const editButton = page.locator('button:has(mat-icon:text("edit")), button:has-text("Edit")').first();
    await expect(editButton).toBeVisible({ timeout: 10000 });
    await editButton.click();
    await page.waitForTimeout(500);

    // Update username
    const usernameInput = page.locator('input[placeholder*="sername"], input[formcontrolname*="username"], input[name*="username"]').first();
    await expect(usernameInput).toBeVisible({ timeout: 10000 });
    await usernameInput.clear();
    await usernameInput.fill('updateduser');

    // Save
    const saveButton = page.locator('button:has-text("Save"), button:has-text("Update"), button[type="submit"]').first();
    await saveButton.click();
    await page.waitForTimeout(1000);

    // Verify updated credentials
    await expect(page.locator('text=updateduser').first()).toBeVisible({ timeout: 10000 });
  });
});
