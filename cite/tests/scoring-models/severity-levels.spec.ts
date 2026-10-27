// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: cite/cite-test-plan.md
// seed: tests/seed.spec.ts

import { randomUUID } from 'crypto';
import { APIRequestContext } from '@playwright/test';
import {
  test,
  expect,
  Services,
  getCiteApiToken,
  seedScoringModel,
  seedEvaluation,
  seedEvaluationMembership,
  seedTeamType,
  seedTeam,
  seedTeamMembership,
  getCurrentUserId,
  apiDeleteScoringModel,
  cleanupCompleteEvaluation,
  CITE_THEMES,
  setCiteTheme,
} from '../../fixtures';
import { navigateToAdminSection, findAdminRowByName } from '../../test-helpers';

const CUSTOM_LEVELS = [
  { name: 'Calm', minimumScore: 0, color: '#FFFFFF', description: 'Nothing to act on' },
  { name: 'Storm', minimumScore: 60, color: '#8B0000', description: 'Act now' },
];

async function getScoringModel(request: APIRequestContext, id: string) {
  const headers = { Authorization: `Bearer ${await getCiteApiToken(request)}` };
  const response = await request.get(`${Services.Cite.API}/api/scoringModels/${id}`, { headers });
  expect(response.status()).toBe(200);
  return response.json();
}

async function setSeverityLevels(request: APIRequestContext, id: string, severityLevels: object[]) {
  const headers = { Authorization: `Bearer ${await getCiteApiToken(request)}` };
  const scoringModel = await getScoringModel(request, id);
  const response = await request.put(`${Services.Cite.API}/api/scoringModels/${id}`, {
    headers,
    data: { ...scoringModel, severityLevels },
  });
  expect(response.status()).toBe(200);
}

for (const theme of CITE_THEMES) {
  test.describe(`${theme} theme › Scoring Model Severity Levels`, () => {
    const scoringModelIds: string[] = [];
    let evaluationIds: { evaluationId: string; scoringModelId: string; teamTypeId: string } | null = null;

    test.afterEach(async () => {
      if (evaluationIds) {
        await cleanupCompleteEvaluation(evaluationIds);
        evaluationIds = null;
      }
      while (scoringModelIds.length) {
        await apiDeleteScoringModel(scoringModelIds.pop()!);
      }
    });

    test('Customize the default severity levels', async ({ citeAuthenticatedPage: page, request }) => {
      await setCiteTheme(page, theme);
      const description = `Severity Levels Model ${theme} ${randomUUID()}`;
      const id = await seedScoringModel(description);
      scoringModelIds.push(id);

      // 1. Open the scoring model in the admin Scoring Models section
      await navigateToAdminSection(page, 'Scoring Models');
      const row = await findAdminRowByName(page, description);
      await row.getByRole('button', { name: /^Edit / }).click();
      const dialog = page.getByRole('dialog');

      // expect: a scoring model without levels of its own uses the defaults
      await expect(dialog.getByText('Using the default CISA levels.')).toBeVisible({ timeout: 5000 });

      // 2. Click Customize Levels
      await dialog.getByRole('button', { name: 'Customize Levels' }).click();

      // expect: the six default levels, highest first, are editable
      const names = dialog.getByRole('textbox', { name: 'Name' });
      await expect(names).toHaveCount(6);
      await expect(names.first()).toHaveValue('Emergency');

      // 3. Rename Emergency to Critical and save
      await names.first().fill('Critical');
      await dialog.getByRole('button', { name: 'Save' }).click();
      await expect(dialog).not.toBeVisible({ timeout: 15000 });

      // expect: the scoring model now has its own six levels
      await expect
        .poll(async () => (await getScoringModel(request, id)).severityLevels?.map((level: { name: string }) => level.name))
        .toEqual(['Critical', 'Severe', 'High', 'Medium', 'Low', 'Baseline']);
    });

    test("Score Summary shows the scoring model's severity levels", async ({ citeAuthenticatedPage: page, request }) => {
      await setCiteTheme(page, theme);
      const description = `Severity Levels Evaluation ${theme} ${randomUUID()}`;
      const scoringModelId = await seedScoringModel(`Scoring Model for ${description}`);
      await setSeverityLevels(request, scoringModelId, CUSTOM_LEVELS);
      // the evaluation gets its own copy of the scoring model, levels included
      const evaluationId = await seedEvaluation(scoringModelId, description);
      const teamTypeId = await seedTeamType(`Team Type for ${description}`);
      evaluationIds = { evaluationId, scoringModelId, teamTypeId };
      const userId = await getCurrentUserId();
      await seedEvaluationMembership(evaluationId, userId);
      const teamId = await seedTeam(evaluationId, teamTypeId, `Team for ${description}`);
      await seedTeamMembership(teamId, userId);

      // 1. Open the evaluation dashboard
      await page.goto(`${Services.Cite.UI}/?evaluation=${evaluationId}`);
      const summary = page.locator('app-score-summary');

      // expect: the Score Summary lists the scoring model's levels, highest first, with their ranges
      await expect(summary.getByRole('heading', { level: 2 })).toHaveText(['Level 1 - Storm', 'Level 0 - Calm'], { timeout: 15000 });
      await expect(summary.getByText('60+', { exact: true })).toBeVisible();
      await expect(summary.getByText('0-59.99', { exact: true })).toBeVisible();
      await expect(summary.getByText('Act now')).toBeVisible();

      // expect: a new submission's score of 0 is in Calm, the current level
      const calm = summary.getByRole('listitem').filter({ has: page.getByRole('heading', { name: 'Level 0 - Calm' }) });
      await expect(calm).toHaveClass(/current/);
    });
  });
}
