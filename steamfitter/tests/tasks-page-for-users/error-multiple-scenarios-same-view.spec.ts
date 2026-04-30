// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: steamfitter/steamfitter-test-plan.md
// seed: tests/seed.spec.ts

import { test, expect, Services } from '../../fixtures';

test.describe('Tasks Page for Users', () => {
  let templateId1: string | null = null;
  let templateId2: string | null = null;
  let scenarioId1: string | null = null;
  let scenarioId2: string | null = null;
  const sharedViewId = '00000000-0000-0000-0000-000000000001';

  test.afterEach(async ({ request }) => {
    if (scenarioId1) {
      try { await request.post(`${Services.Steamfitter.API}/api/scenarios/${scenarioId1}/end`); } catch {}
      try { await request.delete(`${Services.Steamfitter.API}/api/scenarios/${scenarioId1}`); } catch {}
      scenarioId1 = null;
    }
    if (scenarioId2) {
      try { await request.post(`${Services.Steamfitter.API}/api/scenarios/${scenarioId2}/end`); } catch {}
      try { await request.delete(`${Services.Steamfitter.API}/api/scenarios/${scenarioId2}`); } catch {}
      scenarioId2 = null;
    }
    if (templateId1) {
      try { await request.delete(`${Services.Steamfitter.API}/api/scenariotemplates/${templateId1}`); } catch {}
      templateId1 = null;
    }
    if (templateId2) {
      try { await request.delete(`${Services.Steamfitter.API}/api/scenariotemplates/${templateId2}`); } catch {}
      templateId2 = null;
    }
  });

  test('Error When Multiple Scenarios on Same View', async ({ steamfitterAuthenticatedPage: page, request }) => {
    // Create first template and scenario
    const template1Resp = await request.post(`${Services.Steamfitter.API}/api/scenariotemplates`, {
      data: { name: 'Template Multi View 1', description: 'First template', durationHours: 1 },
    });
    expect(template1Resp.ok()).toBeTruthy();
    const template1 = await template1Resp.json();
    templateId1 = template1.id;

    const scenario1Resp = await request.post(`${Services.Steamfitter.API}/api/scenarios`, {
      data: { name: 'Scenario Multi 1', description: 'First scenario on view', scenarioTemplateId: templateId1, viewId: sharedViewId },
    });
    expect(scenario1Resp.ok()).toBeTruthy();
    const scenario1 = await scenario1Resp.json();
    scenarioId1 = scenario1.id;

    // Create second template and scenario on same view
    const template2Resp = await request.post(`${Services.Steamfitter.API}/api/scenariotemplates`, {
      data: { name: 'Template Multi View 2', description: 'Second template', durationHours: 1 },
    });
    expect(template2Resp.ok()).toBeTruthy();
    const template2 = await template2Resp.json();
    templateId2 = template2.id;

    const scenario2Resp = await request.post(`${Services.Steamfitter.API}/api/scenarios`, {
      data: { name: 'Scenario Multi 2', description: 'Second scenario on view', scenarioTemplateId: templateId2, viewId: sharedViewId },
    });
    expect(scenario2Resp.ok()).toBeTruthy();
    const scenario2 = await scenario2Resp.json();
    scenarioId2 = scenario2.id;

    // Navigate to view page - should show error
    await page.goto(`${Services.Steamfitter.UI}/view/${sharedViewId}`);

    await expect(page.locator('text=/error|multiple|conflict/i').first()).toBeVisible();
  });
});
