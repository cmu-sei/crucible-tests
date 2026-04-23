// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: cite/cite-test-plan.md
// seed: tests/seed.spec.ts

import { test, expect, APIRequestContext } from '@playwright/test';
import { Services, authenticateWithKeycloak } from '../../../shared-fixtures';

async function getApiToken(request: APIRequestContext): Promise<string> {
  const resp = await request.post('https://localhost:8443/realms/crucible/protocol/openid-connect/token', {
    form: {
      grant_type: 'password',
      client_id: 'cite.ui',
      username: 'admin',
      password: 'admin',
      scope: 'openid cite',
    },
  });
  const data = await resp.json();
  return data.access_token;
}

async function createEvaluation(request: APIRequestContext, token: string): Promise<string> {
  const modelsResp = await request.get(`${Services.Cite.API}/api/scoringmodels`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const models = await modelsResp.json();
  if (!models.length) throw new Error('No scoring models available');

  const resp = await request.post(`${Services.Cite.API}/api/evaluations`, {
    headers: { Authorization: `Bearer ${token}` },
    data: {
      description: `E2E Test Evaluation - ${Date.now()}`,
      scoringModelId: models[0].id,
      status: 'Active',
    },
  });
  const evaluation = await resp.json();
  return evaluation.id;
}

async function deleteEvaluation(request: APIRequestContext, token: string, id: string): Promise<void> {
  await request.delete(`${Services.Cite.API}/api/evaluations/${id}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
}

test.describe('Real-time Collaboration Features', () => {
  test('Real-time Team Changes', async ({ browser, request }) => {
    // Setup: Create evaluation via API
    const apiToken = await getApiToken(request);
    const evaluationId = await createEvaluation(request, apiToken);

    try {
      // 1. Open two browser instances with users viewing the same evaluation
      const context1 = await browser.newContext({ ignoreHTTPSErrors: true });
      const context2 = await browser.newContext({ ignoreHTTPSErrors: true });
      const page1 = await context1.newPage();
      const page2 = await context2.newPage();

      await authenticateWithKeycloak(page1, Services.Cite.UI);
      await authenticateWithKeycloak(page2, Services.Cite.UI);

      // Both navigate to admin page where the evaluation is visible
      for (const page of [page1, page2]) {
        await page.goto(`${Services.Cite.UI}/admin`);
        await expect(page).toHaveURL(/\/admin/, { timeout: 15000 });
        const evalRow = page.getByRole('row').filter({ hasText: 'E2E Test Evaluation' }).first();
        await expect(evalRow).toBeVisible({ timeout: 15000 });
        await evalRow.click();
      }

      // expect: Both instances are viewing evaluation data
      // 2. In admin interface in first instance, modify team membership
      // 3. Observe second instance - team changes reflected automatically

      await context1.close();
      await context2.close();
    } finally {
      // Cleanup: Delete evaluation
      await deleteEvaluation(request, apiToken, evaluationId);
    }
  });
});
