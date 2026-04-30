// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: steamfitter/steamfitter-test-plan.md
// seed: tests/seed.spec.ts

import { test, expect, Services, getKeycloakAccessToken, authenticatedApi } from '../../fixtures';

test.describe('API Error Handling', () => {
  let templateId: string | null = null;
  let scenarioId: string | null = null;
  let apiToken: string | null = null;

  test.afterEach(async ({ request }) => {
    const token = apiToken ?? await getKeycloakAccessToken(request).catch(() => null);
    if (!token) return;
    const api = authenticatedApi(request, token);

    if (scenarioId) {
      try {
        await api.post(`${Services.Steamfitter.API}/api/scenarios/${scenarioId}/end`).catch(() => {});
        await api.delete(`${Services.Steamfitter.API}/api/scenarios/${scenarioId}`);
      } catch { /* ignore cleanup errors */ }
      scenarioId = null;
    }
    if (templateId) {
      try {
        await api.delete(`${Services.Steamfitter.API}/api/scenariotemplates/${templateId}`);
      } catch { /* ignore cleanup errors */ }
      templateId = null;
    }
  });

  test('Task Score Update Without Concurrent Errors', async ({ steamfitterAuthenticatedPage: page, request }) => {
    // Obtain an access token for API calls
    apiToken = await getKeycloakAccessToken(request);
    const api = authenticatedApi(request, apiToken);

    // Setup: create template with scored tasks and scenario
    const createTemplateResp = await api.post(`${Services.Steamfitter.API}/api/scenariotemplates`, {
      data: { name: 'Score Update Test', description: 'Test concurrent score updates', durationHours: 1 },
    });
    expect(createTemplateResp.ok()).toBeTruthy();
    const template = await createTemplateResp.json();
    templateId = template.id;

    // Add multiple scored tasks
    await api.post(`${Services.Steamfitter.API}/api/tasks/scenariotemplate/${templateId}`, {
      data: { name: 'Score Task 1', description: 'First scored task', triggerCondition: 'Manual', score: 10 },
    });
    await api.post(`${Services.Steamfitter.API}/api/tasks/scenariotemplate/${templateId}`, {
      data: { name: 'Score Task 2', description: 'Second scored task', triggerCondition: 'Manual', score: 20 },
    });
    await api.post(`${Services.Steamfitter.API}/api/tasks/scenariotemplate/${templateId}`, {
      data: { name: 'Score Task 3', description: 'Third scored task', triggerCondition: 'Manual', score: 30 },
    });

    const createScenarioResp = await api.post(`${Services.Steamfitter.API}/api/scenarios`, {
      data: { name: 'Score Update Scenario', description: 'Test scenario', scenarioTemplateId: templateId, durationHours: 1 },
    });
    expect(createScenarioResp.ok()).toBeTruthy();
    const scenario = await createScenarioResp.json();
    scenarioId = scenario.id;

    // Start scenario
    await api.post(`${Services.Steamfitter.API}/api/scenarios/${scenarioId}/start`);

    // Navigate to the scenario
    await page.goto(`${Services.Steamfitter.UI}/admin`);
    await page.waitForLoadState('domcontentloaded');

    const sidebar = page.locator('mat-sidenav, mat-drawer, [class*="sidebar"]').first();
    await expect(sidebar).toBeVisible({ timeout: 15000 });
    await sidebar.locator('text=Scenarios').first().click();
    await page.waitForTimeout(1000);

    await page.locator('text=Score Update Scenario').first().click();
    await page.waitForTimeout(1000);

    // Monitor console for errors during task execution
    const consoleErrors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });

    // Execute multiple tasks
    const executeButtons = page.locator('button:has(mat-icon:text("play_arrow")), button:has-text("Execute")');
    const buttonCount = await executeButtons.count();

    for (let i = 0; i < Math.min(buttonCount, 3); i++) {
      const btn = executeButtons.nth(i);
      if (await btn.isVisible().catch(() => false)) {
        await btn.click();
        await page.waitForTimeout(500);

        // Handle confirmation dialog if it appears
        const confirmDialog = page.locator('mat-dialog-container button:has-text("Confirm"), mat-dialog-container button:has-text("Yes")').first();
        if (await confirmDialog.isVisible({ timeout: 1000 }).catch(() => false)) {
          await confirmDialog.click();
          await page.waitForTimeout(500);
        }
      }
    }

    await page.waitForTimeout(2000);

    // Verify no concurrent errors in console
    const concurrencyErrors = consoleErrors.filter(
      (e) => e.includes('concurrent') || e.includes('Concurrent') || e.includes('conflict')
    );
    expect(concurrencyErrors.length).toBe(0);

    // Verify score updates correctly (no errors in the UI)
    const errorSnackbar = page.locator('mat-snack-bar:has-text("error"), [class*="snack"]:has-text("error")').first();
    const hasErrorSnackbar = await errorSnackbar.isVisible({ timeout: 2000 }).catch(() => false);
    expect(hasErrorSnackbar).toBe(false);
  });
});
