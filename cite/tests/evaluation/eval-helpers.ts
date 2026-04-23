// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { APIRequestContext, Page, expect } from '@playwright/test';
import { Services } from '../../../shared-fixtures';

const API_TIMEOUT = 60000;

export async function getApiToken(request: APIRequestContext): Promise<string> {
  const resp = await request.post('https://localhost:8443/realms/crucible/protocol/openid-connect/token', {
    form: {
      grant_type: 'password',
      client_id: 'cite.ui',
      username: 'admin',
      password: 'admin',
      scope: 'openid cite',
    },
    timeout: API_TIMEOUT,
  });
  const data = await resp.json();
  return data.access_token;
}

async function getOrCreateTeamType(request: APIRequestContext, token: string): Promise<string> {
  const headers = { Authorization: `Bearer ${token}` };
  const resp = await request.get(`${Services.Cite.API}/api/teamtypes`, { headers, timeout: API_TIMEOUT });
  const types = await resp.json();
  if (types.length > 0) return types[0].id;

  const createResp = await request.post(`${Services.Cite.API}/api/teamtypes`, {
    headers,
    data: { name: 'E2E Test Type' },
    timeout: API_TIMEOUT,
  });
  const created = await createResp.json();
  return created.id;
}

async function getCurrentUserId(request: APIRequestContext, token: string): Promise<string> {
  const headers = { Authorization: `Bearer ${token}` };
  const resp = await request.get(`${Services.Cite.API}/api/users`, { headers, timeout: API_TIMEOUT });
  const users = await resp.json();
  const admin = users.find((u: any) => u.name === 'Admin User');
  if (!admin) throw new Error('Admin user not found in CITE');
  return admin.id;
}

/**
 * Create a fully-functional evaluation that appears on "My Evaluations".
 * This creates the evaluation, a team, and adds the admin user as a team member.
 */
export async function createVisibleEvaluation(
  request: APIRequestContext,
  token: string,
  description: string,
): Promise<string> {
  const headers = { Authorization: `Bearer ${token}` };

  const modelsResp = await request.get(`${Services.Cite.API}/api/scoringmodels`, { headers, timeout: API_TIMEOUT });
  const models = await modelsResp.json();
  if (!models.length) throw new Error('No scoring models available');

  const teamTypeId = await getOrCreateTeamType(request, token);
  const userId = await getCurrentUserId(request, token);

  const evalResp = await request.post(`${Services.Cite.API}/api/evaluations`, {
    headers,
    data: { description, scoringModelId: models[0].id, status: 'Active' },
    timeout: API_TIMEOUT,
  });
  const evaluation = await evalResp.json();

  const teamResp = await request.post(`${Services.Cite.API}/api/teams`, {
    headers,
    data: {
      name: `${description} Team`,
      shortName: 'E2E',
      evaluationId: evaluation.id,
      teamTypeId,
    },
    timeout: API_TIMEOUT,
  });
  const team = await teamResp.json();

  await request.post(`${Services.Cite.API}/api/teams/${team.id}/memberships`, {
    headers,
    data: { teamId: team.id, userId },
    timeout: API_TIMEOUT,
  });

  return evaluation.id;
}

export async function ensureEvaluation(request: APIRequestContext, token: string): Promise<{ id: string; created: boolean }> {
  const listResp = await request.get(`${Services.Cite.API}/api/evaluations`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const evals = await listResp.json();
  if (evals.length > 0) {
    return { id: evals[0].id, created: false };
  }

  const id = await createVisibleEvaluation(request, token, `E2E Test Evaluation - ${Date.now()}`);
  return { id, created: true };
}

export async function deleteEvaluation(request: APIRequestContext, token: string, id: string): Promise<void> {
  await request.delete(`${Services.Cite.API}/api/evaluations/${id}`, {
    headers: { Authorization: `Bearer ${token}` },
    timeout: API_TIMEOUT,
  });
}

export async function navigateToEvaluation(page: Page): Promise<void> {
  await page.goto(`${Services.Cite.UI}/admin`);
  await expect(page).toHaveURL(/\/admin/, { timeout: 15000 });
  const evalRow = page.getByRole('row').filter({ hasText: /E2E Test Evaluation|Active/ }).first();
  await expect(evalRow).toBeVisible({ timeout: 15000 });
  await evalRow.click();
}
