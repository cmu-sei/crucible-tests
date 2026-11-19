// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import fs from 'fs';
import path from 'path';
import { test as base, expect, Page, APIRequestContext } from '@playwright/test';
import {
  Services,
  serviceUrlPattern,
  oidcStorageKey,
  authenticateWithKeycloak,
  waitForFirstVisible,
  settleForResponse,
  ensureAuthenticatedShell,
} from '../shared-fixtures';
import { authStatePath } from '../auth-paths';
import { cachedUserToken, jwtSub, sharedRequestContext } from '../api-cache';
import { acquireAuthLock, freshAuthStatePath, releaseAuthLock } from '../auth-state';
import { getUserToken } from '../keycloak-admin';
import { poolUsers, PoolUser } from '../user-pool';

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
// Shared record names and the run-level seed file
// ========================================================================

/** The scoresheet-ready scoring model every suite reuses (`ensureScoringModelExists`). */
export const SHARED_SCORING_MODEL = 'E2E Shared Scoring Model';
/** The team type every suite reuses (`ensureTeamTypeExists`). */
export const SHARED_TEAM_TYPE = 'E2E Shared Team Type';
/** Run-level evaluation the read-only consumers open; never advanced, scored, edited or deleted by a test. */
export const SHARED_READ_ONLY_EVALUATION = 'E2E Shared Read-Only Evaluation';
/** A second run-level read-only evaluation, for list specs that need two rows to filter or sort. */
export const SHARED_BETA_EVALUATION = 'E2E Shared Beta Evaluation';

/** The one team `seedActiveEvaluation` puts on an evaluation (named as `seedCompleteEvaluation` names its team). */
export function sharedTeamName(evaluationDescription: string): string {
  return `Team for ${evaluationDescription}`;
}

/** Ids global-setup writes to `.auth/cite-seed.json` for the whole run. */
export type CiteSeedIds = {
  readOnlyEvaluationId: string;
  betaEvaluationId: string;
  sharedScoringModelId: string;
  sharedTeamTypeId: string;
  adminUserId: string;
};

/** `.auth/cite-seed.json` — gitignored with the rest of `.auth/`. */
export function citeSeedPath(): string {
  return path.resolve(__dirname, '..', '.auth', 'cite-seed.json');
}

function readCiteSeedFile(): CiteSeedIds | null {
  try {
    return JSON.parse(fs.readFileSync(citeSeedPath(), 'utf8')) as CiteSeedIds;
  } catch {
    return null;
  }
}

// ========================================================================
// API-based test data seeding and cleanup
// ========================================================================

/**
 * Get a Keycloak access token for the CITE API, cached per worker until near expiry.
 */
export async function getCiteApiToken(apiContext: APIRequestContext): Promise<string> {
  return cachedUserToken('crucible', 'cite.ui', 'admin', 'openid profile cite', () => fetchCiteApiToken(apiContext));
}

async function fetchCiteApiToken(apiContext: APIRequestContext): Promise<string> {
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
  const apiContext = await sharedRequestContext();
  {
    const token = await getCiteApiToken(apiContext);

    const response = await apiContext.post(`${Services.Cite.API}/api/scoringmodels`, {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      data: {
        description,
        // CITE serializes ItemStatus as a STRING enum
        // ('Pending'|'Active'|'Cancelled'|'Complete'|'Archived').
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
  description: string = SHARED_SCORING_MODEL
): Promise<string> {
  // The run-level seed (global-setup) already ensured the default model.
  const seeded = readCiteSeedFile();
  if (seeded && description === SHARED_SCORING_MODEL) return seeded.sharedScoringModelId;

  const apiContext = await sharedRequestContext();
  {
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
  description: string = `Test Evaluation ${Date.now()}`,
  /** Further evaluation fields, e.g. `{ galleryExhibitId }`. */
  extra: Record<string, unknown> = {},
): Promise<string> {
  const apiContext = await sharedRequestContext();
  {
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
        ...extra,
      },
    });

    if (!response.ok()) {
      throw new Error(`Failed to create evaluation: ${response.status()} ${await response.text()}`);
    }

    const evaluation = await response.json();
    console.log(`API seed: Created evaluation "${description}" (${evaluation.id})`);
    return evaluation.id;
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
  const apiContext = await sharedRequestContext();
  {
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
  }
}

/**
 * Seed a team type via the CITE API.
 * Returns the created team type ID.
 */
export async function seedTeamType(
  name: string = `Test Team Type ${Date.now()}`,
  options: { isOfficialScoreContributor?: boolean } = {}
): Promise<string> {
  const apiContext = await sharedRequestContext();
  {
    const token = await getCiteApiToken(apiContext);

    const response = await apiContext.post(`${Services.Cite.API}/api/teamtypes`, {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      data: {
        name,
        isOfficialScoreContributor: options.isOfficialScoreContributor ?? false,
      },
    });

    if (!response.ok()) {
      throw new Error(`Failed to create team type: ${response.status()} ${await response.text()}`);
    }

    const teamType = await response.json();
    console.log(`API seed: Created team type "${name}" (${teamType.id})`);
    return teamType.id;
  }
}

/**
 * Ensure at least one team type exists (used by suites that pick a team type from
 * a UI dropdown when adding a team). Returns an existing team type id or seeds one.
 */
export async function ensureTeamTypeExists(
  name: string = SHARED_TEAM_TYPE
): Promise<string> {
  const seeded = readCiteSeedFile();
  if (seeded && name === SHARED_TEAM_TYPE) return seeded.sharedTeamTypeId;
  const apiContext = await sharedRequestContext();
  {
    const token = await getCiteApiToken(apiContext);
    const listResponse = await apiContext.get(`${Services.Cite.API}/api/teamtypes`, {
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
    });
    if (listResponse.ok()) {
      // Match on the name rather than reusing whichever team type comes first: other
      // specs create and delete their own team types, and a team saved against one of
      // those after it is deleted fails with a 500.
      const teamTypes: Array<{ id: string; name: string }> = await listResponse.json();
      const existing = teamTypes.find(t => t.name === name);
      if (existing) {
        return existing.id;
      }
    }
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
  const apiContext = await sharedRequestContext();
  {
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
  const apiContext = await sharedRequestContext();
  {
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
  }
}

/**
 * The CITE user id of the `admin` account the API token belongs to: the token's `sub`.
 * Matching on display name is unreliable because the realm has several users whose
 * names contain "admin". The users request also confirms CITE has a record for it.
 */
export async function getCurrentUserId(): Promise<string> {
  const seeded = readCiteSeedFile();
  if (seeded) return seeded.adminUserId;
  const apiContext = await sharedRequestContext();
  {
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
    const sub = jwtSub(token);
    const adminUser = users.find(u => u.id === sub);

    if (!adminUser) {
      throw new Error(`The token's user (${sub}) is not in the CITE users list`);
    }

    return adminUser.id;
  }
}

/**
 * Delete a scoring model by ID via the CITE API.
 */
export async function apiDeleteScoringModel(scoringModelId: string): Promise<void> {
  const apiContext = await sharedRequestContext();
  {
    const token = await getCiteApiToken(apiContext);

    const response = await apiContext.delete(`${Services.Cite.API}/api/scoringmodels/${scoringModelId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (response.ok() || response.status() === 404) {
      console.log(`API cleanup: Deleted scoring model ${scoringModelId}`);
    } else {
      console.warn(`API cleanup: Failed to delete scoring model ${scoringModelId}: ${response.status()}`);
    }
  }
}

/**
 * Delete an evaluation by ID via the CITE API.
 */
export async function apiDeleteEvaluation(evaluationId: string): Promise<void> {
  const apiContext = await sharedRequestContext();
  {
    const token = await getCiteApiToken(apiContext);

    const response = await apiContext.delete(`${Services.Cite.API}/api/evaluations/${evaluationId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (response.ok() || response.status() === 404) {
      console.log(`API cleanup: Deleted evaluation ${evaluationId}`);
    } else {
      console.warn(`API cleanup: Failed to delete evaluation ${evaluationId}: ${response.status()}`);
    }
  }
}

/**
 * Delete a team type by ID via the CITE API.
 */
export async function apiDeleteTeamType(teamTypeId: string): Promise<void> {
  const apiContext = await sharedRequestContext();
  {
    const token = await getCiteApiToken(apiContext);

    const response = await apiContext.delete(`${Services.Cite.API}/api/teamtypes/${teamTypeId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (response.ok() || response.status() === 404) {
      console.log(`API cleanup: Deleted team type ${teamTypeId}`);
    } else {
      console.warn(`API cleanup: Failed to delete team type ${teamTypeId}: ${response.status()}`);
    }
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
  const apiContext = await sharedRequestContext();
  {
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
 * Make `moveNumber` the evaluation's current move through the API's set-current-move
 * call (`PUT /api/evaluations/{id}/move/{move}`), which also copies that move's
 * situation onto the evaluation — the same change the dashboard's Advance Move makes.
 */
export async function setEvaluationCurrentMove(evaluationId: string, moveNumber: number): Promise<void> {
  const apiContext = await sharedRequestContext();
  const token = await getCiteApiToken(apiContext);
  const response = await apiContext.put(`${Services.Cite.API}/api/evaluations/${evaluationId}/move/${moveNumber}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!response.ok()) {
    throw new Error(`Failed to set evaluation ${evaluationId} to move ${moveNumber}: ${response.status()} ${await response.text()}`);
  }
}

/** Ids of an evaluation `seedActiveEvaluation` created. */
export type SeededEvaluation = {
  evaluationId: string;
  /** The evaluation's one team, which Admin User is a member of. */
  teamId: string;
  /** Moves 1..n (move 0, "Default Move", is created by the API with the evaluation). */
  moveIds: string[];
};

/**
 * Seed an Active evaluation Admin User can open and score, entirely through the API:
 * on the shared scoresheet-ready scoring model (the API copies it onto the evaluation),
 * with moves 1..`moves` on top of the API's default move 0, and one team of the shared
 * team type (`sharedTeamName(description)` unless `teamName` is given) with Admin User on it. `currentMoveNumber`
 * optionally makes a later move current.
 *
 * This is what the report and scoresheet suites used to build through six admin
 * dialogs. Only the evaluation is the caller's to delete (`apiDeleteEvaluation`); the
 * scoring model and team type are the shared ensure-exists records.
 */
export async function seedActiveEvaluation(
  description: string,
  options: {
    moves?: number;
    currentMoveNumber?: number;
    /** Team name; defaults to `sharedTeamName(description)`. */
    teamName?: string;
    /** Links the evaluation to a Gallery exhibit. */
    galleryExhibitId?: string;
  } = {},
): Promise<SeededEvaluation> {
  const scoringModelId = await ensureScoringModelExists();
  const teamTypeId = await ensureTeamTypeExists();
  const userId = await getCurrentUserId();

  const evaluationId = await seedEvaluation(
    scoringModelId,
    description,
    options.galleryExhibitId ? { galleryExhibitId: options.galleryExhibitId } : {},
  );
  try {
    const moveIds: string[] = [];
    for (let i = 1; i <= (options.moves ?? 0); i++) {
      moveIds.push(await seedMove(evaluationId, i, `Move ${i}`));
    }
    const teamId = await seedTeam(evaluationId, teamTypeId, options.teamName ?? sharedTeamName(description));
    await seedTeamMembership(teamId, userId);
    if (options.currentMoveNumber) {
      await setEvaluationCurrentMove(evaluationId, options.currentMoveNumber);
    }
    return { evaluationId, teamId, moveIds };
  } catch (error) {
    await apiDeleteEvaluation(evaluationId);
    throw error;
  }
}

/**
 * Ensure an intact evaluation named `description` exists (see `seedActiveEvaluation`;
 * no moves beyond the default move 0) and return its id. An intact copy is Active, on
 * move 0 and has its team; among several, the lowest id is kept, so every caller
 * picks the same one.
 *
 * `repair` (global-setup only, which runs before any worker exists) also deletes every
 * other copy — duplicates and damaged ones a crashed earlier run left — so the run's
 * readers see a single row. Workers never pass it: a copy that looks damaged or
 * redundant to a worker may be one another process is still building or using.
 */
async function ensureSharedEvaluation(description: string, repair: boolean): Promise<string> {
  const apiContext = await sharedRequestContext();
  const token = await getCiteApiToken(apiContext);
  const headers = { Authorization: `Bearer ${token}`, Accept: 'application/json' };

  const listResponse = await apiContext.get(`${Services.Cite.API}/api/evaluations`, { headers });
  if (!listResponse.ok()) {
    throw new Error(`Failed to list evaluations: ${listResponse.status()} ${await listResponse.text()}`);
  }
  const matches = ((await listResponse.json()) as Array<{ id: string; description: string; status: string; currentMoveNumber: number }>)
    .filter(e => e.description === description)
    .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));

  let keep: string | null = null;
  for (const evaluation of matches) {
    let intact = false;
    if (!keep && evaluation.status === 'Active' && evaluation.currentMoveNumber === 0) {
      const teams = await apiContext.get(`${Services.Cite.API}/api/evaluations/${evaluation.id}/teams`, { headers });
      intact = teams.ok() && ((await teams.json()) as Array<{ name: string }>).some(t => t.name === sharedTeamName(description));
    }
    if (intact) keep = evaluation.id;
    else if (repair) await apiDeleteEvaluation(evaluation.id);
    if (keep && !repair) break;
  }
  return keep ?? (await seedActiveEvaluation(description)).evaluationId;
}

/** Ensure the run-level `E2E Shared Read-Only Evaluation` exists and return its id. */
export function ensureSharedReadOnlyEvaluation(): Promise<string> {
  return ensureSharedEvaluation(SHARED_READ_ONLY_EVALUATION, false);
}

/** Ensure the run-level `E2E Shared Beta Evaluation` exists and return its id. */
export function ensureSharedBetaEvaluation(): Promise<string> {
  return ensureSharedEvaluation(SHARED_BETA_EVALUATION, false);
}

/** `repair`: see `ensureSharedEvaluation` — true only from global-setup. */
async function buildCiteSeedIds(repair: boolean): Promise<CiteSeedIds> {
  const sharedScoringModelId = await ensureScoringModelExists();
  const sharedTeamTypeId = await ensureTeamTypeExists();
  const adminUserId = await getCurrentUserId();
  const readOnlyEvaluationId = await ensureSharedEvaluation(SHARED_READ_ONLY_EVALUATION, repair);
  const betaEvaluationId = await ensureSharedEvaluation(SHARED_BETA_EVALUATION, repair);
  return { readOnlyEvaluationId, betaEvaluationId, sharedScoringModelId, sharedTeamTypeId, adminUserId };
}

/** Write the seed file via `.tmp` + rename, so a concurrent reader never sees half of it. */
function writeCiteSeedFile(ids: CiteSeedIds): void {
  const file = citeSeedPath();
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tmp = `${file}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(ids, null, 2));
  fs.renameSync(tmp, file);
}

/**
 * Run-level seed, called once by global-setup when the run includes CITE: ensure the
 * shared scoring model, team type and two read-only evaluations, and write their ids
 * (plus Admin User's) to `.auth/cite-seed.json`.
 *
 * The old file is removed first, so the ensure helpers look the records up afresh
 * rather than trusting ids from a run whose teardown purged them; if seeding fails no
 * file is left and `loadCiteSeedIds` falls back to ensuring in the worker. Setup runs
 * in one process before any worker starts, so this is the one path that also deletes
 * duplicate and damaged copies of the shared evaluations.
 *
 * Lifetime: the records are named `E2E Shared ...`, so global-teardown's
 * `purgeAllCiteTestData` deletes them after the run (and the file with them); the next
 * run's setup re-ensures them by name. Teardown runs only after every worker has
 * finished, so no consumer can lose them mid-run.
 */
export async function writeCiteSeed(): Promise<CiteSeedIds> {
  fs.rmSync(citeSeedPath(), { force: true });
  const ids = await buildCiteSeedIds(true);
  writeCiteSeedFile(ids);
  return ids;
}

let workerSeedIds: Promise<CiteSeedIds> | null = null;

/**
 * Worker fallback for a missing seed file, serialised across workers by the
 * `.auth/cite-seed.lock` file lock: the first worker in ensures the records (by fixed
 * name, never deleting anything) and writes the file; every worker that was waiting
 * re-reads the file after taking the lock and uses those ids instead of building.
 */
async function buildCiteSeedIdsInWorker(): Promise<CiteSeedIds> {
  const lock = await acquireAuthLock('cite-seed');
  try {
    const written = readCiteSeedFile();
    if (written) return written;
    const ids = await buildCiteSeedIds(false);
    writeCiteSeedFile(ids);
    return ids;
  } finally {
    releaseAuthLock(lock);
  }
}

/**
 * The run-level shared ids from `.auth/cite-seed.json`. When global-setup could not
 * write it (CITE was down at setup), one worker ensures the records under a lock and
 * writes the file for the rest (`buildCiteSeedIdsInWorker`).
 */
export async function loadCiteSeedIds(): Promise<CiteSeedIds> {
  const fromFile = readCiteSeedFile();
  if (fromFile) return fromFile;
  workerSeedIds ??= buildCiteSeedIdsInWorker().catch(error => {
    workerSeedIds = null; // Let the next test retry rather than reuse a rejection.
    throw error;
  });
  return workerSeedIds;
}

/**
 * Delete every record at `listPath` whose `nameKey` equals `name` — the API
 * counterpart of the admin UI's delete-by-name helpers, for cleanup that is not
 * the subject of the test. Returns how many were deleted.
 */
async function apiDeleteByName(listPath: string, nameKey: 'description' | 'name', name: string): Promise<number> {
  const apiContext = await sharedRequestContext();
  const token = await getCiteApiToken(apiContext);
  const listResponse = await apiContext.get(`${Services.Cite.API}${listPath}`, {
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
  });
  if (!listResponse.ok()) {
    console.warn(`API cleanup: Failed to list ${listPath}: ${listResponse.status()}`);
    return 0;
  }
  let deleted = 0;
  for (const item of (await listResponse.json()) as Array<Record<string, string>>) {
    if (item[nameKey] !== name) continue;
    const response = await apiContext.delete(`${Services.Cite.API}${listPath}/${item.id}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (response.ok() || response.status() === 404) deleted++;
    else console.warn(`API cleanup: Failed to delete ${listPath}/${item.id} ("${name}"): ${response.status()}`);
  }
  return deleted;
}

/** Delete every evaluation whose description is exactly `description`. */
export function apiDeleteEvaluationsByName(description: string): Promise<number> {
  return apiDeleteByName('/api/evaluations', 'description', description);
}

/** Delete every scoring model whose description is exactly `description`. */
export function apiDeleteScoringModelsByName(description: string): Promise<number> {
  return apiDeleteByName('/api/scoringmodels', 'description', description);
}

/** Delete every team type named exactly `name`. */
export function apiDeleteTeamTypesByName(name: string): Promise<number> {
  return apiDeleteByName('/api/teamtypes', 'name', name);
}

/** Delete every group named exactly `name`. */
export function apiDeleteGroupsByName(name: string): Promise<number> {
  return apiDeleteByName('/api/groups', 'name', name);
}

/** A pool user put on one team by `seedTeamMemberUser`. */
export type TeamMemberUser = PoolUser & {
  /** The CITE team membership `seedTeamMemberUser` created — what `cleanupTeamMemberUser` deletes. */
  membershipId: string;
};

/**
 * Register `user` with CITE: CITE creates its own user row the first time a token is
 * presented. Idempotent.
 */
async function provisionCiteUser(user: PoolUser): Promise<void> {
  const userToken = await getUserToken(user.username, user.password, 'cite.ui', 'openid profile cite');
  const apiContext = await sharedRequestContext();
  const provision = await apiContext.get(`${Services.Cite.API}/api/my-evaluations`, {
    headers: { Authorization: `Bearer ${userToken}` },
  });
  if (!provision.ok()) {
    throw new Error(`Failed to provision CITE user ${user.username}: ${provision.status()} ${await provision.text()}`);
  }
}

/** Delete a user's CITE row. Tolerates 404. */
async function deleteCiteUser(user: PoolUser): Promise<void> {
  const apiContext = await sharedRequestContext();
  const token = await getCiteApiToken(apiContext);
  const response = await apiContext.delete(`${Services.Cite.API}/api/users/${user.userId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!response.ok() && response.status() !== 404) {
    console.warn(`API cleanup: Failed to delete CITE user ${user.username}: ${response.status()}`);
  }
}

/**
 * Put a pool user (no CITE system permissions — see `nonAdminUser`) on `teamId` with the
 * default Member role.
 *
 * For specs about what a team member sees: `admin` holds every system permission, so it
 * reads every move and every official score, and it can never show what a team limits.
 * Pair every call with `cleanupTeamMemberUser` in `afterEach`.
 */
export async function seedTeamMemberUser(teamId: string, user: PoolUser): Promise<TeamMemberUser> {
  const membershipId = await seedTeamMembership(teamId, user.userId);
  return { ...user, membershipId };
}

/**
 * The CITE reset for a pool user: delete the team membership `seedTeamMemberUser`
 * created. Tolerates 404 — deleting the evaluation first removes its teams' memberships.
 */
export async function cleanupTeamMemberUser(member: TeamMemberUser): Promise<void> {
  const apiContext = await sharedRequestContext();
  const token = await getCiteApiToken(apiContext);
  const response = await apiContext.delete(`${Services.Cite.API}/api/teams/memberships/${member.membershipId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!response.ok() && response.status() !== 404) {
    console.warn(`API cleanup: Failed to delete team membership ${member.membershipId}: ${response.status()}`);
  }
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
  const apiContext = await sharedRequestContext();
  {
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
  const apiContext = await sharedRequestContext();
  {
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
    // The purge took the run-level shared records with it; the next run's global-setup
    // writes a fresh seed file.
    fs.rmSync(citeSeedPath(), { force: true });
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

export type CiteWorkerFixtures = {
  /**
   * This worker's two pool users (see `user-pool.ts`): no realm roles, so no CITE system
   * permissions, and registered with CITE.
   */
  nonAdminUsers: PoolUser[];
  /** The first of `nonAdminUsers`. */
  nonAdminUser: PoolUser;
};

/**
 * Extended test with CITE-specific fixtures.
 *
 * `storageState` defaults to the pre-authenticated state captured once by
 * global-setup.ts (refreshed by `freshAuthStatePath` when its token is near expiry),
 * so every spec's browser context starts with a valid OIDC token. The
 * `citeAuthenticatedPage` fixture then just navigates and waits for the Angular
 * shell — no per-test Keycloak round-trip. Auth-flow specs opt out with
 * `test.use({ storageState: { cookies: [], origins: [] } })`.
 */
export const test = base.extend<CiteFixtures, CiteWorkerFixtures>({
  // Reset contract for CITE: a test deletes the team memberships it gave a pool user
  // (`cleanupTeamMemberUser`) and the evaluations it seeded; the user's CITE row is
  // created here and deleted when the worker ends. Leased by `parallelIndex`, the stable
  // worker slot.
  nonAdminUsers: [
    async ({}, use, workerInfo) => {
      const users = poolUsers(workerInfo.parallelIndex, 2);
      for (const user of users) await provisionCiteUser(user);
      await use(users);
      for (const user of users) await deleteCiteUser(user);
    },
    { scope: 'worker' },
  ],
  nonAdminUser: [async ({ nonAdminUsers }, use) => use(nonAdminUsers[0]), { scope: 'worker' }],

  // `undefined` when global-setup could not provision CITE; the shell check below
  // then falls back to an interactive login.
  storageState: async ({ browser }, use) => use(await freshAuthStatePath('cite', browser)),

  citeAuthenticatedPage: async ({ page, storageState }, use) => {
    await ensureAuthenticatedShell(page, {
      app: 'cite',
      url: Services.Cite.UI,
      shell: page.locator('app-root mat-toolbar').first(),
      login: authenticateCiteWithKeycloak,
      fromSavedState: storageState === authStatePath('cite'),
    });

    await use(page);
  },
});

/**
 * Themes every CITE spec is parameterized over. Each spec runs once per entry
 * so every screen is exercised in both light and dark mode.
 */
export const CITE_THEMES = ['light', 'dark'] as const;
export type CiteTheme = (typeof CITE_THEMES)[number];

/** Whether CITE is currently rendering the dark theme. */
export async function citeIsDarkTheme(page: Page): Promise<boolean> {
  return page.evaluate(() => document.body.classList.contains('darkMode'));
}

/**
 * `url` with CITE's `theme` query param set, for a spec's first navigation.
 *
 * `AppComponent` reads the param on bootstrap and saves it as the user's theme, so
 * the app renders in `theme` from its first paint. Use it where the user-menu
 * switch can't be reached right after load: a spec that needs the theme in place
 * before something else covers the page (a system-message bottom sheet's backdrop
 * blocks the top bar), and the unauthenticated specs, which request the theme on
 * their entry URL and apply it with `setCiteTheme` once a login lands in CITE.
 */
export function citeThemeUrl(url: string, theme: CiteTheme): string {
  const themed = new URL(url);
  // The param takes the Theme enum value; any other value (e.g. 'dark') reads as light.
  themed.searchParams.set('theme', `${theme}-theme`);
  return themed.toString();
}

/**
 * Put CITE in `theme` through its persisted preference, without the user menu.
 *
 * CITE keeps the selected theme in localStorage `uiState.selectedTheme`
 * (`'light-theme'`/`'dark-theme'`, `UIDataService.setTheme`), and the top bar applies it
 * when it initializes (`TopbarComponent` constructor, cite.ui at the time of writing).
 * So this writes that key on the CITE origin and reloads the current URL, then waits
 * for the app shell and for `document.body` to carry the theme. The preference lives in
 * the browser context's localStorage, so it survives the test's later reloads and
 * navigations; the saved auth state carries no `uiState`, so every test starts light.
 *
 * Writing the preference rather than the `?theme=` query param (`citeThemeUrl`) keeps the
 * URL the test asserts on unchanged: `AppComponent` keeps a param theme in the URL and
 * rewrites it on every later theme change.
 *
 * No-ops when the requested theme is already active, so callers can use it to restore
 * state unconditionally. Specs whose subject is the theme switch itself use
 * `toggleCiteThemeViaMenu`.
 */
export async function setCiteTheme(page: Page, theme: CiteTheme): Promise<void> {
  const want = theme === 'dark';
  if ((await citeIsDarkTheme(page)) === want) return;

  await page.evaluate((selectedTheme) => {
    const state = JSON.parse(window.localStorage.getItem('uiState') ?? '{}');
    state.selectedTheme = selectedTheme;
    window.localStorage.setItem('uiState', JSON.stringify(state));
  }, `${theme}-theme`);
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.locator('app-root mat-toolbar').first().waitFor({ state: 'visible', timeout: 15000 });
  await expect.poll(() => citeIsDarkTheme(page), { timeout: 10000 }).toBe(want);
}

/**
 * Switch CITE to `theme` through the user menu's Dark Theme switch, and wait for the
 * change to land on `document.body`. For specs whose subject is the switch itself; the
 * others use `setCiteTheme`. No-ops when the requested theme is already active.
 */
export async function toggleCiteThemeViaMenu(page: Page, theme: CiteTheme): Promise<void> {
  const want = theme === 'dark';
  if ((await citeIsDarkTheme(page)) === want) return;

  // The user menu is the top bar's name button (its label is the current user's name).
  await page.locator('.options-text button.menu-trigger').click();
  const toggle = page.getByRole('switch', { name: 'Dark Theme' });
  await toggle.waitFor({ state: 'visible', timeout: 10000 });
  await toggle.click();
  // Close the menu, and wait for its overlay to tear down so a lingering CDK
  // backdrop can't silently intercept the test's next click.
  await page.keyboard.press('Escape');
  await page.locator('.mat-mdc-menu-panel').waitFor({ state: 'detached', timeout: 5000 });
  await page.locator('.cdk-overlay-backdrop').waitFor({ state: 'detached', timeout: 5000 });

  await expect.poll(() => citeIsDarkTheme(page), { timeout: 10000 }).toBe(want);
}

/**
 * The evaluation toolbar's move counter, e.g. "Move 1 of 3" (displayed move of the
 * highest move number). Assert on it with `toHaveText('Move 1 of 3')`.
 */
export function citeMoveLabel(page: Page) {
  return page.getByText(/^Move \d+ of \d+$/);
}

export { expect } from '@playwright/test';
export { Services, serviceUrlPattern, oidcStorageKey, waitForFirstVisible, settleForResponse };
