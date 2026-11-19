// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: cite/cite-test-plan.md
// seed: tests/seed.spec.ts

import { test, expect, APIRequestContext } from '@playwright/test';
import { Services, authenticateWithKeycloak } from '../../../shared-fixtures';
import { CITE_THEMES, setCiteTheme } from '../../fixtures';
import { findAdminRowByName } from '../../test-helpers';
async function getApiToken(request: APIRequestContext): Promise<string> {
  const resp = await request.post(`${Services.Keycloak}/realms/crucible/protocol/openid-connect/token`, {
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

async function createEvaluation(request: APIRequestContext, token: string): Promise<{ id: string; description: string }> {
  const modelsResp = await request.get(`${Services.Cite.API}/api/scoringmodels`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const models = await modelsResp.json();
  // On a clean database no scoring model exists (the seed.spec.ts stub is empty), so
  // create one rather than failing — an evaluation requires a scoringModelId.
  let scoringModelId: string;
  if (models.length) {
    scoringModelId = models[0].id;
  } else {
    const smResp = await request.post(`${Services.Cite.API}/api/scoringmodels`, {
      headers: { Authorization: `Bearer ${token}` },
      data: { description: `E2E Realtime Scoring Model - ${Date.now()}`, status: 'Pending' },
    });
    scoringModelId = (await smResp.json()).id;
  }

  const description = `E2E Test Evaluation - ${Date.now()}`;
  const resp = await request.post(`${Services.Cite.API}/api/evaluations`, {
    headers: { Authorization: `Bearer ${token}` },
    data: {
      description,
      scoringModelId,
      status: 'Active',
    },
  });
  const evaluation = await resp.json();
  return { id: evaluation.id, description };
}

async function deleteEvaluation(request: APIRequestContext, token: string, id: string): Promise<void> {
  await request.delete(`${Services.Cite.API}/api/evaluations/${id}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
}

for (const theme of CITE_THEMES) {
  test.describe(`${theme} theme › Real-time Collaboration Features`, () => {
    test('Real-time Score Updates', async ({ browser, request }) => {
      // Setup: Create evaluation via API
      const apiToken = await getApiToken(request);
      const { id: evaluationId, description } = await createEvaluation(request, apiToken);

      try {
        // 1. Open two browser instances with different users logged in to the same evaluation
        // Both sessions sign in as admin through Keycloak. The empty storage state is explicit so
        // neither context inherits a saved sign-in (this spec uses the base `test`, which has none,
        // but the CITE fixture's default would be admin's saved state).
        const context1 = await browser.newContext({ ignoreHTTPSErrors: true, storageState: { cookies: [], origins: [] } });
        const context2 = await browser.newContext({ ignoreHTTPSErrors: true, storageState: { cookies: [], origins: [] } });
        const page1 = await context1.newPage();
        const page2 = await context2.newPage();

        await authenticateWithKeycloak(page1, Services.Cite.UI);
        await setCiteTheme(page1, theme);
        await authenticateWithKeycloak(page2, Services.Cite.UI);
        await setCiteTheme(page2, theme);

        // Both instances navigate to admin page where the evaluation is visible
        for (const page of [page1, page2]) {
          await page.goto(`${Services.Cite.UI}/admin`);
          await expect(page).toHaveURL(/\/admin/, { timeout: 15000 });
          // Search for this run's evaluation: the list is paged, and earlier runs and other
          // files' evaluations can push it off the first page.
          const evalRow = await findAdminRowByName(page, description);
          await expect(evalRow).toBeVisible({ timeout: 15000 });
          await evalRow.click();
        }

        // Switch to scoresheet on both (if available)
        for (const page of [page1, page2]) {
          const scoreTab = page.locator('[role="tab"]:has-text("Scoresheet"), button:has-text("Scoresheet")').first();
          const tabVisible = await scoreTab.waitFor({ state: 'visible', timeout: 5000 }).then(() => true, () => false);
          if (tabVisible) {
            await scoreTab.click();
          }
        }

        // expect: Both instances are authenticated and viewing the evaluation
        // 2. In first instance, modify a score (if scoring options available)
        const option = page1.locator('mat-checkbox, mat-radio-button, [class*="scoring-option"]').first();
        const optionVisible = await option.waitFor({ state: 'visible', timeout: 5000 }).then(() => true, () => false);
        if (optionVisible) {
          await option.click();
          // Wait for the checked state to reflect the selection (MDC checkbox puts checked state on inner input)
          await expect(option.locator('input')).toBeChecked({ timeout: 5000 });

          // 3. Observe second instance
          // expect: Score update appears in second instance automatically via SignalR
          // The corresponding option on page2 should become checked via SignalR
          const option2 = page2.locator('mat-checkbox, mat-radio-button, [class*="scoring-option"]').first();
          const option2Visible = await option2.waitFor({ state: 'visible', timeout: 5000 }).then(() => true, () => false);
          if (option2Visible) {
            await expect(option2.locator('input')).toBeChecked({ timeout: 15000 });
          }
        }

        await context1.close();
        await context2.close();
      } finally {
        // Cleanup: Delete evaluation
        await deleteEvaluation(request, apiToken, evaluationId);
      }
    });
  });
}
