// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

/**
 * Blueprint API helpers for tests.
 *
 * Provides reusable functions to create/delete MSELs, scenario events, teams, and
 * organizations via the Blueprint REST API during tests. Tests that need a
 * precondition MSEL or scenario event create it with these helpers, exercise the
 * scenario, then delete it in teardown.
 *
 * These helpers are Blueprint-specific and live in the blueprint/ directory.
 *
 * Token acquisition: Blueprint uses the `blueprint.ui` public OIDC client. The
 * global-setup.ts pre-authenticated session captures a valid access_token in
 * `.auth/blueprint-session.json`. We extract and reuse that token rather than
 * performing a fresh password grant on every call, since Blueprint's client config
 * rejects the password grant (public/PKCE client).
 */

import { APIRequestContext, Page, request as playwrightRequest, expect } from '@playwright/test';
import { Services, waitForFirstVisible } from '../shared-fixtures';
import fs from 'fs';
import { authSessionStatePath } from '../auth-paths';

// ============================================================================
// Token acquisition
// ============================================================================

let _cachedToken: string | null = null;

/**
 * Acquire a Blueprint-scoped bearer token.
 *
 * The `blueprint.ui` public client rejects password grants, so we extract the
 * access_token from the pre-authenticated sessionStorage captured by global-setup.ts.
 * If the session file is missing or the token is expired, this throws — tests must
 * run after global-setup has provisioned the auth state.
 */
export async function getBlueprintToken(): Promise<string> {
  if (_cachedToken) return _cachedToken;

  const sessionPath = authSessionStatePath('blueprint');
  if (!fs.existsSync(sessionPath)) {
    throw new Error(
      `Blueprint sessionStorage auth state not found at ${sessionPath}. ` +
      `Run global-setup.ts first to provision authentication.`
    );
  }

  const sessionData: Array<[string, string]> = JSON.parse(fs.readFileSync(sessionPath, 'utf8'));
  const oidcEntry = sessionData.find(([key]) => key.includes('oidc.user:'));
  if (!oidcEntry) {
    throw new Error(`No oidc.user entry in ${sessionPath}`);
  }

  const payload = JSON.parse(oidcEntry[1]);
  const token = payload.access_token as string;
  if (!token) {
    throw new Error(`No access_token in sessionStorage OIDC payload`);
  }

  _cachedToken = token;
  return token;
}

/**
 * Helper to create a Playwright API context with ignoreHTTPSErrors set.
 */
async function newContext(): Promise<APIRequestContext> {
  return playwrightRequest.newContext({ ignoreHTTPSErrors: true });
}

// ============================================================================
// Low-level API call wrapper
// ============================================================================

interface ApiOpts {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  body?: any;
  query?: Record<string, string | number | boolean | undefined>;
}

async function blueprintCall<T = any>(
  token: string,
  path: string,
  opts: ApiOpts = {}
): Promise<{ ok: boolean; status: number; data: T; text: string }> {
  const base = Services.Blueprint.API.replace(/\/$/, '');
  const url = new URL(`${base}${path}`);
  if (opts.query) {
    for (const [k, v] of Object.entries(opts.query)) {
      if (v !== undefined) url.searchParams.append(k, String(v));
    }
  }
  const ctx = await newContext();
  try {
    const res = await ctx.fetch(url.toString(), {
      method: opts.method ?? 'GET',
      headers: { Authorization: `Bearer ${token}` },
      data: opts.body,
    });
    const text = await res.text();
    let data: any;
    try { data = text ? JSON.parse(text) : undefined; } catch { /* non-JSON */ }
    return { ok: res.ok(), status: res.status(), data, text };
  } finally {
    await ctx.dispose();
  }
}

// ============================================================================
// Unique name generator
// ============================================================================

/**
 * Generate a unique name for Blueprint test data.
 * Format: `<prefix>-<timestamp>-<random>`.
 *
 * All test-seeded names use the "TestBP-" prefix so global-teardown can find
 * leftovers by prefix and purge them (safety net).
 */
export function tempBlueprintName(prefix: string = 'TestBP'): string {
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 1_000_000)}`;
}

// ============================================================================
// MSEL lifecycle
// ============================================================================

export interface CreatedMsel {
  id: string;
  name: string;
  description: string;
  status: string;
}

export interface CreateMselOptions {
  name?: string;
  description?: string;
  isTemplate?: boolean;
  status?: string;
}

/**
 * Create a MSEL via the Blueprint API. Returns the MSEL id and name —
 * pair every call with `deleteMsel` in test teardown.
 *
 * The POST /api/msels endpoint returns the full MSEL object including nested
 * collections, but the GET /api/msels list endpoint returns a simpler shape.
 * The `name` field is present in both, so `ensureMsel` can match on it.
 */
export async function createMsel(
  token: string,
  opts: CreateMselOptions = {}
): Promise<CreatedMsel> {
  const name = opts.name ?? tempBlueprintName('TestBP-MSEL');
  const description = opts.description ?? `Automated test MSEL; deleted on teardown.`;

  const createBody = {
    name,
    description,
    isTemplate: opts.isTemplate ?? false,
    status: opts.status ?? 'Pending',
    // Blueprint requires these integration flags; default all false:
    usePlayer: false,
    useGallery: false,
    useCite: false,
    useSteamfitter: false,
    // StartTime defaults to now if not specified:
    startTime: new Date().toISOString(),
    durationSeconds: 3600,
  };

  const r = await blueprintCall<any>(token, '/api/msels', {
    method: 'POST',
    body: createBody,
  });
  if (!r.ok) {
    throw new Error(`createMsel failed (${r.status}): ${r.text}`);
  }

  return {
    id: r.data.id as string,
    name: r.data.name as string,
    description: r.data.description as string,
    status: r.data.status as string,
  };
}

/**
 * Delete a MSEL by id. Safe to call on a non-existent id — swallows 404 so
 * teardown blocks don't fail a passing test.
 */
export async function deleteMsel(token: string, mselId: string): Promise<void> {
  const r = await blueprintCall(token, `/api/msels/${mselId}`, { method: 'DELETE' });
  if (!r.ok && r.status !== 404) {
    console.warn(`deleteMsel(${mselId}) returned ${r.status}: ${r.text}`);
  }
}

/**
 * Fetch a single MSEL by id. Use this to assert that a UI action really persisted
 * server-side rather than only updating local component state.
 *
 * Returns the raw object, so fields the typed `CreatedMsel` shape omits (`isTemplate`,
 * `usePlayer`, `useGallery`, ...) are available to callers.
 */
export async function getMsel(token: string, mselId: string): Promise<any> {
  const r = await blueprintCall<any>(token, `/api/msels/${mselId}`);
  if (!r.ok) {
    throw new Error(`getMsel(${mselId}) failed (${r.status}): ${r.text}`);
  }
  return r.data;
}

/**
 * Update a MSEL. `PUT /api/msels/{id}` replaces the whole object, so this does a
 * GET-then-PUT merge: passing a partial body directly drops every field you omit.
 *
 * Note `status` must be a member of `MselItemStatus` — Pending, Entered, Approved,
 * Complete, Pushing, Pulling, Deployed, Archived. Anything else (e.g. "Active") is
 * rejected with a 400 JSON-conversion error, which is correct API behaviour, not a bug.
 */
export async function updateMsel(
  token: string,
  mselId: string,
  changes: Record<string, unknown>
): Promise<any> {
  const current = await getMsel(token, mselId);
  const r = await blueprintCall<any>(token, `/api/msels/${mselId}`, {
    method: 'PUT',
    body: { ...current, ...changes },
  });
  if (!r.ok) {
    throw new Error(`updateMsel(${mselId}) failed (${r.status}): ${r.text}`);
  }
  return r.data;
}

/**
 * Idempotent MSEL seeder: returns an existing MSEL with the given name, or
 * creates a new one if none exists.
 *
 * The GET /api/msels list endpoint returns an array of MSEL objects that include
 * the `name` field, so we can match on it. Reusing by name prevents leaking a
 * new MSEL every time the helper is called.
 */
export async function ensureMsel(
  token: string,
  name: string,
  opts: CreateMselOptions = {}
): Promise<CreatedMsel> {
  // List all MSELs and search for one with matching name
  const listRes = await blueprintCall<any[]>(token, '/api/msels');
  if (!listRes.ok) {
    throw new Error(`ensureMsel list failed (${listRes.status}): ${listRes.text}`);
  }

  const existing = listRes.data?.find((m: any) => m.name === name);
  if (existing) {
    return {
      id: existing.id as string,
      name: existing.name as string,
      description: existing.description as string,
      status: existing.status as string,
    };
  }

  // Not found — create it
  return createMsel(token, { ...opts, name });
}

// ============================================================================
// Scenario event lifecycle
// ============================================================================

export interface CreatedScenarioEvent {
  id: string;
  mselId: string;
}

export interface CreateScenarioEventOptions {
  /** Delta seconds from MSEL start time. Default 0. */
  deltaSeconds?: number;
  /** Move number. Default 0. */
  moveNumber?: number;
  /** Group order. Default 0. */
  groupOrder?: number;
  /** Row metadata (control number). Default empty. */
  rowMetadata?: string;
  /** Description. Default generated. */
  description?: string;
}

/**
 * Create a scenario event on the specified MSEL via the Blueprint API.
 * Returns the event id — pair every call with `deleteScenarioEvent` in test teardown.
 *
 * The POST /api/scenarioEvents endpoint returns an array of scenario events (it can
 * create multiple), so we take the first one from the response.
 */
export async function createScenarioEvent(
  token: string,
  mselId: string,
  opts: CreateScenarioEventOptions = {}
): Promise<CreatedScenarioEvent> {
  const description = opts.description ?? `Test scenario event created by automation`;

  const createBody = {
    mselId,
    deltaSeconds: opts.deltaSeconds ?? 0,
    moveNumber: opts.moveNumber ?? 0,
    groupOrder: opts.groupOrder ?? 0,
    rowMetadata: opts.rowMetadata ?? '',
    description,
    // DataValues can be added later if needed; for basic seeding we leave it empty.
    dataValues: [],
  };

  const r = await blueprintCall<any[]>(token, '/api/scenarioEvents', {
    method: 'POST',
    body: createBody,
  });
  if (!r.ok) {
    throw new Error(`createScenarioEvent failed (${r.status}): ${r.text}`);
  }

  // POST returns an array; take the first event
  const created = r.data?.[0];
  if (!created || !created.id) {
    throw new Error(`createScenarioEvent did not return an id: ${r.text}`);
  }

  return {
    id: created.id as string,
    mselId: created.mselId as string,
  };
}

/**
 * Delete a scenario event by id. Safe to call on a non-existent id — swallows 404.
 */
export async function deleteScenarioEvent(token: string, eventId: string): Promise<void> {
  const r = await blueprintCall(token, `/api/scenarioEvents/${eventId}`, { method: 'DELETE' });
  if (!r.ok && r.status !== 404) {
    console.warn(`deleteScenarioEvent(${eventId}) returned ${r.status}: ${r.text}`);
  }
}

/**
 * List all scenario events for a given MSEL.
 */
export async function listScenarioEvents(
  token: string,
  mselId: string
): Promise<any[]> {
  const r = await blueprintCall<any[]>(token, `/api/msels/${mselId}/scenarioEvents`);
  if (!r.ok) {
    throw new Error(`listScenarioEvents failed (${r.status}): ${r.text}`);
  }
  return r.data ?? [];
}

// ============================================================================
// Data fields and data values (what makes scenario events actually render)
// ============================================================================
//
// A ScenarioEvent has **no `description` / `title` column of its own.** Its visible text
// lives in `DataValue` rows, each keyed to one of the MSEL's `DataField`s. Verified against
// the API: a scenario event's payload is
// `{ id, mselId, dataValues, groupOrder, isHidden, rowMetadata, deltaSeconds,
//    scenarioEventType, injectId, integrationTarget, information, steamfitterTaskId, ... }`
// — no description anywhere. So a `description` passed to `createScenarioEvent` is silently
// dropped, and the row renders blank in the Scenario Events grid.
//
// Two things are therefore needed before a seeded event is visible in the UI:
//   1. The MSEL must have DataFields. A MSEL created via `POST /api/msels` has **zero** —
//      the API only copies DataFields when *cloning* an existing MSEL, and
//      `GET /api/dataFields/templates` is empty on this stack. Use `seedMselDataFields`.
//   2. The event's text must be written into the DataValue for the field you assert on.
//      `POST /api/scenarioEvents` auto-creates one empty DataValue per DataField (13 with
//      the standard set), so this is a PUT of an existing row, not a POST.
//
// `createRenderableScenarioEvent` does both and is what scenario-event UI specs should use.

/** The MSEL whose DataField set is copied by `seedMselDataFields`. */
const STANDARD_MSEL_NAME = 'Standard MSEL';

/**
 * Give a MSEL a usable DataField set by copying it from the "Standard MSEL" template
 * (13 fields: Description, Move, Group, Status, Assigned To, From Org, Details, ...).
 *
 * Idempotent: returns immediately if the MSEL already has fields. Note `POST /api/dataFields`
 * answers **200**, not 201.
 *
 * @returns the MSEL's DataFields after seeding.
 */
export async function seedMselDataFields(token: string, mselId: string): Promise<any[]> {
  const existing = await listMselDataFields(token, mselId);
  if (existing.length > 0) return existing;

  const listRes = await blueprintCall<any[]>(token, '/api/msels');
  if (!listRes.ok) {
    throw new Error(`seedMselDataFields: MSEL list failed (${listRes.status}): ${listRes.text}`);
  }
  const standard = listRes.data?.find((m: any) => m.name === STANDARD_MSEL_NAME);
  if (!standard) {
    throw new Error(
      `seedMselDataFields: no "${STANDARD_MSEL_NAME}" MSEL to copy DataFields from. ` +
        `Seed one, or pass explicit fields.`
    );
  }

  const sourceFields = await listMselDataFields(token, standard.id);
  for (const field of sourceFields) {
    const body: Record<string, unknown> = { ...field, mselId, dataOptions: [] };
    delete body.id;
    const r = await blueprintCall(token, '/api/dataFields', { method: 'POST', body });
    if (!r.ok) {
      throw new Error(`seedMselDataFields: POST dataFields failed (${r.status}): ${r.text}`);
    }
  }

  return listMselDataFields(token, mselId);
}

/** List a MSEL's DataFields. */
export async function listMselDataFields(token: string, mselId: string): Promise<any[]> {
  const r = await blueprintCall<any[]>(token, `/api/msels/${mselId}/dataFields`);
  if (!r.ok) {
    throw new Error(`listMselDataFields failed (${r.status}): ${r.text}`);
  }
  return r.data ?? [];
}

/** Fetch a single scenario event, including its `dataValues`. */
export async function getScenarioEvent(token: string, eventId: string): Promise<any> {
  const r = await blueprintCall<any>(token, `/api/scenarioEvents/${eventId}`);
  if (!r.ok) {
    throw new Error(`getScenarioEvent(${eventId}) failed (${r.status}): ${r.text}`);
  }
  return r.data;
}

/**
 * Set the value of one of a scenario event's DataValues, selected by DataField **name**
 * (e.g. 'Description', 'Move', 'Status').
 *
 * This is a PUT: `POST /api/scenarioEvents` already created an empty DataValue per
 * DataField, so there is nothing to create.
 */
export async function setScenarioEventFieldValue(
  token: string,
  eventId: string,
  fieldName: string,
  value: string
): Promise<void> {
  const event = await getScenarioEvent(token, eventId);
  const fields = await listMselDataFields(token, event.mselId);

  const field = fields.find((f: any) => f.name === fieldName);
  if (!field) {
    throw new Error(
      `setScenarioEventFieldValue: MSEL ${event.mselId} has no DataField named "${fieldName}". ` +
        `Available: ${fields.map((f: any) => f.name).join(', ') || '(none — call seedMselDataFields first)'}`
    );
  }

  const dataValue = (event.dataValues ?? []).find((dv: any) => dv.dataFieldId === field.id);
  if (!dataValue) {
    throw new Error(
      `setScenarioEventFieldValue: event ${eventId} has no DataValue for field "${fieldName}"`
    );
  }

  const r = await blueprintCall(token, `/api/dataValues/${dataValue.id}`, {
    method: 'PUT',
    body: { ...dataValue, value },
  });
  if (!r.ok) {
    throw new Error(`setScenarioEventFieldValue PUT failed (${r.status}): ${r.text}`);
  }
}

/**
 * Seed a scenario event that is actually **visible** in the Scenario Events grid: ensures
 * the MSEL has DataFields, creates the event, then writes `text` into the named DataField
 * (default 'Description') so there is something to locate the row by.
 *
 * Prefer this over bare `createScenarioEvent` in any spec that asserts on the UI.
 */
export async function createRenderableScenarioEvent(
  token: string,
  mselId: string,
  text: string,
  opts: CreateScenarioEventOptions & { fieldName?: string } = {}
): Promise<CreatedScenarioEvent> {
  await seedMselDataFields(token, mselId);
  const event = await createScenarioEvent(token, mselId, opts);
  await setScenarioEventFieldValue(token, event.id, opts.fieldName ?? 'Description', text);
  return event;
}

// ============================================================================
// Team lifecycle
// ============================================================================

export interface CreatedTeam {
  id: string;
  name: string;
  shortName: string;
  mselId: string;
}

export interface CreateTeamOptions {
  name?: string;
  shortName?: string;
}

/**
 * Create a team on the specified MSEL via the Blueprint API.
 * Returns the team id — pair every call with `deleteTeam` in test teardown.
 */
export async function createTeam(
  token: string,
  mselId: string,
  opts: CreateTeamOptions = {}
): Promise<CreatedTeam> {
  const name = opts.name ?? tempBlueprintName('TestBP-Team');
  const shortName = opts.shortName ?? 'TBP';

  const createBody = {
    mselId,
    name,
    shortName,
  };

  const r = await blueprintCall<any>(token, '/api/teams', {
    method: 'POST',
    body: createBody,
  });
  if (!r.ok) {
    throw new Error(`createTeam failed (${r.status}): ${r.text}`);
  }

  return {
    id: r.data.id as string,
    name: r.data.name as string,
    shortName: r.data.shortName as string,
    mselId: r.data.mselId as string,
  };
}

/**
 * Delete a team by id. Safe to call on a non-existent id — swallows 404.
 */
export async function deleteTeam(token: string, teamId: string): Promise<void> {
  const r = await blueprintCall(token, `/api/teams/${teamId}`, { method: 'DELETE' });
  if (!r.ok && r.status !== 404) {
    console.warn(`deleteTeam(${teamId}) returned ${r.status}: ${r.text}`);
  }
}

/**
 * List all teams for a given MSEL.
 */
export async function listTeams(
  token: string,
  mselId: string
): Promise<any[]> {
  const r = await blueprintCall<any[]>(token, `/api/msels/${mselId}/teams`);
  if (!r.ok) {
    throw new Error(`listTeams failed (${r.status}): ${r.text}`);
  }
  return r.data ?? [];
}

// ============================================================================
// Organization lifecycle
// ============================================================================

export interface CreatedOrganization {
  id: string;
  name: string;
  shortName: string;
  mselId: string;
}

export interface CreateOrganizationOptions {
  name?: string;
  shortName?: string;
  description?: string;
}

/**
 * Create an organization on the specified MSEL via the Blueprint API.
 * Returns the organization id — pair every call with `deleteOrganization` in test teardown.
 */
export async function createOrganization(
  token: string,
  mselId: string,
  opts: CreateOrganizationOptions = {}
): Promise<CreatedOrganization> {
  const name = opts.name ?? tempBlueprintName('TestBP-Org');
  const shortName = opts.shortName ?? 'TBO';

  const createBody = {
    mselId,
    name,
    shortName,
    description: opts.description ?? 'Test organization created by automation',
  };

  const r = await blueprintCall<any>(token, '/api/organizations', {
    method: 'POST',
    body: createBody,
  });
  if (!r.ok) {
    throw new Error(`createOrganization failed (${r.status}): ${r.text}`);
  }

  return {
    id: r.data.id as string,
    name: r.data.name as string,
    shortName: r.data.shortName as string,
    mselId: r.data.mselId as string,
  };
}

/**
 * Delete an organization by id. Safe to call on a non-existent id — swallows 404.
 */
export async function deleteOrganization(token: string, orgId: string): Promise<void> {
  const r = await blueprintCall(token, `/api/organizations/${orgId}`, { method: 'DELETE' });
  if (!r.ok && r.status !== 404) {
    console.warn(`deleteOrganization(${orgId}) returned ${r.status}: ${r.text}`);
  }
}

/**
 * List all organizations for a given MSEL.
 */
export async function listOrganizations(
  token: string,
  mselId: string
): Promise<any[]> {
  const r = await blueprintCall<any[]>(token, `/api/msels/${mselId}/organizations`);
  if (!r.ok) {
    throw new Error(`listOrganizations failed (${r.status}): ${r.text}`);
  }
  return r.data ?? [];
}

// ============================================================================
// Units and MSEL-units (the "Contributors" section)
// ============================================================================
//
// Units are GLOBAL entities, not MSEL-scoped: `POST /api/units` creates one that is
// visible to every MSEL. A unit is attached to a MSEL through the `MselUnit` join
// entity, and the Contributors section of a MSEL lists its attached units.
//
// Because units are global, a leaked unit pollutes every MSEL's contributor picker for
// the life of the database — always delete both the MselUnit and the Unit in teardown.
// (`GET /api/units` on the current dev stack already shows a stray
// "Create Catalog Test Unit" left behind by an earlier run.)

/**
 * Create a global unit. Name is not enforced-unique by the API, so use
 * `tempBlueprintName()` to keep runs from colliding.
 */
export async function createUnit(
  token: string,
  options: { name?: string; shortName?: string } = {}
): Promise<{ id: string; name: string; shortName: string }> {
  const name = options.name ?? tempBlueprintName('TestBP-Unit');
  const shortName = options.shortName ?? name.slice(-8);

  const r = await blueprintCall<any>(token, '/api/units', {
    method: 'POST',
    body: { name, shortName },
  });
  if (!r.ok) {
    throw new Error(`createUnit failed (${r.status}): ${r.text}`);
  }

  return {
    id: r.data.id as string,
    name: r.data.name as string,
    shortName: r.data.shortName as string,
  };
}

/**
 * Delete a global unit by id. Safe to call on a non-existent id — swallows 404.
 */
export async function deleteUnit(token: string, unitId: string): Promise<void> {
  const r = await blueprintCall(token, `/api/units/${unitId}`, { method: 'DELETE' });
  if (!r.ok && r.status !== 404) {
    console.warn(`deleteUnit(${unitId}) returned ${r.status}: ${r.text}`);
  }
}

/**
 * Attach a unit to a MSEL, making it a contributor. Returns the MselUnit join record —
 * keep its `id`, because that (not the unit id) is what `removeUnitFromMsel` takes.
 */
export async function addUnitToMsel(
  token: string,
  mselId: string,
  unitId: string
): Promise<{ id: string; mselId: string; unitId: string }> {
  const r = await blueprintCall<any>(token, '/api/mselunits', {
    method: 'POST',
    body: { mselId, unitId },
  });
  if (!r.ok) {
    throw new Error(`addUnitToMsel failed (${r.status}): ${r.text}`);
  }

  return {
    id: r.data.id as string,
    mselId: r.data.mselId as string,
    unitId: r.data.unitId as string,
  };
}

/**
 * Detach a unit from a MSEL. Takes the **MselUnit id**, not the unit id. Swallows 404.
 * The underlying Unit survives — delete it separately with `deleteUnit`.
 */
export async function removeUnitFromMsel(token: string, mselUnitId: string): Promise<void> {
  const r = await blueprintCall(token, `/api/mselunits/${mselUnitId}`, { method: 'DELETE' });
  if (!r.ok && r.status !== 404) {
    console.warn(`removeUnitFromMsel(${mselUnitId}) returned ${r.status}: ${r.text}`);
  }
}

/**
 * List the MselUnit records for a MSEL. Each entry carries a nested `unit` object, so
 * `(await listMselUnits(t, id)).map(mu => mu.unit.name)` gives the contributor names.
 *
 * The path is `/api/msels/{mselId}/mselunits` — note `/api/msels/{mselId}/units` is a
 * 404, unlike the teams/organizations endpoints which do use the bare plural.
 */
export async function listMselUnits(token: string, mselId: string): Promise<any[]> {
  const r = await blueprintCall<any[]>(token, `/api/msels/${mselId}/mselunits`);
  if (!r.ok) {
    throw new Error(`listMselUnits failed (${r.status}): ${r.text}`);
  }
  return r.data ?? [];
}

// NOTE: there is deliberately no `assignTeamToOrganization` helper.
//
// Blueprint has no team-to-organization relationship. `Blueprint.Api.ViewModels.Team`
// has no OrganizationId (nor does any Data model — `grep -rn OrganizationId` over
// Blueprint.Api.Data/Models returns nothing), and the team-edit dialog has no
// organization control. Teams and Organizations are independent, both scoped to a MSEL
// by `MselId`.
//
// This is worth stating explicitly because `PUT /api/teams/{id}` returns 200 for a body
// carrying `organizationId` and silently drops the field, so an "assignment" helper can
// look like it works. Any test asserting a team-org assignment is testing a feature that
// does not exist.
//
// Related API gotcha, if you do need to update a team: PUT replaces the whole object, so
// send a full GET-then-PUT body. A partial body omits `mselId` and the API rejects it
// with "The MselId of the team cannot be changed!".

// ============================================================================
// UI-side helpers
// ============================================================================

/**
 * Locate a MSEL row in the /build list by name, typing into the Search box first
 * so the row is guaranteed onto the (paginated) first page.
 *
 * The /build list uses a mat-table and paginates. A freshly-created MSEL often
 * lands on page 2+. The Search box filters the FULL dataset and only then
 * paginates, so filtering by the unique name collapses the list to the single
 * matching row on page 1.
 *
 * MSEL name cells contain <a> anchors with empty text (hidden), so this returns
 * the parent row which is clickable.
 *
 * @param page - Playwright Page object
 * @param name - The MSEL name to filter and match on
 * @returns A locator for the mat-row containing the MSEL, already filtered onto page 1
 */
export async function findMselRowByName(page: Page, name: string) {
  const searchField = page.getByRole('textbox', { name: /search/i });
  if (await searchField.waitFor({ state: 'visible', timeout: 5000 }).then(() => true).catch(() => false)) {
    await searchField.fill(name);
    // Wait for the filtered row to appear (deterministic: the row with the searched name becomes visible)
    const filteredRow = page.getByRole('row').filter({ hasText: name });
    await expect(filteredRow).toBeVisible({ timeout: 5000 });
  }
  // Return the row, not the hidden anchor inside it
  return page.getByRole('row').filter({ hasText: name });
}

/**
 * Locator for a MSEL's section list item (Info, Teams, Organizations, ...).
 *
 * The MSEL detail page renders its sections as bare `mat-list-item`s — there is no
 * `mat-nav-list` or `[role="navigation"]` wrapper, so do not wait on one.
 */
function mselSectionItem(page: Page, sectionName: string) {
  return page.locator('mat-list-item').filter({ hasText: sectionName }).first();
}

/**
 * Navigate straight to a MSEL's detail page by id and wait for it to be interactive.
 *
 * Prefer this over driving the /build list: the list's name cell is an `<a>` with
 * empty text that never becomes visible, and the list paginates (19+ MSELs exist on
 * a normal dev stack), so a freshly-seeded MSEL is rarely on page 1. Since tests
 * seed via the API they already hold the id, making the list hop pure overhead.
 *
 * Readiness is proven by the section list rendering, which only happens once the
 * MSEL has loaded.
 *
 * @param page - Playwright Page object
 * @param mselId - The MSEL id returned by createMsel/ensureMsel
 */
export async function navigateToMsel(page: Page, mselId: string): Promise<void> {
  await page.goto(`${Services.Blueprint.UI}/build?msel=${mselId}`, {
    waitUntil: 'domcontentloaded',
  });
  await expect(mselSectionItem(page, 'Info')).toBeVisible({ timeout: 30000 });
}

/**
 * Navigate to a specific section within a MSEL (e.g., Teams, Organizations, Scenario Events).
 *
 * @param page - Playwright Page object
 * @param mselId - The MSEL id
 * @param sectionName - The section list item name (e.g., "Teams", "Organizations")
 */
export async function navigateToMselSection(
  page: Page,
  mselId: string,
  sectionName: string
): Promise<void> {
  await navigateToMsel(page, mselId);

  const navItem = mselSectionItem(page, sectionName);
  await expect(navItem).toBeVisible({ timeout: 15000 });
  await navItem.click();
}

// ============================================================================
// Global cleanup (safety net)
// ============================================================================

/**
 * Delete all Blueprint test data with the "TestBP-" name prefix.
 *
 * This is a safety net called from global-teardown.ts after the suite completes,
 * ensuring the database never accumulates leftovers across runs. It is NOT a
 * substitute for per-test cleanup — every test must still delete what it seeds
 * in afterEach/afterAll (see CLAUDE.md "Test data hygiene").
 *
 * Failure policy: best-effort. A teardown error must never fail an otherwise-green
 * run, so everything is wrapped and only logged.
 */
export async function purgeAllBlueprintTestData(): Promise<void> {
  try {
    const token = await getBlueprintToken();
    const listRes = await blueprintCall<any[]>(token, '/api/msels');
    if (!listRes.ok) {
      console.warn(`[Blueprint purge] MSEL list failed (${listRes.status}); skipping purge.`);
      return;
    }

    const testMsels = listRes.data?.filter((m: any) => m.name?.startsWith('TestBP-')) ?? [];
    console.log(`[Blueprint purge] Found ${testMsels.length} TestBP-* MSEL(s) to delete.`);

    for (const msel of testMsels) {
      try {
        await deleteMsel(token, msel.id);
        console.log(`[Blueprint purge] Deleted MSEL ${msel.name} (${msel.id})`);
      } catch (err) {
        console.warn(`[Blueprint purge] Failed to delete MSEL ${msel.id}: ${err}`);
      }
    }

    // Units are global, not MSEL-scoped, so deleting the MSELs above does not remove
    // them — a leaked unit stays in every MSEL's contributor picker forever. Purge by
    // name prefix as well. `Create Catalog Test Unit` is included because the
    // admin-catalogs specs seeded it under a non-TestBP- name before this purge existed;
    // drop that clause once those specs use tempBlueprintName().
    const unitsRes = await blueprintCall<any[]>(token, '/api/units');
    if (unitsRes.ok) {
      const testUnits =
        unitsRes.data?.filter(
          (u: any) => u.name?.startsWith('TestBP-') || u.name === 'Create Catalog Test Unit'
        ) ?? [];
      console.log(`[Blueprint purge] Found ${testUnits.length} test unit(s) to delete.`);

      for (const unit of testUnits) {
        try {
          await deleteUnit(token, unit.id);
          console.log(`[Blueprint purge] Deleted unit ${unit.name} (${unit.id})`);
        } catch (err) {
          console.warn(`[Blueprint purge] Failed to delete unit ${unit.id}: ${err}`);
        }
      }
    } else {
      console.warn(`[Blueprint purge] Unit list failed (${unitsRes.status}); units not purged.`);
    }

    // Catalogs and inject types are global admin records, and the admin-catalog specs
    // clean up *inline at the end of the test body* rather than in an afterEach — so any
    // mid-test failure leaks them. That is not hypothetical: an interrupted run left a
    // "Copy Inject Test Catalog" plus six inject types behind, and the leftover catalog
    // then broke `copy-inject.spec.ts` on the following run (its "Add Inject" button
    // resolved to a hidden one inside the stale catalog's collapsed panel). Purge them
    // here as a safety net.
    //
    // These specs predate tempBlueprintName() and use fixed literal names, so match those
    // known names as well as the TestBP- prefix. Narrow this to the prefix alone once the
    // admin specs seed with tempBlueprintName().
    const LEGACY_ADMIN_TEST_NAMES = [
      'Copy Inject Test Catalog',
      'Create Catalog Test Catalog',
      'Expand Catalog Test Catalog',
      'Test Upload Catalog',
      'Copy Test Catalog',
      'Copy Inject Test Inject Type',
      'Copy Test Inject Type',
      'Create Catalog Test Inject Type',
      'Create Inject Type Test',
      'Expand Catalog Test Inject Type',
      'Test Upload Inject Type',
    ];
    const isTestAdminRecord = (name?: string) =>
      !!name && (name.startsWith('TestBP-') || LEGACY_ADMIN_TEST_NAMES.includes(name));

    // Catalogs first: an inject type cannot be deleted while a catalog still references it.
    for (const [endpoint, label] of [
      ['/api/catalogs', 'catalog'],
      ['/api/injectTypes', 'inject type'],
    ] as const) {
      const res = await blueprintCall<any[]>(token, endpoint);
      if (!res.ok) {
        console.warn(
          `[Blueprint purge] ${label} list failed (${res.status}); ${label}s not purged.`
        );
        continue;
      }

      const leftovers = res.data?.filter((r: any) => isTestAdminRecord(r.name)) ?? [];
      console.log(`[Blueprint purge] Found ${leftovers.length} test ${label}(s) to delete.`);

      for (const record of leftovers) {
        try {
          const del = await blueprintCall(token, `${endpoint}/${record.id}`, { method: 'DELETE' });
          if (del.ok) {
            console.log(`[Blueprint purge] Deleted ${label} ${record.name} (${record.id})`);
          } else {
            console.warn(
              `[Blueprint purge] Failed to delete ${label} ${record.id} (${del.status})`
            );
          }
        } catch (err) {
          console.warn(`[Blueprint purge] Failed to delete ${label} ${record.id}: ${err}`);
        }
      }
    }
  } catch (error) {
    console.warn(`[Blueprint purge] Error during cleanup: ${error}`);
  }
}
