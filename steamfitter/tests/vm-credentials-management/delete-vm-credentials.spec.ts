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

  test('Delete VM Credentials', async ({ steamfitterAuthenticatedPage: page, request }) => {
    // Setup: create template and scenario via API
    const tResp = await request.post(`${Services.Steamfitter.API}/api/scenariotemplates`, {
      data: { name: 'VM Creds Delete Template', description: 'Template for deleting VM credentials', durationHours: 1 },
    });
    expect(tResp.ok()).toBeTruthy();
    const template = await tResp.json();
    templateId = template.id;

    const sResp = await request.post(`${Services.Steamfitter.API}/api/scenarios`, {
      data: { name: 'VM Creds Delete Scenario', description: 'Scenario for deleting VM credentials', scenarioTemplateId: templateId },
    });
    expect(sResp.ok()).toBeTruthy();
    const scenario = await sResp.json();
    scenarioId = scenario.id;

    // Add VM credentials via API
    await request.post(`${Services.Steamfitter.API}/api/scenarios/${scenarioId}/vmcredentials`, {
      data: { username: 'deleteuser', password: 'deletepass', description: 'Credential to delete' },
    });

    await page.goto(`${Services.Steamfitter.UI}/admin`);
    const sidebar = page.locator('mat-sidenav, mat-drawer, [class*="sidebar"]').first();
    await expect(sidebar).toBeVisible({ timeout: 15000 });

    await sidebar.locator('text=Scenarios').first().click();
    await page.waitForTimeout(1000);

    // Navigate to scenario
    await page.locator('text=VM Creds Delete Scenario').first().click();
    await page.waitForTimeout(1000);

    // Navigate to credentials section
    const credTab = page.locator('text=/VM Credential|credential/i, mat-tab:has-text("Credential"), [role="tab"]:has-text("Credential")').first();
    const hasCredTab = await credTab.isVisible({ timeout: 5000 }).catch(() => false);
    if (hasCredTab) {
      await credTab.click();
      await page.waitForTimeout(1000);
    }

    // Click delete on existing credential
    const deleteButton = page.locator('button:has(mat-icon:text("delete")), button:has-text("Delete")').first();
    await expect(deleteButton).toBeVisible({ timeout: 10000 });
    await deleteButton.click();
    await page.waitForTimeout(500);

    // Confirm deletion
    const confirmButton = page.locator('button:has-text("Confirm"), button:has-text("Yes"), button:has-text("Delete"), button:has-text("OK")').last();
    const hasConfirm = await confirmButton.isVisible({ timeout: 3000 }).catch(() => false);
    if (hasConfirm) {
      await confirmButton.click();
      await page.waitForTimeout(1000);
    }

    // Verify credential is removed
    const credVisible = await page.locator('text=deleteuser').isVisible({ timeout: 3000 }).catch(() => false);
    expect(credVisible).toBeFalsy();
  });
});
