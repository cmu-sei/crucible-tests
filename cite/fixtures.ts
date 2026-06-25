// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { test as base, Page, request as pwRequest, APIRequestContext } from '@playwright/test';
import fs from 'fs';
import { Services, serviceUrlPattern, oidcStorageKey, authenticateWithKeycloak } from '../shared-fixtures';
import { authStatePath } from '../auth-paths';

/**
 * CITE-specific fixtures
 * Extends shared fixtures with CITE authentication
 */

/**
 * CITE-specific authentication helper
 * @param page - Playwright Page object
 * @param username - Keycloak username (default: 'admin')
 * @param password - Keycloak password (default: 'admin')
 */
export async function authenticateCiteWithKeycloak(
  page: Page,
  username: string = 'admin',
  password: string = 'admin'
): Promise<void> {
  await authenticateWithKeycloak(page, Services.Cite.UI, username, password);
}

// ========================================================================
// API-based test data seeding and cleanup
// ========================================================================

/**
 * Get a Keycloak access token for the CITE API.
 */
export async function getCiteApiToken(apiContext: APIRequestContext): Promise<string> {
  const tokenResponse = await apiContext.post(
    `${Services.Keycloak}/realms/crucible/protocol/openid-connect/token`,
    {
      form: {
        grant_type: 'password',
        client_id: 'cite.ui',
        username: 'admin',
        password: 'admin',
        scope: 'openid profile cite',
      },
      ignoreHTTPSErrors: true,
    }
  );

  if (!tokenResponse.ok()) {
    throw new Error(`Failed to get CITE API token: ${tokenResponse.status()} ${await tokenResponse.text()}`);
  }

  const data = await tokenResponse.json();
  return data.access_token;
}

/**
 * Seed a scoring model via the CITE API.
 * Returns the created scoring model ID.
 */
export async function seedScoringModel(
  description: string = `Test Scoring Model ${Date.now()}`
): Promise<string> {
  const apiContext = await pwRequest.newContext({ ignoreHTTPSErrors: true });
  try {
    const token = await getCiteApiToken(apiContext);

    const response = await apiContext.post(`${Services.Cite.API}/api/scoringmodels`, {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      data: {
        description,
        // CITE serializes ItemStatus as a STRING enum ('Pending'|'Active'|'Complete'|'Archived').
        // The admin UI filters the list with `evaluation.status === ItemStatus.Pending` (a string),
        // so a numeric 0 here is silently filtered out and the list shows "0 of 0".
        status: 'Pending',
        hideScoresOnScoreSheet: false,
        displayCommentTextBoxes: true,
        displayScoringModelByMoveNumber: false,
        showPastSituationDescriptions: false,
        useSubmit: false,
        useUserScore: false,
        useTeamScore: false,
        useTeamAverageScore: false,
        useTypeAverageScore: false,
        useOfficialScore: false,
        rightSideDisplay: 0, // RightSideDisplay.None = 0
      },
    });

    if (!response.ok()) {
      throw new Error(`Failed to create scoring model: ${response.status()} ${await response.text()}`);
    }

    const scoringModel = await response.json();
    console.log(`API seed: Created scoring model "${description}" (${scoringModel.id})`);
    return scoringModel.id;
  } finally {
    await apiContext.dispose();
  }
}

/**
 * Ensure at least one scoring model exists, returning the id of an existing one
 * or a freshly seeded one.
 *
 * Several CITE test suites (report, scoresheet, aggregate, realtime, integration)
 * create their evaluation through the admin UI by picking a Scoring Model from a
 * dropdown, or via an API helper that does `GET /api/scoringmodels` and uses
 * `models[0]`. Both assume a scoring model already exists — historically provided
 * by `tests/seed.spec.ts`, which is an empty stub. On a clean database the dropdown
 * is empty / the helper throws "No scoring models available", so the evaluation is
 * never created and the row never appears. Call this in setup to guarantee the
 * precondition without depending on cross-test seed state.
 */
export async function ensureScoringModelExists(
  description: string = 'E2E Shared Scoring Model'
): Promise<string> {
  const apiContext = await pwRequest.newContext({ ignoreHTTPSErrors: true });
  try {
    const token = await getCiteApiToken(apiContext);
    const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
    const listResponse = await apiContext.get(`${Services.Cite.API}/api/scoringmodels`, {
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
    });
    if (listResponse.ok()) {
      const models: Array<{ id: string; description: string; useUserScore?: boolean; useTeamScore?: boolean }> =
        await listResponse.json();
      // Reuse OUR named shared model if it already exists. This MUST match on the
      // well-known description, because the LIST endpoint does not serialize
      // `scoringCategories` (it always returns []), so we cannot tell from the list
      // alone whether a model has categories. Matching on description keeps this
      // idempotent — exactly one "E2E Shared Scoring Model" is ever created, instead
      // of a fresh one on every call (which previously flooded the admin list past
      // its 50-row first page and broke row lookups suite-wide).
      const existing = models.find(m => m.description === description && m.useUserScore && m.useTeamScore);
      if (existing) {
        // Lazily guarantee the reused model is scoresheet-ready: the scoresheet table
        // needs at least one scoring category to render score rows. Categories only
        // appear on the by-id GET (not the list), so fetch the single model and seed
        // a category if it has none.
        const detail = await apiContext.get(`${Services.Cite.API}/api/scoringmodels/${existing.id}`, {
          headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
        });
        const categories = detail.ok() ? (await detail.json()).scoringCategories : [];
        if (!Array.isArray(categories) || categories.length === 0) {
          await seedScoringCategoryWithOptions(apiContext, headers, existing.id);
        }
        return existing.id;
      }
    }

    // None suitable — seed a complete, scoresheet-ready model so that suites which
    // render the scoresheet/report (not just the Add Evaluation dropdown) have
    // something to display. The scoresheet's User/Team toggle only appears when
    // `(useUserScore && useTeamScore) || useTeamAverageScore || useOfficialScore`
    // is true, and the scoresheet table needs at least one scoring category.
    const modelResponse = await apiContext.post(`${Services.Cite.API}/api/scoringmodels`, {
      headers,
      data: {
        description,
        status: 'Active',
        useUserScore: true,
        useTeamScore: true,
        useTeamAverageScore: true,
        useOfficialScore: true,
        displayCommentTextBoxes: true,
        // Keep false so every scoring category renders regardless of the displayed
        // move number — getDisplayedScoringCategories() hides categories out of the
        // [moveNumberFirstDisplay, moveNumberLastDisplay] range only when this is true.
        displayScoringModelByMoveNumber: false,
        showPastSituationDescriptions: false,
        useSubmit: false,
        useTypeAverageScore: false,
        hideScoresOnScoreSheet: false,
        rightSideDisplay: 0,
      },
    });
    if (!modelResponse.ok()) {
      throw new Error(`Failed to create scoring model: ${modelResponse.status()} ${await modelResponse.text()}`);
    }
    const model = await modelResponse.json();

    // One scoring category with two options so the scoresheet renders score rows.
    await seedScoringCategoryWithOptions(apiContext, headers, model.id);

    console.log(`API seed: Created scoresheet-ready scoring model "${description}" (${model.id})`);
    return model.id;
  } finally {
    await apiContext.dispose();
  }
}

/**
 * Seed one scoring category (with two scoring options) onto a scoring model so the
 * scoresheet table renders score rows. Shared by both the reuse and create paths of
 * ensureScoringModelExists. Best-effort: a failed category POST is logged, not thrown,
 * so seeding never blocks the test that depends on the model existing.
 */
async function seedScoringCategoryWithOptions(
  apiContext: APIRequestContext,
  headers: Record<string, string>,
  scoringModelId: string,
): Promise<void> {
  const categoryResponse = await apiContext.post(`${Services.Cite.API}/api/scoringcategories`, {
    headers,
    data: {
      description: 'E2E Category',
      displayOrder: 1,
      scoringModelId,
      scoringWeight: 1,
      isModifierRequired: false,
      calculationEquation: '',
      moveNumberFirstDisplay: 0,
      moveNumberLastDisplay: 99,
      scoringOptionSelection: 'Single',
    },
  });
  if (categoryResponse.ok()) {
    const category = await categoryResponse.json();
    for (const [i, opt] of [['E2E Option Low', 0], ['E2E Option High', 10]].entries()) {
      await apiContext.post(`${Services.Cite.API}/api/scoringoptions`, {
        headers,
        data: {
          description: opt[0],
          displayOrder: i + 1,
          value: opt[1],
          isModifier: false,
          scoringCategoryId: category.id,
        },
      });
    }
  } else {
    console.warn(`API seed: Failed to create scoring category for model ${scoringModelId}: ${categoryResponse.status()}`);
  }
}

/**
 * Seed an evaluation via the CITE API.
 * Returns the created evaluation ID.
 */
export async function seedEvaluation(
  scoringModelId: string,
  description: string = `Test Evaluation ${Date.now()}`
): Promise<string> {
  const apiContext = await pwRequest.newContext({ ignoreHTTPSErrors: true });
  try {
    const token = await getCiteApiToken(apiContext);

    const response = await apiContext.post(`${Services.Cite.API}/api/evaluations`, {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      data: {
        description,
        scoringModelId,
        // Must be the STRING enum value — the admin Evaluations list filters by
        // `evaluation.status === ItemStatus.Pending` ('Pending'), so numeric 0 is filtered out.
        status: 'Active',
        currentMoveNumber: 0,
        situationTime: new Date().toISOString(),
        situationDescription: 'Test situation',
        showAdvanceButton: true,
      },
    });

    if (!response.ok()) {
      throw new Error(`Failed to create evaluation: ${response.status()} ${await response.text()}`);
    }

    const evaluation = await response.json();
    console.log(`API seed: Created evaluation "${description}" (${evaluation.id})`);
    return evaluation.id;
  } finally {
    await apiContext.dispose();
  }
}

/**
 * Seed a move for an evaluation via the CITE API.
 * Returns the created move ID.
 */
export async function seedMove(
  evaluationId: string,
  moveNumber: number,
  description: string = `Move ${moveNumber}`
): Promise<string> {
  const apiContext = await pwRequest.newContext({ ignoreHTTPSErrors: true });
  try {
    const token = await getCiteApiToken(apiContext);

    const response = await apiContext.post(`${Services.Cite.API}/api/moves`, {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      data: {
        description,
        moveNumber,
        situationTime: new Date().toISOString(),
        situationDescription: `Situation for ${description}`,
        evaluationId,
      },
    });

    if (!response.ok()) {
      throw new Error(`Failed to create move: ${response.status()} ${await response.text()}`);
    }

    const move = await response.json();
    console.log(`API seed: Created move "${description}" for evaluation ${evaluationId} (${move.id})`);
    return move.id;
  } finally {
    await apiContext.dispose();
  }
}

/**
 * Seed a team type via the CITE API.
 * Returns the created team type ID.
 */
export async function seedTeamType(
  name: string = `Test Team Type ${Date.now()}`
): Promise<string> {
  const apiContext = await pwRequest.newContext({ ignoreHTTPSErrors: true });
  try {
    const token = await getCiteApiToken(apiContext);

    const response = await apiContext.post(`${Services.Cite.API}/api/teamtypes`, {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      data: {
        name,
      },
    });

    if (!response.ok()) {
      throw new Error(`Failed to create team type: ${response.status()} ${await response.text()}`);
    }

    const teamType = await response.json();
    console.log(`API seed: Created team type "${name}" (${teamType.id})`);
    return teamType.id;
  } finally {
    await apiContext.dispose();
  }
}

/**
 * Ensure at least one team type exists (used by suites that pick a team type from
 * a UI dropdown when adding a team). Returns an existing team type id or seeds one.
 */
export async function ensureTeamTypeExists(
  name: string = 'E2E Shared Team Type'
): Promise<string> {
  const apiContext = await pwRequest.newContext({ ignoreHTTPSErrors: true });
  try {
    const token = await getCiteApiToken(apiContext);
    const listResponse = await apiContext.get(`${Services.Cite.API}/api/teamtypes`, {
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
    });
    if (listResponse.ok()) {
      const teamTypes: Array<{ id: string }> = await listResponse.json();
      if (teamTypes.length > 0) {
        return teamTypes[0].id;
      }
    }
  } finally {
    await apiContext.dispose();
  }
  return seedTeamType(name);
}

/**
 * Seed a team for an evaluation via the CITE API.
 * Returns the created team ID.
 */
export async function seedTeam(
  evaluationId: string,
  teamTypeId: string,
  name: string = `Test Team ${Date.now()}`
): Promise<string> {
  const apiContext = await pwRequest.newContext({ ignoreHTTPSErrors: true });
  try {
    const token = await getCiteApiToken(apiContext);

    const response = await apiContext.post(`${Services.Cite.API}/api/teams`, {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      data: {
        name,
        shortName: name.substring(0, 10),
        evaluationId,
        teamTypeId,
        hideScoresheet: false,
      },
    });

    if (!response.ok()) {
      throw new Error(`Failed to create team: ${response.status()} ${await response.text()}`);
    }

    const team = await response.json();
    console.log(`API seed: Created team "${name}" for evaluation ${evaluationId} (${team.id})`);
    return team.id;
  } finally {
    await apiContext.dispose();
  }
}

/**
 * Add a user to a team via the CITE API.
 * Returns the created team membership ID.
 */
export async function seedTeamMembership(
  teamId: string,
  userId: string
): Promise<string> {
  const apiContext = await pwRequest.newContext({ ignoreHTTPSErrors: true });
  try {
    const token = await getCiteApiToken(apiContext);

    const response = await apiContext.post(`${Services.Cite.API}/api/teams/${teamId}/memberships`, {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      data: {
        teamId,
        userId,
      },
    });

    if (!response.ok()) {
      throw new Error(`Failed to create team membership: ${response.status()} ${await response.text()}`);
    }

    const membership = await response.json();
    console.log(`API seed: Added user ${userId} to team ${teamId} (membership ${membership.id})`);
    return membership.id;
  } finally {
    await apiContext.dispose();
  }
}

/**
 * Get the admin user's ID from the CITE API by looking for a user named "Admin User".
 */
export async function getCurrentUserId(): Promise<string> {
  const apiContext = await pwRequest.newContext({ ignoreHTTPSErrors: true });
  try {
    const token = await getCiteApiToken(apiContext);

    const response = await apiContext.get(`${Services.Cite.API}/api/users`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok()) {
      throw new Error(`Failed to get users: ${response.status()} ${await response.text()}`);
    }

    const users: Array<{ id: string; name: string }> = await response.json();
    const adminUser = users.find(u => u.name === 'Admin User' || u.name.toLowerCase().includes('admin'));

    if (!adminUser) {
      throw new Error('Could not find admin user in users list');
    }

    return adminUser.id;
  } finally {
    await apiContext.dispose();
  }
}

/**
 * Delete a scoring model by ID via the CITE API.
 */
export async function apiDeleteScoringModel(scoringModelId: string): Promise<void> {
  const apiContext = await pwRequest.newContext({ ignoreHTTPSErrors: true });
  try {
    const token = await getCiteApiToken(apiContext);

    const response = await apiContext.delete(`${Services.Cite.API}/api/scoringmodels/${scoringModelId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (response.ok() || response.status() === 404) {
      console.log(`API cleanup: Deleted scoring model ${scoringModelId}`);
    } else {
      console.warn(`API cleanup: Failed to delete scoring model ${scoringModelId}: ${response.status()}`);
    }
  } finally {
    await apiContext.dispose();
  }
}

/**
 * Delete an evaluation by ID via the CITE API.
 */
export async function apiDeleteEvaluation(evaluationId: string): Promise<void> {
  const apiContext = await pwRequest.newContext({ ignoreHTTPSErrors: true });
  try {
    const token = await getCiteApiToken(apiContext);

    const response = await apiContext.delete(`${Services.Cite.API}/api/evaluations/${evaluationId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (response.ok() || response.status() === 404) {
      console.log(`API cleanup: Deleted evaluation ${evaluationId}`);
    } else {
      console.warn(`API cleanup: Failed to delete evaluation ${evaluationId}: ${response.status()}`);
    }
  } finally {
    await apiContext.dispose();
  }
}

/**
 * Delete a team type by ID via the CITE API.
 */
export async function apiDeleteTeamType(teamTypeId: string): Promise<void> {
  const apiContext = await pwRequest.newContext({ ignoreHTTPSErrors: true });
  try {
    const token = await getCiteApiToken(apiContext);

    const response = await apiContext.delete(`${Services.Cite.API}/api/teamtypes/${teamTypeId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (response.ok() || response.status() === 404) {
      console.log(`API cleanup: Deleted team type ${teamTypeId}`);
    } else {
      console.warn(`API cleanup: Failed to delete team type ${teamTypeId}: ${response.status()}`);
    }
  } finally {
    await apiContext.dispose();
  }
}

/**
 * Add a user as an evaluation member via the CITE API.
 * Returns the created evaluation membership ID.
 */
export async function seedEvaluationMembership(
  evaluationId: string,
  userId: string
): Promise<string> {
  const apiContext = await pwRequest.newContext({ ignoreHTTPSErrors: true });
  try {
    const token = await getCiteApiToken(apiContext);

    const response = await apiContext.post(`${Services.Cite.API}/api/evaluations/${evaluationId}/memberships`, {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      data: {
        evaluationId,
        userId,
      },
    });

    if (!response.ok()) {
      throw new Error(`Failed to create evaluation membership: ${response.status()} ${await response.text()}`);
    }

    const membership = await response.json();
    console.log(`API seed: Added user ${userId} as evaluation member for ${evaluationId} (membership ${membership.id})`);
    return membership.id;
  } finally {
    await apiContext.dispose();
  }
}

/**
 * Convenience function to seed a complete evaluation with scoring model, team, and membership.
 * Returns an object with all the created IDs.
 * Note: Moves are optional and can be added separately if needed.
 */
export async function seedCompleteEvaluation(
  description: string = `Complete Test Evaluation ${Date.now()}`,
  numMoves: number = 0
): Promise<{
  scoringModelId: string;
  evaluationId: string;
  moveIds: string[];
  teamTypeId: string;
  teamId: string;
  userId: string;
}> {
  const scoringModelId = await seedScoringModel(`Scoring Model for ${description}`);
  const evaluationId = await seedEvaluation(scoringModelId, description);

  // Note: A freshly created evaluation already has move 0, so start numbering at 1
  const moveIds: string[] = [];
  if (numMoves > 0) {
    for (let i = 1; i <= numMoves; i++) {
      const moveId = await seedMove(evaluationId, i, `Move ${i}`);
      moveIds.push(moveId);
    }
  }

  const userId = await getCurrentUserId();

  // Add user as evaluation member so they have access
  await seedEvaluationMembership(evaluationId, userId);

  const teamTypeId = await seedTeamType(`Team Type for ${description}`);
  const teamId = await seedTeam(evaluationId, teamTypeId, `Team for ${description}`);
  await seedTeamMembership(teamId, userId);

  console.log(`API seed: Complete evaluation setup finished for "${description}"`);

  return {
    scoringModelId,
    evaluationId,
    moveIds,
    teamTypeId,
    teamId,
    userId,
  };
}

/**
 * Purge stale test data via the API so a heavy/serial suite starts from a manageable
 * state. The CITE admin lists paginate at 10 and test data accumulates across the
 * full run; when the admin suite has created dozens of evaluations, the heavy suites
 * (report/scoresheet/aggregate/integration) can't find their freshly-seeded eval in
 * the list. Deleting evaluations whose description matches the well-known test
 * prefixes keeps the lists small and deterministic. Scoring models/team types are
 * left in place (ensureScoringModelExists/ensureTeamTypeExists reuse them).
 */
export async function purgeStaleEvaluations(
  prefixes: string[] = ['E2E', 'Test Evaluation', 'Group Aggregation', 'Delete Test', 'Copy Test'],
): Promise<void> {
  const apiContext = await pwRequest.newContext({ ignoreHTTPSErrors: true });
  try {
    const token = await getCiteApiToken(apiContext);
    const listResponse = await apiContext.get(`${Services.Cite.API}/api/evaluations`, {
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
    });
    if (!listResponse.ok()) {
      return;
    }
    const evaluations: Array<{ id: string; description: string }> = await listResponse.json();
    for (const evaluation of evaluations) {
      if (prefixes.some(p => (evaluation.description ?? '').startsWith(p))) {
        await apiContext.delete(`${Services.Cite.API}/api/evaluations/${evaluation.id}`, {
          headers: { Authorization: `Bearer ${token}` },
        }).catch(() => { /* best effort */ });
      }
    }
  } finally {
    await apiContext.dispose();
  }
}

/**
 * Teardown backstop: delete ALL CITE test data this suite is known to seed
 * (evaluations, scoring models, team types) whose name matches a well-known test
 * prefix. Runs from global-teardown after the suite so that even if an individual
 * test's own cleanup fails, the database never accumulates leftovers across runs.
 *
 * This is a safety net, NOT a substitute for per-test cleanup — every test must still
 * delete what it seeds (see CLAUDE.md "Test data hygiene"). Matching is by name prefix
 * so it only ever removes data this suite created; real/operator data is untouched.
 */
const CITE_TEST_NAME_PREFIXES = [
  'E2E',                  // shared seeds: "E2E Shared Scoring Model", "E2E Shared Team Type", "E2E ... Evaluation"
  'Test Evaluation',
  'Test Scoring Model',
  'Test Model For',       // admin scoring suite per-test models
  'Test Team Type',
  'Group Aggregation',
  'Aggregate Display',
  'Scoring Model for',    // seedCompleteEvaluation children
  'Team Type for',
  'Complete Test Evaluation',
  'Delete Test',
  'Copy Test',
];

function matchesTestPrefix(name: string | undefined): boolean {
  return CITE_TEST_NAME_PREFIXES.some(p => (name ?? '').startsWith(p));
}

export async function purgeAllCiteTestData(): Promise<void> {
  const apiContext = await pwRequest.newContext({ ignoreHTTPSErrors: true });
  try {
    const token = await getCiteApiToken(apiContext);
    const headers = { Authorization: `Bearer ${token}`, Accept: 'application/json' };

    // Order matters: evaluations reference scoring models, so delete evaluations first.
    const endpoints: Array<{ path: string; nameKey: 'description' | 'name'; label: string }> = [
      { path: '/api/evaluations', nameKey: 'description', label: 'evaluation' },
      { path: '/api/scoringmodels', nameKey: 'description', label: 'scoring model' },
      { path: '/api/teamtypes', nameKey: 'name', label: 'team type' },
    ];

    let removed = 0;
    for (const { path, nameKey, label } of endpoints) {
      const listResponse = await apiContext.get(`${Services.Cite.API}${path}`, { headers });
      if (!listResponse.ok()) continue;
      const items: Array<Record<string, string>> = await listResponse.json();
      for (const item of items) {
        if (!matchesTestPrefix(item[nameKey])) continue;
        const del = await apiContext
          .delete(`${Services.Cite.API}${path}/${item.id}`, { headers: { Authorization: `Bearer ${token}` } })
          .catch(() => null);
        if (del && (del.ok() || del.status() === 404)) {
          removed++;
        } else if (del) {
          console.warn(`Teardown: failed to delete ${label} "${item[nameKey]}" (${item.id}): ${del.status()}`);
        }
      }
    }
    console.log(`Teardown: purged ${removed} CITE test record(s) by name prefix`);
  } finally {
    await apiContext.dispose();
  }
}

/**
 * Clean up a complete evaluation setup created by seedCompleteEvaluation.
 */
export async function cleanupCompleteEvaluation(ids: {
  evaluationId: string;
  scoringModelId: string;
  teamTypeId: string;
}): Promise<void> {
  // Delete in reverse order of dependencies
  await apiDeleteEvaluation(ids.evaluationId);
  await apiDeleteScoringModel(ids.scoringModelId);
  await apiDeleteTeamType(ids.teamTypeId);
}

/**
 * CITE-specific fixtures
 */
export type CiteFixtures = {
  citeAuthenticatedPage: Page;
};

/**
 * Path to the CITE storageState saved by global-setup.ts. May not exist if the
 * global setup failed to provision (stack down at startup) — handled below.
 */
const citeStatePath = authStatePath('cite');

/**
 * True when global-setup successfully wrote the CITE auth state this run.
 * Evaluated once at module load. Specs that want a clean unauthenticated context
 * still override this with `test.use({ storageState: { cookies: [], origins: [] } })`.
 */
const citeStateExists = fs.existsSync(citeStatePath);

/**
 * Extended test with CITE-specific fixtures.
 *
 * `storageState` defaults to the pre-authenticated state captured once by
 * global-setup.ts, so every spec's browser context starts with a valid OIDC token
 * in localStorage. The `citeAuthenticatedPage` fixture then just navigates and
 * waits for the Angular shell — no per-test Keycloak round-trip. Auth-flow specs
 * opt out with `test.use({ storageState: { cookies: [], origins: [] } })`.
 */
export const test = base.extend<CiteFixtures>({
  // Default the context to the saved auth state when it exists. When it doesn't
  // (provisioning failed), leave Playwright's default and rely on the fixture's
  // interactive-login fallback below.
  storageState: citeStateExists ? citeStatePath : undefined,

  citeAuthenticatedPage: async ({ page }, use) => {
    // Fast path: storageState already carries a valid token, so navigating home
    // should render the authenticated shell without redirecting to Keycloak.
    await page.goto(Services.Cite.UI, { waitUntil: 'domcontentloaded' });

    const appShell = page.locator('app-root mat-toolbar').first();
    const keycloakField = page.locator('input[name="username"]');

    // Race the authenticated shell against a Keycloak login form. The form appears
    // only if the saved state is missing/expired — in that case fall back to the
    // full interactive login so the test still proceeds (just not as fast).
    const winner = await Promise.race([
      appShell.waitFor({ state: 'visible', timeout: 20000 }).then(() => 'shell' as const),
      keycloakField.waitFor({ state: 'visible', timeout: 20000 }).then(() => 'keycloak' as const),
    ]).catch(() => 'timeout' as const);

    if (winner !== 'shell') {
      // Either Keycloak appeared or neither did within the window — do a full login.
      await authenticateCiteWithKeycloak(page);
      await appShell.waitFor({ state: 'visible', timeout: 30000 });
    }

    await use(page);
  },
});

export { expect } from '@playwright/test';
export { Services, serviceUrlPattern, oidcStorageKey };
