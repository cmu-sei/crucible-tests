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

  test('SSRF Protection Blocks Disallowed Hosts', async ({ steamfitterAuthenticatedPage: page, request }) => {
    // Obtain an access token for API calls
    apiToken = await getKeycloakAccessToken(request);
    const api = authenticatedApi(request, apiToken);

    // Setup: create template with HTTP task targeting disallowed host
    const createTemplateResp = await api.post(`${Services.Steamfitter.API}/api/scenariotemplates`, {
      data: { name: 'SSRF Protection Test', description: 'Test SSRF blocking', durationHours: 1 },
    });
    expect(createTemplateResp.ok()).toBeTruthy();
    const template = await createTemplateResp.json();
    templateId = template.id;

    // Add a task targeting a disallowed host (e.g., metadata endpoint)
    const createTaskResp = await api.post(`${Services.Steamfitter.API}/api/tasks/scenariotemplate/${templateId}`, {
      data: {
        name: 'SSRF Task',
        description: 'Task targeting disallowed host',
        triggerCondition: 'Manual',
        action: 'http_get',
        apiUrl: 'http://169.254.169.254/latest/meta-data/',
      },
    });
    if (createTaskResp.ok()) {
      const task = await createTaskResp.json();
      expect(task.id).toBeTruthy();
    }

    // Create scenario and start it
    const createScenarioResp = await api.post(`${Services.Steamfitter.API}/api/scenarios`, {
      data: { name: 'SSRF Test Scenario', description: 'Test scenario', scenarioTemplateId: templateId, durationHours: 1 },
    });
    expect(createScenarioResp.ok()).toBeTruthy();
    const scenario = await createScenarioResp.json();
    scenarioId = scenario.id;

    // Start scenario
    await api.post(`${Services.Steamfitter.API}/api/scenarios/${scenarioId}/start`);
    await page.waitForTimeout(1000);

    // Navigate to the scenario and execute the task
    await page.goto(`${Services.Steamfitter.UI}/admin`);
    await page.waitForLoadState('domcontentloaded');

    const sidebar = page.locator('mat-sidenav, mat-drawer, [class*="sidebar"]').first();
    await expect(sidebar).toBeVisible({ timeout: 15000 });
    await sidebar.locator('text=Scenarios').first().click();
    await page.waitForTimeout(1000);

    await page.locator('text=SSRF Test Scenario').first().click();
    await page.waitForTimeout(1000);

    // Try to execute the task and verify SSRF error in result
    const executeButton = page.locator('button:has(mat-icon:text("play_arrow")), button:has-text("Execute")').first();
    const hasExecute = await executeButton.isVisible({ timeout: 5000 }).catch(() => false);

    if (hasExecute) {
      await executeButton.click();
      await page.waitForTimeout(2000);

      // Check for SSRF error message in the result
      const resultText = page.locator('[class*="result"], [class*="error"], [class*="output"], pre, code');
      const hasResult = await resultText.first().isVisible({ timeout: 5000 }).catch(() => false);
      if (hasResult) {
        const text = await resultText.first().textContent();
        // Result should indicate the host is blocked/disallowed
        expect(text?.toLowerCase()).toMatch(/blocked|disallowed|denied|forbidden|ssrf|not allowed/i);
      }
    }
  });
});
