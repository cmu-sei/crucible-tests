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

import {
  APIRequestContext,
  Locator,
  Page,
  request as playwrightRequest,
  expect,
} from '@playwright/test';
import { Services, isKeycloakUrl, waitForFirstVisible } from '../shared-fixtures';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { randomUUID } from 'crypto';
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
 * The prefix is free-form (specs use ~50 different ones), so the purge in
 * `purgeAllBlueprintTestData` must NOT key off any particular prefix — it
 * matches the `-<13-digit-ms>-<digits>` *shape* this function produces, via
 * `TEMP_NAME_PATTERN` below. That way a new spec inventing a new prefix is
 * swept automatically instead of leaking until someone updates an allowlist.
 */
export function tempBlueprintName(prefix: string = 'TestBP'): string {
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 1_000_000)}`;
}

/**
 * Matches any name produced by `tempBlueprintName`, whatever its prefix:
 * a trailing `-<epoch-ms>-<random>`. Anchored at the end so a real record
 * that merely contains digits can't match by accident.
 *
 * This is the single source of truth for "is this row test-seeded?" — used by
 * the teardown purge. Keep it in sync with `tempBlueprintName` above.
 */
export const TEMP_NAME_PATTERN = /-\d{13}-\d{1,6}$/;

/** True when `name` looks like something `tempBlueprintName()` generated. */
export function isTempBlueprintName(name?: string | null): boolean {
  return !!name && TEMP_NAME_PATTERN.test(name);
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

/**
 * `EventType` from Blueprint.Api.Data/Enumerations.cs. The numeric values matter:
 * the enum starts at 10, so **0 is not a member**.
 */
export const ScenarioEventType = {
  Inject: 10,
  Information: 20,
  Facilitation: 30,
} as const;

export interface CreateScenarioEventOptions {
  /** Delta seconds from MSEL start time. Default 0. */
  deltaSeconds?: number;
  /** Group order. Default 0. */
  groupOrder?: number;
  /** Row metadata (control number). Default empty. */
  rowMetadata?: string;
  /**
   * Event type. Defaults to `ScenarioEventType.Inject` (10) — see the note below on why
   * leaving this unset is not an option.
   */
  scenarioEventType?: number;
}

/**
 * Create a scenario event on the specified MSEL via the Blueprint API.
 * Returns the event id — pair every call with `deleteScenarioEvent` in test teardown.
 *
 * `POST /api/scenarioEvents` returns an **array** (it can create several), so we take the
 * first element.
 *
 * **`scenarioEventType` must be sent, and must be a real enum value.** `EventType` is
 * `Inject=10, Information=20, Facilitation=30`; omitting the field persists **0**, which is
 * not a member of the enum. That silently produces an event the grid renders with **zero
 * data cells**, because the UI picks a row's columns like this
 * (`scenario-event-list.component.ts` `rowDataFields`):
 *
 * ```ts
 * (ev.scenarioEventType === EventType.Inject        && df.onScenarioEventList)  ||
 * (ev.scenarioEventType === EventType.Information   && df.isInformationField)   ||
 * (ev.scenarioEventType === EventType.Facilitation  && df.isFacilitationField)
 * ```
 *
 * With 0 no branch matches, `rowDataFields` returns `[]`, and every cell is blank no matter
 * how good the DataValues are. This helper previously omitted the field, so 17 specs seeded
 * unrenderable events and could only ever assert row *presence*. Verified live:
 * `POST` without the field echoes back `"scenarioEventType": 0`.
 *
 * Note also that the API model has **no `description` and no `moveNumber`**
 * (`ViewModels/ScenarioEvent.cs`) — an event's text lives in DataValues, and "Move" is a
 * DataField. Both were previously sent and silently dropped, so a spec passing
 * `moveNumber: 1` read like a precondition while doing nothing. They are not accepted here.
 */
export async function createScenarioEvent(
  token: string,
  mselId: string,
  opts: CreateScenarioEventOptions = {}
): Promise<CreatedScenarioEvent> {
  const createBody = {
    mselId,
    deltaSeconds: opts.deltaSeconds ?? 0,
    groupOrder: opts.groupOrder ?? 0,
    rowMetadata: opts.rowMetadata ?? '',
    scenarioEventType: opts.scenarioEventType ?? ScenarioEventType.Inject,
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

/**
 * The standard 13-DataField set, defined here rather than copied from a pre-existing row.
 *
 * These values were captured from the dev stack's `Standard MSEL` template, but they are
 * declared literally on purpose: `seedMselDataFields` used to locate that MSEL by name and
 * clone its fields, which made **every** scenario-event spec depend on a row no test creates
 * — precisely what CLAUDE.md forbids ("Never depend on an existing row... or the current
 * database shape"). On a freshly-provisioned database that lookup throws and the whole
 * scenario-events, playbook and event-detail suites fail in `beforeEach`.
 *
 * `onScenarioEventList` matters: it is what puts a field in the Scenario Events grid (see
 * `rowDataFields` in scenario-event-list.component.ts). `Details` and `Expected Actions` are
 * deliberately false here, matching the template.
 */
const STANDARD_DATA_FIELDS: ReadonlyArray<Record<string, unknown>> = [
  { name: 'Control Number', dataType: 'String', displayOrder: 1, onScenarioEventList: true, onExerciseView: true },
  { name: 'Move', dataType: 'Integer', displayOrder: 2, onScenarioEventList: true, onExerciseView: false },
  { name: 'Group', dataType: 'Integer', displayOrder: 3, onScenarioEventList: true, onExerciseView: false },
  { name: 'Delivery Time', dataType: 'DateTime', displayOrder: 4, onScenarioEventList: true, onExerciseView: true },
  { name: 'Simulated Time', dataType: 'DateTime', displayOrder: 5, onScenarioEventList: true, onExerciseView: true },
  { name: 'Assigned To', dataType: 'Organization', displayOrder: 6, onScenarioEventList: true, onExerciseView: true },
  { name: 'Status', dataType: 'Status', displayOrder: 7, onScenarioEventList: true, onExerciseView: true },
  { name: 'Title', dataType: 'String', displayOrder: 8, onScenarioEventList: true, onExerciseView: true },
  { name: 'Description', dataType: 'String', displayOrder: 9, onScenarioEventList: true, onExerciseView: false },
  { name: 'From Org', dataType: 'Organization', displayOrder: 10, onScenarioEventList: true, onExerciseView: true },
  { name: 'To Org', dataType: 'TeamsMultiple', displayOrder: 11, onScenarioEventList: true, onExerciseView: true },
  { name: 'Details', dataType: 'String', displayOrder: 12, onScenarioEventList: false, onExerciseView: false },
  { name: 'Expected Actions', dataType: 'String', displayOrder: 13, onScenarioEventList: false, onExerciseView: false },
];

/**
 * Give a MSEL the standard 13-DataField set so its scenario events can actually render.
 *
 * A MSEL created via `POST /api/msels` has **zero** DataFields — the API only copies them
 * when *cloning*, and `GET /api/dataFields/templates` is empty on this stack. Without fields
 * the Scenario Events grid has no columns at all.
 *
 * Self-contained: the fields are created from `STANDARD_DATA_FIELDS` above, so this works on
 * an empty database and does not depend on any pre-existing MSEL.
 *
 * Idempotent: returns immediately if the MSEL already has fields. Note `POST /api/dataFields`
 * answers **200**, not 201 — `blueprintCall` checks `ok()` so that is handled.
 *
 * @returns the MSEL's DataFields after seeding.
 */
export async function seedMselDataFields(token: string, mselId: string): Promise<any[]> {
  const existing = await listMselDataFields(token, mselId);
  if (existing.length > 0) return existing;

  for (const field of STANDARD_DATA_FIELDS) {
    const r = await blueprintCall(token, '/api/dataFields', {
      method: 'POST',
      body: {
        ...field,
        mselId,
        isChosenFromList: false,
        isInformationField: false,
        isFacilitationField: false,
        isInitiallyHidden: false,
        dataOptions: [],
      },
    });
    if (!r.ok) {
      throw new Error(
        `seedMselDataFields: POST dataFields "${field.name}" failed (${r.status}): ${r.text}`
      );
    }
  }

  const seeded = await listMselDataFields(token, mselId);
  if (seeded.length !== STANDARD_DATA_FIELDS.length) {
    throw new Error(
      `seedMselDataFields: expected ${STANDARD_DATA_FIELDS.length} DataFields on ${mselId}, got ${seeded.length}`
    );
  }
  return seeded;
}

/**
 * Superseded by the literal `STANDARD_DATA_FIELDS` set above. Kept only to copy fields from
 * an arbitrary source MSEL when a spec genuinely needs to mirror another MSEL's schema.
 */
export async function copyMselDataFieldsFrom(
  token: string,
  sourceMselId: string,
  mselId: string
): Promise<any[]> {
  const existing = await listMselDataFields(token, mselId);
  if (existing.length > 0) return existing;

  const sourceFields = await listMselDataFields(token, sourceMselId);
  for (const field of sourceFields) {
    const body: Record<string, unknown> = { ...field, mselId, dataOptions: [] };
    delete body.id;
    const r = await blueprintCall(token, '/api/dataFields', { method: 'POST', body });
    if (!r.ok) {
      throw new Error(`copyMselDataFieldsFrom: POST dataFields failed (${r.status}): ${r.text}`);
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
 * Put a user on a MSEL team. Returns the TeamUser join record, whose `id` is what
 * `removeUserFromTeam` takes. `POST /api/teamusers` answers **201**.
 *
 * Team membership is what the join flow keys off — see `seedJoinableMsel`.
 */
export async function addUserToTeam(
  token: string,
  teamId: string,
  userId: string
): Promise<{ id: string; teamId: string; userId: string }> {
  const r = await blueprintCall<any>(token, '/api/teamusers', {
    method: 'POST',
    body: { teamId, userId },
  });
  if (!r.ok) {
    throw new Error(`addUserToTeam failed (${r.status}): ${r.text}`);
  }
  return {
    id: r.data.id as string,
    teamId: r.data.teamId as string,
    userId: r.data.userId as string,
  };
}

/**
 * Remove a user from a team, by **TeamUser join id**. Swallows 404.
 */
export async function removeUserFromTeam(token: string, teamUserId: string): Promise<void> {
  const r = await blueprintCall(token, `/api/teamusers/${teamUserId}`, { method: 'DELETE' });
  if (!r.ok && r.status !== 404) {
    console.warn(`removeUserFromTeam(${teamUserId}) returned ${r.status}: ${r.text}`);
  }
}

/**
 * Seed a MSEL that shows up on the current user's **Join an Event** surface.
 *
 * `GET /api/my-join-msels` (which feeds both the dashboard's Join card and the /join page)
 * is backed by `MselService.GetMyJoinInvitationMselsAsync`, and it requires all three of:
 *   1. `msel.Status == Deployed`,
 *   2. `msel.PlayerViewId != null`, and
 *   3. the current user being on one of that MSEL's teams.
 *
 * Miss any one and the list comes back empty — which is why specs in
 * `launch-and-join-workflows/` and `event-dashboard-and-navigation/` used to self-skip.
 * Verified live: with all three satisfied, `my-join-msels` returns the seeded MSEL; the join
 * surface has no other prerequisite.
 *
 * `playerViewId` is a plain settable field, so no real Player view is needed — the join list
 * only checks it for non-null. Note it must be set with a **full GET-then-PUT**: the update
 * path maps the whole view model, so a partial body nulls everything omitted.
 *
 * Caller must delete: `deleteMsel` removes the MSEL and cascades its teams; the TeamUser row
 * goes with the team. Returns the ids needed either way.
 */
export async function seedJoinableMsel(
  token: string,
  userId: string,
  opts: { name?: string; teamName?: string } = {}
): Promise<{ mselId: string; mselName: string; teamId: string; teamUserId: string }> {
  const name = opts.name ?? tempBlueprintName('TestBP-Join');

  const msel = await createMsel(token, {
    name,
    description: 'Seeded to appear on the Join an Event surface',
    status: 'Deployed',
  });

  // PlayerViewId is not settable on create, so patch it in. Full GET-then-PUT — see above.
  const current = await blueprintCall<any>(token, `/api/msels/${msel.id}`);
  if (!current.ok) {
    throw new Error(`seedJoinableMsel: GET msel failed (${current.status}): ${current.text}`);
  }
  const put = await blueprintCall(token, `/api/msels/${msel.id}`, {
    method: 'PUT',
    body: { ...current.data, playerViewId: randomUUID() },
  });
  if (!put.ok) {
    throw new Error(`seedJoinableMsel: PUT playerViewId failed (${put.status}): ${put.text}`);
  }

  const team = await createTeam(token, msel.id, {
    name: opts.teamName ?? tempBlueprintName('TestBP-JoinTeam'),
    shortName: 'TJT',
  });
  const teamUser = await addUserToTeam(token, team.id, userId);

  return { mselId: msel.id, mselName: name, teamId: team.id, teamUserId: teamUser.id };
}

// ============================================================================
// Invitations (what actually authorises a join)
// ============================================================================
//
// Appearing on the Join surface and being *allowed to join* are two separate gates, and
// they are easy to conflate:
//
//   * `GET /api/my-join-msels` (see `seedJoinableMsel`) only needs Deployed +
//     PlayerViewId + team membership. That is what renders the card.
//   * `POST /api/msels/{id}/join` runs `MselService.JoinMselByInvitationAsync`, which
//     first checks `GetMyDeployedMselIdsAsync` — the set of MSELs whose `PlayerViewId`
//     is a **Player view the user is really in**. A seeded `playerViewId` is a synthetic
//     guid, so that check misses and the invitation branch is taken instead. With no
//     Invitation row the API answers **403 "No invitations exist for MSEL {id}."**
//
// Verified live: clicking Join on a `seedJoinableMsel` MSEL with no invitation is a 403;
// after `createInvitation` the same click answers 200 with the Player View id. So any
// spec that drives the join *button* (not just the card) must seed an invitation too.

export interface CreateInvitationOptions {
  /** Restrict to an email domain (e.g. '@localhost'). Empty/omitted means any user. */
  emailDomain?: string;
  /** Expiry. Defaults to 24h out — must be in the future or the invitation is ignored. */
  expirationDateTime?: Date;
  /** Seat cap. Defaults to 50; `userCount` must stay below it or the invitation is invalid. */
  maxUsersAllowed?: number;
}

/**
 * Create an Invitation for a MSEL team, which is what makes `POST /api/msels/{id}/join`
 * succeed. `POST /api/invitations` answers **201**.
 *
 * Cleanup: the invitation is cascade-deleted with its MSEL (verified — the invitation id
 * 404s after `deleteMsel`), so a spec that already deletes the MSEL needs no separate
 * teardown. `deleteInvitation` is provided for specs that outlive their MSEL.
 *
 * Note the API serialises the integer fields as **strings** (`"maxUsersAllowed": "50"`),
 * so they are returned as `number` here only after an explicit cast by the caller if needed.
 */
export async function createInvitation(
  token: string,
  mselId: string,
  teamId: string,
  opts: CreateInvitationOptions = {}
): Promise<{ id: string; mselId: string; teamId: string }> {
  const expiration =
    opts.expirationDateTime ?? new Date(Date.now() + 24 * 60 * 60 * 1000);

  const r = await blueprintCall<any>(token, '/api/invitations', {
    method: 'POST',
    body: {
      mselId,
      teamId,
      emailDomain: opts.emailDomain ?? '',
      expirationDateTime: expiration.toISOString(),
      maxUsersAllowed: opts.maxUsersAllowed ?? 50,
      userCount: 0,
      isTeamLeader: false,
      wasDeactivated: false,
    },
  });
  if (!r.ok) {
    throw new Error(`createInvitation failed (${r.status}): ${r.text}`);
  }

  return {
    id: r.data.id as string,
    mselId: r.data.mselId as string,
    teamId: r.data.teamId as string,
  };
}

/** Delete an invitation by id. Swallows 404 so teardown is idempotent. */
export async function deleteInvitation(token: string, invitationId: string): Promise<void> {
  const r = await blueprintCall(token, `/api/invitations/${invitationId}`, { method: 'DELETE' });
  if (!r.ok && r.status !== 404) {
    console.warn(`deleteInvitation(${invitationId}) returned ${r.status}: ${r.text}`);
  }
}

/**
 * The MSELs the current user may join — `GET /api/my-join-msels`, the exact call that
 * feeds the dashboard's Join card and the /join page.
 *
 * Specs use this to assert their seeding precondition really landed before driving the UI,
 * so a missing card is reported as "the seed failed" rather than as "the UI is broken".
 */
export async function listMyJoinMsels(token: string): Promise<any[]> {
  const r = await blueprintCall<any[]>(token, '/api/my-join-msels');
  if (!r.ok) {
    throw new Error(`listMyJoinMsels failed (${r.status}): ${r.text}`);
  }
  return r.data ?? [];
}

/**
 * The Blueprint user id for the account the tests authenticate as (`admin`).
 *
 * Resolved by name from `GET /api/users` rather than hardcoded, since the id is
 * database-generated. Used by join-flow seeding, which must put *this* user on a team.
 */
export async function getCurrentBlueprintUserId(
  token: string,
  displayName = 'Admin User'
): Promise<string> {
  const r = await blueprintCall<any[]>(token, '/api/users');
  if (!r.ok) {
    throw new Error(`getCurrentBlueprintUserId: GET users failed (${r.status}): ${r.text}`);
  }
  const match = r.data?.find((u: any) => u.name === displayName);
  if (!match) {
    throw new Error(
      `getCurrentBlueprintUserId: no user named "${displayName}" in ${r.data?.length ?? 0} users`
    );
  }
  return match.id as string;
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
 * Create a Blueprint user.
 *
 * The id is **client-supplied** (the API does not generate one), so pass a uuid or let
 * this helper mint one. `POST /api/users` returns **201**.
 *
 * Blueprint users are normally auto-provisioned on a user's first Keycloak login, which
 * led to the belief that tests cannot make one — hence specs that mutated a *pre-existing*
 * shared user row instead. They can: this endpoint works directly, so a spec that needs a
 * user should seed its own and delete it in teardown.
 *
 * `roleId` is honoured by POST (verified: the 201 body echoes it back), so a spec that needs
 * a user who *already has* a role — e.g. one testing role removal — can seed that starting
 * state here instead of driving the UI twice. Omit it and the user is created with
 * `roleId: null`, which the admin Users table renders as "None Locally".
 */
export async function createBlueprintUser(
  token: string,
  options: { id?: string; name?: string; roleId?: string } = {}
): Promise<{ id: string; name: string; roleId: string | null }> {
  const id = options.id ?? randomUUID();
  const name = options.name ?? tempBlueprintName('TestBP-User');

  const r = await blueprintCall<any>(token, '/api/users', {
    method: 'POST',
    body: { id, name, roleId: options.roleId ?? null },
  });
  if (!r.ok) {
    throw new Error(`createBlueprintUser failed (${r.status}): ${r.text}`);
  }

  return {
    id: r.data.id as string,
    name: r.data.name as string,
    roleId: (r.data.roleId ?? null) as string | null,
  };
}

/**
 * Delete a Blueprint user by id. Swallows 404 so teardown is idempotent.
 */
export async function deleteBlueprintUser(token: string, userId: string): Promise<void> {
  const r = await blueprintCall(token, `/api/users/${userId}`, { method: 'DELETE' });
  if (!r.ok && r.status !== 404) {
    console.warn(`deleteBlueprintUser(${userId}) returned ${r.status}: ${r.text}`);
  }
}

/**
 * Fetch a single user by id. Use this to prove a role change made in the UI actually
 * persisted server-side.
 *
 * This matters more than usual for the role dropdown: `UserDataService.updateStore` calls
 * akita's `EntityStore.add()`, which *skips* ids already in the store, so a role change
 * never reaches the local store at all. The dropdown only looks correct because mat-select
 * holds its own selection. A UI-text assertion therefore proves almost nothing on its own —
 * always pair it with a `getBlueprintUser` check on `roleId`.
 */
export async function getBlueprintUser(token: string, userId: string): Promise<any> {
  const r = await blueprintCall<any>(token, `/api/users/${userId}`);
  if (!r.ok) {
    throw new Error(`getBlueprintUser(${userId}) failed (${r.status}): ${r.text}`);
  }
  return r.data;
}

/**
 * Add a user to a unit. Returns the UnitUser join record — its `id` is what
 * `removeUserFromUnit` takes.
 *
 * Membership lives at `POST /api/unitusers` (201). Note the nested
 * `/api/units/{unitId}/users/{userId}` route is **DELETE-only**, so it cannot be used to
 * add. Also note `GET /api/units` and `GET /api/units/{id}` both report `users: []`
 * regardless of membership — read it back via `GET /api/units/{id}/users`, which is
 * correct.
 */
export async function addUserToUnit(
  token: string,
  unitId: string,
  userId: string
): Promise<{ id: string; unitId: string; userId: string }> {
  const r = await blueprintCall<any>(token, '/api/unitusers', {
    method: 'POST',
    body: { unitId, userId },
  });
  if (!r.ok) {
    throw new Error(`addUserToUnit failed (${r.status}): ${r.text}`);
  }

  return {
    id: r.data.id as string,
    unitId: r.data.unitId as string,
    userId: r.data.userId as string,
  };
}

/**
 * Remove a user from a unit, by **UnitUser join id**. Swallows 404.
 */
export async function removeUserFromUnit(token: string, unitUserId: string): Promise<void> {
  const r = await blueprintCall(token, `/api/unitusers/${unitUserId}`, { method: 'DELETE' });
  if (!r.ok && r.status !== 404) {
    console.warn(`removeUserFromUnit(${unitUserId}) returned ${r.status}: ${r.text}`);
  }
}

/**
 * List the users in a unit. Use this rather than reading `unit.users`, which the unit
 * endpoints always return empty.
 */
export async function listUnitUsers(token: string, unitId: string): Promise<any[]> {
  const r = await blueprintCall<any[]>(token, `/api/units/${unitId}/users`);
  if (!r.ok) {
    throw new Error(`listUnitUsers failed (${r.status}): ${r.text}`);
  }
  return r.data ?? [];
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

// ============================================================================
// System roles
// ============================================================================

/**
 * List the system roles (Administrator, Content Developer, Observer, plus any custom ones).
 *
 * The path is `/api/system-roles` — kebab-case. `/api/roles` and `/api/systemRoles` are both
 * 404s, which has previously been mistaken for "there is no roles endpoint". This is the same
 * endpoint the admin Users table's role dropdown is fed from (`SystemRoleDataService.roles$`),
 * so the ids here line up exactly with the `mat-option` values rendered there.
 */
export async function listSystemRoles(token: string): Promise<any[]> {
  const r = await blueprintCall<any[]>(token, '/api/system-roles');
  if (!r.ok) {
    throw new Error(`listSystemRoles failed (${r.status}): ${r.text}`);
  }
  return r.data ?? [];
}

/**
 * Resolve a system role by its display name — the same string the role dropdown shows.
 *
 * Throws (listing what does exist) rather than returning undefined, so a spec that assigns
 * a role fails loudly on a renamed/removed role instead of silently asserting against
 * `undefined`.
 */
export async function getSystemRoleByName(token: string, name: string): Promise<any> {
  const roles = await listSystemRoles(token);
  const role = roles.find((r: any) => r.name === name);
  if (!role) {
    throw new Error(
      `getSystemRoleByName: no system role named "${name}". ` +
        `Available: ${roles.map((r: any) => r.name).join(', ') || '(none)'}`
    );
  }
  return role;
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
 * Open a /build row's Download menu, pick a format, and return the resulting download.
 *
 * Every spec that exports a MSEL through the UI needs this, and the naive version
 * (click trigger → `expect(item).toBeVisible()` → click item) flakes. Material animates each
 * overlay in and out and attaches a *fresh* panel per open, so a click issued while an
 * animation is in flight lands on the outgoing panel or fails outright — the observed call logs
 * are "element is not stable" followed by "element was detached from the DOM, retrying" until
 * the click times out, with the menu item resolving successfully the whole time. The /build row
 * the overlay is anchored to also re-renders on the SignalR pushes of whatever the other worker
 * is creating, which is why this shows up under the suite and not in isolation.
 *
 * So opening the menu and picking the item is retried as a unit, the same shape as
 * `selectMatSelectOption` in `fixtures.ts`. Unlike a mat-select, the panel closing does not
 * prove the *download* started, so the download event is awaited by the caller: it is
 * registered before the first click so no attempt can miss it, and a retry that manages to
 * trigger a second download of the same file is harmless.
 *
 * @param page - Playwright Page object, already on /build
 * @param mselRow - The row locator, e.g. from `findMselRowByName`
 * @param menuItem - Matcher for the menu item, e.g. `/Download xlsx file/i`
 */
export async function downloadMselFile(page: Page, mselRow: Locator, menuItem: RegExp) {
  const menuPanel = page.locator('.mat-mdc-menu-panel');

  // A panel left over from a previous open would swallow the trigger click.
  await expect(menuPanel).toHaveCount(0, { timeout: 10000 });

  const downloadPromise = page.waitForEvent('download', { timeout: 30000 });

  await expect(async () => {
    if ((await menuPanel.count()) === 0) {
      await mselRow.locator('button[title^="Download "]').first().click({ timeout: 5000 });
    }
    const option = page.getByRole('menuitem', { name: menuItem });
    await expect(option).toBeVisible({ timeout: 3000 });
    await option.click({ timeout: 3000 });
    // The menu closing is what confirms the click landed on the live panel.
    await expect(menuPanel).toHaveCount(0, { timeout: 5000 });
  }).toPass({ timeout: 30000, intervals: [250, 500, 1000, 2000] });

  return downloadPromise;
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
 * Replace the contents of a MSEL Config-tab text field the way a user would, with real key
 * events.
 *
 * `locator.fill()` sets the value and dispatches a single `input` event. That is not enough
 * for the Config tab: it marks the form dirty from its own keypress handlers, so a `fill()`ed
 * edit leaves `isChanged` false and Save Changes disabled — the edit looks like it never
 * happened. Selecting-all + Delete + `pressSequentially` fires the events the component
 * listens for. `locator.clear()` has the same problem as `fill()`, being fill-based.
 *
 * Pass an empty string to clear the field, which is what the required-field specs need.
 *
 * @param field - The target textbox locator (e.g. the Name or Description field)
 * @param value - The text to type; '' clears the field without typing anything
 */
export async function retypeMselField(field: Locator, value: string): Promise<void> {
  await field.click();
  await field.press('ControlOrMeta+a');
  await field.press('Delete');
  if (value) {
    await field.pressSequentially(value);
  }
  await expect(field).toHaveValue(value);
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

/**
 * Open an admin section (Users, Roles, Units, ...) and wait for its table to render.
 *
 * `/admin` is a single Angular component: `gotoSection()` only flips `selectedTab`, so the
 * URL never changes and there is no `/admin/users` route to navigate to. The sidebar item
 * must actually be clicked. Scoped to `.appitems-container` because the collapsed and
 * expanded sidenavs both exist in the template and only one is rendered at a time.
 *
 * @param page - Playwright Page object
 * @param section - Sidebar label, e.g. 'Users' or 'Roles'
 */
export async function gotoBlueprintAdminSection(page: Page, section: string): Promise<void> {
  await page.goto(`${Services.Blueprint.UI}/admin`, { waitUntil: 'domcontentloaded' });

  const sidebarItem = page
    .locator('.appitems-container mat-list-item')
    .filter({ hasText: section })
    .first();
  await expect(sidebarItem).toBeVisible({ timeout: 30000 });
  await sidebarItem.click();

  await expect(page.locator('table').first()).toBeVisible({ timeout: 15000 });
}

/**
 * Locate a single row in the Scenario Events grid by the text of one of its data values.
 *
 * Prefer this over `page.locator('table tbody tr').last()`. The last tbody row is only *this*
 * spec's event when nothing else is in the grid, and two things break that:
 *
 * 1. The grid renders Move-start header rows interleaved with event rows, and the sort is
 *    user/state driven — position is not a stable identity for a row.
 * 2. Pending upstream: the grid shows scenario events belonging to *other* MSELs. The API
 *    broadcasts every ScenarioEventCreated/Updated/Deleted to `MainHub.ADMIN_DATA_GROUP` in
 *    addition to the event's own MSEL group (`ScenarioEventHandler.GetGroups`), every user
 *    with `SystemPermission.EditMsels` joins that group, and the UI's handler calls
 *    `scenarioEventDataService.updateStore()` -> `scenarioEventStore.upsert()` with no
 *    `mselId` check. `refreshScenarioEventViewEvents()` then copies the *whole* store into
 *    the view (`scenario-event-data.service.ts`), so a concurrent worker seeding an event on
 *    a different MSEL adds a row to this MSEL's grid. Once the API scopes the broadcast (or
 *    the UI filters by `mselId`), positional locators would still be fragile, so this helper
 *    stays either way.
 *
 * The caller must pass text that is unique across the stack — seed the event with a
 * `tempBlueprintName()`-derived value rather than a literal like 'Test event'.
 *
 * @param page - Playwright Page object, already on the MSEL's Scenario Events section
 * @param text - A unique data value rendered in the row (e.g. the seeded Description)
 * @returns A locator for the single `tr` holding that scenario event
 */
export async function findScenarioEventRow(page: Page, text: string) {
  const row = page.locator('table tbody tr').filter({ hasText: text });
  await expect(row).toHaveCount(1, { timeout: 15000 });
  return row;
}

/**
 * Locate a single row in the admin Users table by exact user name, filtering the list first
 * so the row is guaranteed to be on page 1.
 *
 * Two traps this exists to avoid:
 *
 * 1. **The table paginates at 20 rows** (`[pageSize]="20"` on the paginator), and a
 *    freshly-seeded user sorts by name wherever its prefix falls — very often page 2+.
 *    Scanning `table tbody tr` unfiltered silently misses it.
 * 2. **The Search box is `(keyup)`-bound, not a formControl** — `applyFilter($event.target.value)`
 *    fires on keyup only. `fill()` sets the value without dispatching keyup, so the list does
 *    *not* filter and every subsequent locator resolves against the unfiltered table. Type with
 *    `pressSequentially()`. (The /build MSEL list is the opposite: it uses `[formControl]`, where
 *    `fill()` is correct — see `findMselRowByName`.)
 *
 * Returning one scoped row locator also keeps concurrent specs from colliding: every
 * `mat-select` / cell lookup must hang off *this* row, never off `page`, or a parallel spec
 * mutating a different user re-renders the table under the assertion.
 *
 * @param page - Playwright Page object, already on the Users admin section
 * @param name - The exact (unique) user name to filter and match on
 * @returns A locator for the single `tr` holding that user
 */
export async function findAdminUserRowByName(page: Page, name: string) {
  const searchBox = page.getByRole('textbox', { name: /search/i });
  await expect(searchBox).toBeVisible({ timeout: 15000 });

  // Clear whatever is there, then type — keyup is what drives the filter.
  await searchBox.click();
  await searchBox.press('ControlOrMeta+a');
  await searchBox.press('Backspace');
  await searchBox.pressSequentially(name);

  const row = page.locator('table tbody tr').filter({ hasText: name });
  await expect(row).toHaveCount(1, { timeout: 15000 });
  return row;
}

/**
 * The visible role label for a user row — the mat-select *trigger* text, not the whole
 * `mat-select`.
 *
 * Read `.mat-mdc-select-value`, never `matSelect.textContent()`: while the dropdown is open
 * the panel's `mat-option`s are children of the `mat-select` element, so `textContent()`
 * returns the selection concatenated with every option
 * ("ObserverNone LocallyContent DeveloperAdministrator..."). A `toContainText('Observer')`
 * against that passes no matter which role is selected — a tautology. The trigger element
 * holds only the current selection.
 */
export function adminUserRoleLabel(row: ReturnType<Page['locator']>) {
  return row.locator('.mat-mdc-select-value');
}

/**
 * Open a user row's role dropdown and return a locator scoped to *that* select's overlay
 * panel.
 *
 * mat-select renders its panel in a CDK overlay at the end of `<body>`, so the options are
 * not inside the row and a bare `page.locator('mat-option')` matches every open panel on the
 * page. The panel id is exposed as `aria-controls` on the `mat-select` — but only once it is
 * open, so this must be read after the click.
 */
export async function openAdminUserRolePanel(page: Page, row: ReturnType<Page['locator']>) {
  const roleSelect = row.locator('mat-select');
  await expect(roleSelect).toBeVisible({ timeout: 15000 });
  await roleSelect.click();

  const panelId = await roleSelect.getAttribute('aria-controls');
  if (!panelId) {
    throw new Error(
      'openAdminUserRolePanel: mat-select has no aria-controls after being clicked — ' +
        'the panel did not open.'
    );
  }
  const panel = page.locator(`#${panelId}`);
  await expect(panel).toBeVisible({ timeout: 15000 });
  return panel;
}

/**
 * Set a user's role via the admin Users table dropdown, and wait for the change to reach the
 * server.
 *
 * The response wait is armed *before* the option click so the PUT cannot be missed, and it
 * matches `/api/users/{id}` specifically — matching the bare collection would also accept a
 * concurrent spec's PUT for a different user and let a no-op pass.
 *
 * @param page - Playwright Page object, on the Users admin section
 * @param row - The user's row, from `findAdminUserRowByName`
 * @param userId - The user's id, used to match the PUT that must result
 * @param roleLabel - Option text to select, e.g. 'Observer' or 'None Locally'
 */
export async function setAdminUserRole(
  page: Page,
  row: ReturnType<Page['locator']>,
  userId: string,
  roleLabel: string
): Promise<void> {
  const panel = await openAdminUserRolePanel(page, row);

  const option = panel.getByRole('option', { name: roleLabel, exact: true });
  await expect(option).toBeVisible({ timeout: 15000 });

  const put = page.waitForResponse(
    (res) =>
      res.url().includes(`/api/users/${userId}`) &&
      res.request().method() === 'PUT' &&
      res.status() === 200,
    { timeout: 30000 }
  );
  await option.click();
  await put;

  // The overlay closing is the UI's own proof the selection was committed.
  await expect(panel).toBeHidden({ timeout: 15000 });
}

// ============================================================================
// Cross-worker mutex for the shared admin catalog/inject-type surface
// ============================================================================

/**
 * Serialize the specs that drive Blueprint's **admin Catalogs / Inject Types** pages.
 *
 * These pages are not safely concurrent, and the reason is on the application side, not
 * a test-side one: `admin-catalog-list.component.html` mounts one `<app-inject-list>` per
 * catalog row *unconditionally* — the `expandedDetail` column has no `@if` gate, only CSS
 * hides collapsed rows — and each instance's `ngOnInit` calls `loadByCatalog(itsOwnId)`, which
 * writes with an unfiltered `catalogInjectStore.set(...)`: a whole-store replace rather than an
 * upsert keyed by catalog. Every mounted list subscribes to that one store, so whichever GET
 * resolves last wins for all of them. Every admin mutation also broadcasts over SignalR to
 * every open admin session, re-rendering these tables without a `trackBy`.
 *
 * Net effect: two workers on these pages at once will intermittently see each other's data or
 * lose a just-created row, no matter how carefully each spec is written. The specs already
 * filter to their own row via the section Search box and retry with `toPass`, which removes
 * most of it — measured 11/11 pass across 3 consecutive `--workers 1` runs, but a lone flaky
 * retry per run at `--workers 2`.
 *
 * Rather than paper over that with ever-larger retry budgets, take a lock so only one worker
 * is on these pages at a time. The rest of the Blueprint suite keeps running in parallel, so
 * this costs far less than dropping the whole suite to one worker — and it is a *correctness*
 * boundary around a real shared resource, not a sleep.
 *
 * Implemented as an exclusive lockfile because Playwright workers are separate processes and
 * share no memory. `O_EXCL` create is atomic, and a stale lock (from a killed worker) is
 * reclaimed after `STALE_MS`.
 *
 * Usage — in a spec that touches the admin Catalogs or Inject Types pages:
 * ```ts
 * test.beforeEach(async () => { await acquireAdminCatalogLock(); });
 * test.afterEach(async () => { await releaseAdminCatalogLock(); });
 * ```
 */
const ADMIN_LOCK_PATH = path.join(os.tmpdir(), 'blueprint-admin-catalog.lock');
const ADMIN_LOCK_STALE_MS = 240_000;
let _holdsAdminLock = false;

/** Take the admin catalog/inject-type lock, waiting for another worker to finish. */
export async function acquireAdminCatalogLock(timeoutMs = 300_000): Promise<void> {
  const deadline = Date.now() + timeoutMs;

  for (;;) {
    try {
      // 'wx' fails if the path exists — an atomic test-and-set.
      fs.writeFileSync(ADMIN_LOCK_PATH, `${process.pid}:${Date.now()}`, { flag: 'wx' });
      _holdsAdminLock = true;
      return;
    } catch {
      // Held by someone else. Reclaim it if the holder died and left it behind.
      try {
        const age = Date.now() - fs.statSync(ADMIN_LOCK_PATH).mtimeMs;
        if (age > ADMIN_LOCK_STALE_MS) {
          fs.rmSync(ADMIN_LOCK_PATH, { force: true });
          continue;
        }
      } catch {
        // Vanished between the failed create and the stat — just retry.
        continue;
      }

      if (Date.now() > deadline) {
        throw new Error(
          `acquireAdminCatalogLock: timed out after ${timeoutMs}ms waiting for ${ADMIN_LOCK_PATH}`
        );
      }
      await new Promise((r) => setTimeout(r, 250));
    }
  }
}

/** Release the admin lock. Safe to call when this worker does not hold it. */
export async function releaseAdminCatalogLock(): Promise<void> {
  if (!_holdsAdminLock) return;
  _holdsAdminLock = false;
  try {
    fs.rmSync(ADMIN_LOCK_PATH, { force: true });
  } catch {
    /* best effort — a stale lock is reclaimed by age */
  }
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

    const testMsels = listRes.data?.filter((m: any) => isTempBlueprintName(m.name)) ?? [];
    console.log(`[Blueprint purge] Found ${testMsels.length} seeded MSEL(s) to delete.`);

    for (const msel of testMsels) {
      try {
        await deleteMsel(token, msel.id);
        console.log(`[Blueprint purge] Deleted MSEL ${msel.name} (${msel.id})`);
      } catch (err) {
        console.warn(`[Blueprint purge] Failed to delete MSEL ${msel.id}: ${err}`);
      }
    }

    // Units are global, not MSEL-scoped, so deleting the MSELs above does not remove
    // them — a leaked unit stays in every MSEL's contributor picker forever.
    //
    // Match on the generated-name *shape*, not a prefix allowlist. An earlier version of
    // this purge matched `TestBP-` plus a hand-maintained list of literal names, while the
    // specs generate ~50 different prefixes (DeleteUnit-, EditUnit-, SearchMatch-,
    // ViewUsers-, ViewList1-, ExpandUnit-Unit-, ...). It therefore swept none of them: a
    // live stack was found holding 11 leaked units. `isTempBlueprintName` closes that class
    // of hole for good — a new spec with a new prefix is covered automatically.
    const unitsRes = await blueprintCall<any[]>(token, '/api/units');
    if (unitsRes.ok) {
      const testUnits =
        unitsRes.data?.filter(
          (u: any) => isTempBlueprintName(u.name) || u.name === 'Create Catalog Test Unit'
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
      !!name && (isTempBlueprintName(name) || LEGACY_ADMIN_TEST_NAMES.includes(name));

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

    // Card / CITE action / CITE duty templates and groups have no MSEL, so the MSEL delete
    // above does not cascade to them. CITE action templates carry no name — the specs put
    // the tempBlueprintName() in the description instead.
    for (const [listPath, collection, label] of [
      ['/api/cards/templates', 'cards', 'card template'],
      ['/api/citeActions/templates', 'citeActions', 'CITE action template'],
      ['/api/citeDuties/templates', 'citeDuties', 'CITE duty template'],
      ['/api/groups', 'groups', 'group'],
    ] as const) {
      const res = await blueprintCall<any[]>(token, listPath);
      if (!res.ok) {
        console.warn(`[Blueprint purge] ${label} list failed (${res.status}); not purged.`);
        continue;
      }
      const leftovers =
        res.data?.filter((r: any) => isTempBlueprintName(r.name) || isTempBlueprintName(r.description)) ??
        [];
      console.log(`[Blueprint purge] Found ${leftovers.length} test ${label}(s) to delete.`);
      for (const record of leftovers) {
        await deleteBlueprintRecord(token, collection, record.id);
      }
    }

    // Competency frameworks and proficiency scales are global reference data. Frameworks go
    // first: the API refuses to delete one while a MSEL's competency pool references it, and
    // those references were cascaded away with the MSELs above.
    for (const [listPath, label] of [
      ['/api/competencyframeworks', 'competency framework'],
      ['/api/proficiencyScales', 'proficiency scale'],
    ] as const) {
      const res = await blueprintCall<any[]>(token, listPath);
      if (!res.ok) {
        console.warn(`[Blueprint purge] ${label} list failed (${res.status}); not purged.`);
        continue;
      }
      const leftovers = res.data?.filter((r: any) => isTempBlueprintName(r.name)) ?? [];
      console.log(`[Blueprint purge] Found ${leftovers.length} test ${label}(s) to delete.`);
      for (const record of leftovers) {
        const del = await blueprintCall(token, `${listPath}/${record.id}`, { method: 'DELETE' });
        if (!del.ok && del.status !== 404) {
          console.warn(`[Blueprint purge] Failed to delete ${label} ${record.id} (${del.status})`);
        }
      }
    }

    // Player application templates seeded by the player-applications specs live in Player, not
    // Blueprint. Only `TestBP-` names are swept, so other apps' templates are never touched.
    const playerCtx = await newContext();
    try {
      const res = await playerCtx.get(
        `${Services.Player.API.replace(/\/$/, '')}/api/application-templates`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (res.ok()) {
        const leftovers = ((await res.json()) as any[]).filter(
          (t) => t.name?.startsWith('TestBP-') && isTempBlueprintName(t.name)
        );
        console.log(`[Blueprint purge] Found ${leftovers.length} test Player application template(s) to delete.`);
        for (const t of leftovers) {
          await deletePlayerApplicationTemplate(token, t.id);
        }
      } else {
        console.warn(`[Blueprint purge] Player application template list failed (${res.status()}); not purged.`);
      }
    } finally {
      await playerCtx.dispose();
    }
  } catch (error) {
    console.warn(`[Blueprint purge] Error during cleanup: ${error}`);
  }
}

// ============================================================================
// SignalR group-membership probe
// ============================================================================

/**
 * Assert that a page's SignalR client has actually joined a MSEL's group, so that a propagation
 * assertion which follows is testing propagation rather than a lost join.
 *
 * Why this exists: joining a MSEL's group is fire-and-forget in the app. `home-app.component.ts`
 * calls `selectMsel` on a fixed 1s `setTimeout`; `join()` sets `isJoined` only if the connection is
 * *already* `Connected` at that instant and never retries; and `selectMsel()` handles only the
 * not-connected case — with the connection up but `isJoined` false it falls through every branch
 * and silently does nothing. Under load (the full suite at `--workers 2`) a client therefore ends
 * up connected and receiving `ADMIN_DATA_GROUP` traffic, but never added to the MSEL group, so it
 * receives none of that MSEL's updates.
 *
 * Probing it directly is what keeps the propagation specs honest: without this, a lost join looks
 * identical to "the push never arrived", and the failure blames SignalR delivery — which has been
 * measured healthy (20/20 delivered, median 4ms, p95 8ms).
 *
 * The probe seeds a throwaway scenario event and waits for it to appear. Measured while building
 * this: a `MselUpdated` description change does **not** reach the DOM (the UI keeps it in an akita
 * store), but a pushed scenario event does — so the event is the signal, not the description.
 *
 * Call this on a page that is already showing the MSEL's Scenario Events section.
 *
 * @param page - the page whose client is being checked
 * @param token - Blueprint API token
 * @param mselId - the MSEL whose group membership is required
 * @param timeoutMs - how long to wait for the pushed event to render
 */
export async function assertJoinedMselGroup(
  page: Page,
  token: string,
  mselId: string,
  timeoutMs = 30000
): Promise<void> {
  const marker = `GroupJoinProbe-${Date.now()}`;
  const probe = await createRenderableScenarioEvent(token, mselId, marker, {
    deltaSeconds: 59 * 60,
  });

  try {
    const joined = await page
      .waitForFunction((m: string) => document.body.innerText.includes(m), marker, {
        timeout: timeoutMs,
      })
      .then(() => true)
      .catch(() => false);

    if (!joined) {
      throw new Error(
        `SignalR: this page never received the pushed scenario event for MSEL ${mselId}, so its ` +
          `client is not in that MSEL's SignalR group. The group join is ` +
          `fire-and-forget: join() sets isJoined only when the connection is already Connected ` +
          `and never retries, and selectMsel() silently does nothing when connected && !isJoined. ` +
          `Broadcast delivery itself measures healthy (20/20, median 4ms), so this is a lost ` +
          `join, not a lost message.`
      );
    }
  } finally {
    try {
      await deleteScenarioEvent(token, probe.id);
    } catch (err) {
      console.warn(`assertJoinedMselGroup: failed to clean up probe event ${probe.id}: ${err}`);
    }
  }
}

// ============================================================================
// Player applications, invitations, MSEL roles and ad-hoc data fields
// ============================================================================
//
// All of these are MSEL-scoped and cascade-delete with their MSEL, so a spec that already
// deletes the MSEL in teardown needs no separate cleanup for them.

/** Create a Player application on a MSEL. `POST /api/playerApplications`. */
export async function createPlayerApplication(
  token: string,
  mselId: string,
  opts: { name?: string; url?: string; icon?: string; embeddable?: boolean } = {}
): Promise<{ id: string; name: string; url: string }> {
  const r = await blueprintCall<any>(token, '/api/playerApplications', {
    method: 'POST',
    body: {
      id: randomUUID(),
      mselId,
      name: opts.name ?? tempBlueprintName('TestBP-PlayerApp'),
      url: opts.url ?? 'https://example.test/app',
      icon: opts.icon ?? '',
      embeddable: opts.embeddable ?? true,
      loadInBackground: false,
    },
  });
  if (!r.ok) {
    throw new Error(`createPlayerApplication failed (${r.status}): ${r.text}`);
  }
  return { id: r.data.id, name: r.data.name, url: r.data.url };
}

/** A MSEL's Player applications — `GET /api/msels/{id}/playerApplications`. */
export async function listPlayerApplications(token: string, mselId: string): Promise<any[]> {
  const r = await blueprintCall<any[]>(token, `/api/msels/${mselId}/playerApplications`);
  if (!r.ok) {
    throw new Error(`listPlayerApplications failed (${r.status}): ${r.text}`);
  }
  return r.data ?? [];
}

/** A MSEL's Player-application ↔ team assignments — `GET /api/msels/{id}/teamplayerApplications`. */
export async function listPlayerApplicationTeams(token: string, mselId: string): Promise<any[]> {
  const r = await blueprintCall<any[]>(token, `/api/msels/${mselId}/teamplayerApplications`);
  if (!r.ok) {
    throw new Error(`listPlayerApplicationTeams failed (${r.status}): ${r.text}`);
  }
  return r.data ?? [];
}

/** A MSEL's invitations — `GET /api/msels/{id}/invitations`. */
export async function listInvitations(token: string, mselId: string): Promise<any[]> {
  const r = await blueprintCall<any[]>(token, `/api/msels/${mselId}/invitations`);
  if (!r.ok) {
    throw new Error(`listInvitations failed (${r.status}): ${r.text}`);
  }
  return r.data ?? [];
}

/**
 * Give a user a MSEL-level role (Owner, Editor, Approver, Evaluator, Viewer, ...) —
 * `POST /api/usermselroles`. Cascade-deletes with the MSEL.
 */
export async function addUserMselRole(
  token: string,
  mselId: string,
  userId: string,
  role: string
): Promise<{ id: string }> {
  const r = await blueprintCall<any>(token, '/api/usermselroles', {
    method: 'POST',
    body: { mselId, userId, role },
  });
  if (!r.ok) {
    throw new Error(`addUserMselRole(${role}) failed (${r.status}): ${r.text}`);
  }
  return { id: r.data.id };
}

/** Remove a MSEL-level role by its UserMselRole id. Swallows 404. */
export async function removeUserMselRole(token: string, userMselRoleId: string): Promise<void> {
  const r = await blueprintCall(token, `/api/usermselroles/${userMselRoleId}`, { method: 'DELETE' });
  if (!r.ok && r.status !== 404) {
    console.warn(`removeUserMselRole(${userMselRoleId}) returned ${r.status}: ${r.text}`);
  }
}

/**
 * Create a Player **application template** — the entries Blueprint's "Add Player Application"
 * menu offers, which it reads live from Player (`GET {Player.API}/api/application-templates`).
 * The Blueprint admin token is accepted by the Player API; creating a template needs Player's
 * ManageApplications permission, which the admin has.
 *
 * These live in Player, so no MSEL delete cascades to them: pair every call with
 * `deletePlayerApplicationTemplate`. Name them with `tempBlueprintName('TestBP-...')` so
 * `purgeAllBlueprintTestData` can sweep a leak.
 */
export async function createPlayerApplicationTemplate(
  token: string,
  opts: { name: string; url: string; icon?: string; embeddable?: boolean; loadInBackground?: boolean }
): Promise<{ id: string; name: string; url: string }> {
  const ctx = await newContext();
  try {
    const res = await ctx.post(`${Services.Player.API.replace(/\/$/, '')}/api/application-templates`, {
      headers: { Authorization: `Bearer ${token}` },
      data: {
        name: opts.name,
        url: opts.url,
        icon: opts.icon ?? '',
        embeddable: opts.embeddable ?? true,
        loadInBackground: opts.loadInBackground ?? false,
      },
    });
    if (!res.ok()) {
      throw new Error(`createPlayerApplicationTemplate failed (${res.status()}): ${await res.text()}`);
    }
    const data = await res.json();
    return { id: data.id, name: data.name, url: data.url };
  } finally {
    await ctx.dispose();
  }
}

/** Delete a Player application template by id. Swallows 404. */
export async function deletePlayerApplicationTemplate(token: string, templateId: string): Promise<void> {
  const ctx = await newContext();
  try {
    const res = await ctx.delete(
      `${Services.Player.API.replace(/\/$/, '')}/api/application-templates/${templateId}`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    if (!res.ok() && res.status() !== 404) {
      console.warn(`deletePlayerApplicationTemplate(${templateId}) returned ${res.status()}`);
    }
  } finally {
    await ctx.dispose();
  }
}

/**
 * Create one DataField on a MSEL with explicit flags — for specs that need a specific column
 * shape (e.g. an assessor-visible Checkbox) rather than the standard set `seedMselDataFields`
 * provides. `POST /api/dataFields`.
 */
export async function createDataField(
  token: string,
  mselId: string,
  field: { name: string; dataType: string; displayOrder: number } & Record<string, unknown>
): Promise<any> {
  const r = await blueprintCall<any>(token, '/api/dataFields', {
    method: 'POST',
    body: {
      mselId,
      onScenarioEventList: true,
      onExerciseView: false,
      isChosenFromList: false,
      isInformationField: false,
      isFacilitationField: false,
      isInitiallyHidden: false,
      dataOptions: [],
      ...field,
    },
  });
  if (!r.ok) {
    throw new Error(`createDataField(${field.name}) failed (${r.status}): ${r.text}`);
  }
  return r.data;
}

/**
 * Sign a page in to Blueprint as a specific (usually temporary) Keycloak user.
 *
 * The page's context must not carry the shared admin storageState. Keycloak's realm SSO
 * cookie would otherwise log it straight in as admin, and `prompt=login` pins the form to
 * the already-identified account, so the context's cookies are cleared after the first
 * redirect to force a full username+password form.
 */
export async function signInToBlueprintAs(
  page: Page,
  username: string,
  password: string,
  url: string = Services.Blueprint.UI
): Promise<void> {
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  // Let the app's own redirect to Keycloak finish first: on Firefox it otherwise aborts the
  // second goto (NS_BINDING_ABORTED).
  await page.waitForURL((u) => isKeycloakUrl(u), { timeout: 30000 });
  await page.context().clearCookies();
  await page.goto(url, { waitUntil: 'domcontentloaded' });

  const usernameField = page.getByRole('textbox', { name: /username/i });
  await expect(usernameField).toBeVisible({ timeout: 30000 });
  await usernameField.fill(username);
  await page.getByRole('textbox', { name: /password/i }).fill(password);
  await page.getByRole('button', { name: /sign in/i }).click();
  // Only "left Keycloak" is asserted: a deep link such as an invitation link may carry the
  // page straight on to another app once the OIDC callback completes.
  await page.waitForURL((u) => !isKeycloakUrl(u), { timeout: 30000 });
}

// ============================================================================
// Moves, Gallery cards, CITE actions/duties, and groups
// ============================================================================
//
// MSEL-scoped records (moves, cards, CITE actions/duties) are removed by the MSEL delete
// cascade, so a spec that seeds them on its own MSEL only needs `deleteMsel` in teardown.
// Templates (the admin-page cards/actions/duties, which have no `mselId`) and groups are
// global and must be deleted individually — `purgeAllBlueprintTestData` sweeps them too.

/**
 * Create a move on a MSEL. A new MSEL has no moves, so specs that need the Move pickers in
 * the card / CITE dialogs to offer anything must seed them.
 */
export async function createMove(
  token: string,
  mselId: string,
  opts: { moveNumber: number; deltaSeconds?: number; description?: string }
): Promise<any> {
  const r = await blueprintCall<any>(token, '/api/moves', {
    method: 'POST',
    body: {
      id: randomUUID(),
      mselId,
      moveNumber: opts.moveNumber,
      deltaSeconds: opts.deltaSeconds ?? opts.moveNumber * 600,
      description: opts.description ?? `Move ${opts.moveNumber}`,
      situationDescription: '',
      situationTime: new Date().toISOString(),
    },
  });
  if (!r.ok) {
    throw new Error(`createMove failed (${r.status}): ${r.text}`);
  }
  return r.data;
}

/**
 * List a MSEL-scoped collection (`moves`, `cards`, `citeActions`, `citeDuties`) — the
 * server-side check after a UI action, e.g. that the CITE dialog's "All Teams" fan-out
 * really created one record per team.
 */
export async function listMselRecords(
  token: string,
  mselId: string,
  collection: 'moves' | 'cards' | 'citeActions' | 'citeDuties'
): Promise<any[]> {
  const r = await blueprintCall<any[]>(token, `/api/msels/${mselId}/${collection}`);
  if (!r.ok) {
    throw new Error(`list ${collection} for MSEL ${mselId} failed (${r.status}): ${r.text}`);
  }
  return r.data ?? [];
}

/** List the global templates of a template-able collection. */
export async function listTemplates(
  token: string,
  collection: 'cards' | 'citeActions' | 'citeDuties'
): Promise<any[]> {
  const r = await blueprintCall<any[]>(token, `/api/${collection}/templates`);
  if (!r.ok) {
    throw new Error(`list ${collection} templates failed (${r.status}): ${r.text}`);
  }
  return r.data ?? [];
}

/**
 * Create a Gallery card template (no MSEL). Pair with `deleteBlueprintRecord('cards', id)`.
 */
export async function createCardTemplate(
  token: string,
  name: string,
  description: string
): Promise<any> {
  const r = await blueprintCall<any>(token, '/api/cards', {
    method: 'POST',
    body: { id: randomUUID(), name, description, isTemplate: true, move: 0, inject: 0 },
  });
  if (!r.ok) {
    throw new Error(`createCardTemplate failed (${r.status}): ${r.text}`);
  }
  return r.data;
}

/**
 * Delete one record from a flat Blueprint collection by id (`cards`, `citeActions`,
 * `citeDuties`, `moves`, `groups`). Swallows 404, so teardown can call it on a record
 * the test already deleted through the UI.
 */
export async function deleteBlueprintRecord(
  token: string,
  collection: 'cards' | 'citeActions' | 'citeDuties' | 'moves' | 'groups',
  id: string
): Promise<void> {
  const r = await blueprintCall(token, `/api/${collection}/${id}`, { method: 'DELETE' });
  if (!r.ok && r.status !== 404) {
    console.warn(`delete ${collection}/${id} returned ${r.status}: ${r.text}`);
  }
}

/** List every group. `GET /api/groups` is the admin list the Groups section renders. */
export async function listGroups(token: string): Promise<any[]> {
  const r = await blueprintCall<any[]>(token, '/api/groups');
  if (!r.ok) {
    throw new Error(`listGroups failed (${r.status}): ${r.text}`);
  }
  return r.data ?? [];
}

/** List a group's memberships (`{ id, groupId, userId }`). */
export async function listGroupMemberships(token: string, groupId: string): Promise<any[]> {
  const r = await blueprintCall<any[]>(token, `/api/groups/${groupId}/memberships`);
  if (!r.ok) {
    throw new Error(`listGroupMemberships(${groupId}) failed (${r.status}): ${r.text}`);
  }
  return r.data ?? [];
}

// ============================================================================
// CDK drag-and-drop
// ============================================================================

/**
 * Drag a CDK drag handle onto a target element with real pointer events.
 *
 * `locator.dragTo()` does not work for `cdkDrag`: it emits the whole move in a single jump,
 * and the CDK only starts a drag after the pointer has travelled past its 5px
 * `dragStartThreshold` *while held down*, then re-sorts the list on each subsequent move. So
 * the pointer is pressed on the handle, nudged past the threshold, walked to the vertical
 * centre of the target in small steps (each step lets the CDK re-sort), and released there.
 *
 * The CDK decides the drop index from the item the pointer is over, so dropping on the
 * target's centre puts the dragged item in the target's slot.
 *
 * @param page - Playwright Page object
 * @param handle - The element carrying `cdkDragHandle` (or the `cdkDrag` element itself)
 * @param target - The row/item whose slot the dragged item should take
 */
export async function cdkDragTo(page: Page, handle: Locator, target: Locator): Promise<void> {
  await handle.scrollIntoViewIfNeeded();
  const from = await handle.boundingBox();
  const to = await target.boundingBox();
  if (!from || !to) {
    throw new Error('cdkDragTo: handle or target has no bounding box (not rendered?)');
  }
  const x = from.x + from.width / 2;
  const startY = from.y + from.height / 2;
  const endY = to.y + to.height / 2;
  const direction = endY > startY ? 1 : -1;

  await page.mouse.move(x, startY);
  await page.mouse.down();
  await page.mouse.move(x, startY + direction * 10, { steps: 5 });
  await page.mouse.move(x, endY, { steps: 20 });
  await page.mouse.up();
}

// ============================================================================
// Competency frameworks, proficiency scales and MSEL competency pools
// ============================================================================
//
// Frameworks and scales are global reference data, not MSEL-scoped, so deleting a MSEL does
// not remove them. Seed them under a tempBlueprintName() so `purgeAllBlueprintTestData`
// sweeps any a crashed test leaves behind, and delete them in teardown. A framework cannot be
// deleted while a MSEL's competency pool references it — delete the MSEL first.

export interface SeedCompetency {
  idNumber: string;
  shortName?: string;
  description?: string;
  /** idNumber of another competency in the same seed list, which becomes this one's parent. */
  parentIdNumber?: string;
}

export interface CreatedCompetencyFramework {
  id: string;
  name: string;
  version: string;
  /** Seeded competencies keyed by idNumber. */
  competencies: Record<string, { id: string; idNumber: string; shortName: string }>;
}

/**
 * Create a competency framework, then its competencies one at a time (parents before
 * children, so a child can name its parent's id). Pair with `deleteCompetencyFramework`.
 */
export async function createCompetencyFramework(
  token: string,
  opts: {
    name?: string;
    version?: string;
    source?: string;
    description?: string;
    defaultProficiencyScaleId?: string;
    /** Unique across frameworks when set. */
    idNumber?: string;
    competencies?: SeedCompetency[];
  } = {}
): Promise<CreatedCompetencyFramework> {
  const name = opts.name ?? tempBlueprintName('TestBP-Framework');
  const version = opts.version ?? '1.0';
  const r = await blueprintCall<any>(token, '/api/competencyframeworks', {
    method: 'POST',
    body: {
      id: randomUUID(),
      name,
      version,
      source: opts.source ?? 'TEST',
      description: opts.description ?? 'Automated test framework; deleted on teardown.',
      defaultProficiencyScaleId: opts.defaultProficiencyScaleId ?? null,
      idNumber: opts.idNumber ?? null,
    },
  });
  if (!r.ok) {
    throw new Error(`createCompetencyFramework failed (${r.status}): ${r.text}`);
  }

  const framework: CreatedCompetencyFramework = {
    id: r.data.id,
    name: r.data.name,
    version: r.data.version,
    competencies: {},
  };
  for (const c of opts.competencies ?? []) {
    const parentId = c.parentIdNumber ? framework.competencies[c.parentIdNumber]?.id : null;
    const cr = await blueprintCall<any>(token, `/api/competencyframeworks/${framework.id}/competencies`, {
      method: 'POST',
      body: {
        id: randomUUID(),
        competencyFrameworkId: framework.id,
        parentId,
        idNumber: c.idNumber,
        shortName: c.shortName ?? c.idNumber,
        description: c.description ?? '',
      },
    });
    if (!cr.ok) {
      throw new Error(`create competency ${c.idNumber} failed (${cr.status}): ${cr.text}`);
    }
    framework.competencies[c.idNumber] = {
      id: cr.data.id,
      idNumber: cr.data.idNumber,
      shortName: cr.data.shortName,
    };
  }
  return framework;
}

/** Delete a competency framework and its competencies. Swallows 404. */
export async function deleteCompetencyFramework(token: string, frameworkId: string): Promise<void> {
  const r = await blueprintCall(token, `/api/competencyframeworks/${frameworkId}`, { method: 'DELETE' });
  if (!r.ok && r.status !== 404) {
    console.warn(`deleteCompetencyFramework(${frameworkId}) returned ${r.status}: ${r.text}`);
  }
}

/** Get one framework with its competencies. */
export async function getCompetencyFramework(token: string, frameworkId: string): Promise<any> {
  const r = await blueprintCall<any>(token, `/api/competencyframeworks/${frameworkId}`);
  if (!r.ok) {
    throw new Error(`getCompetencyFramework(${frameworkId}) failed (${r.status}): ${r.text}`);
  }
  return r.data;
}

/**
 * Find frameworks by exact name — for teardown of one the test created through the UI, whose
 * id the test never held. Returns every match, so a double-submit leaks nothing.
 */
export async function findCompetencyFrameworksByName(token: string, name: string): Promise<any[]> {
  const r = await blueprintCall<any[]>(token, '/api/competencyframeworks');
  if (!r.ok) {
    throw new Error(`list competency frameworks failed (${r.status}): ${r.text}`);
  }
  return (r.data ?? []).filter((f: any) => f.name === name);
}

/** Create a proficiency scale with optional levels. Pair with `deleteProficiencyScale`. */
export async function createProficiencyScale(
  token: string,
  opts: {
    name?: string;
    description?: string;
    levels?: { name: string; value: number; displayOrder?: number; description?: string }[];
  } = {}
): Promise<{ id: string; name: string }> {
  const name = opts.name ?? tempBlueprintName('TestBP-Scale');
  const r = await blueprintCall<any>(token, '/api/proficiencyScales', {
    method: 'POST',
    body: { name, description: opts.description ?? 'Automated test scale; deleted on teardown.' },
  });
  if (!r.ok) {
    throw new Error(`createProficiencyScale failed (${r.status}): ${r.text}`);
  }
  for (const [i, level] of (opts.levels ?? []).entries()) {
    const lr = await blueprintCall(token, '/api/proficiencyLevels', {
      method: 'POST',
      body: {
        proficiencyScaleId: r.data.id,
        name: level.name,
        value: level.value,
        displayOrder: level.displayOrder ?? i + 1,
        description: level.description ?? '',
      },
    });
    if (!lr.ok) {
      throw new Error(`create proficiency level ${level.name} failed (${lr.status}): ${lr.text}`);
    }
  }
  return { id: r.data.id, name: r.data.name };
}

/** Delete a proficiency scale (its levels go with it). Swallows 404. */
export async function deleteProficiencyScale(token: string, scaleId: string): Promise<void> {
  const r = await blueprintCall(token, `/api/proficiencyScales/${scaleId}`, { method: 'DELETE' });
  if (!r.ok && r.status !== 404) {
    console.warn(`deleteProficiencyScale(${scaleId}) returned ${r.status}: ${r.text}`);
  }
}

/** Find proficiency scales by exact name, for teardown of one created through the UI. */
export async function findProficiencyScalesByName(token: string, name: string): Promise<any[]> {
  const r = await blueprintCall<any[]>(token, '/api/proficiencyScales');
  if (!r.ok) {
    throw new Error(`list proficiency scales failed (${r.status}): ${r.text}`);
  }
  return (r.data ?? []).filter((s: any) => s.name === name);
}

/** Add a competency to a MSEL's competency pool. Deleted with the MSEL. */
export async function addCompetencyToMsel(
  token: string,
  mselId: string,
  competencyId: string
): Promise<{ id: string }> {
  const r = await blueprintCall<any>(token, '/api/mselcompetencies', {
    method: 'POST',
    body: { mselId, competencyId },
  });
  if (!r.ok) {
    throw new Error(`addCompetencyToMsel failed (${r.status}): ${r.text}`);
  }
  return { id: r.data.id };
}

/** List a MSEL's team-to-competency assignments (`{ id, teamId, competencyId }`). */
export async function listMselTeamCompetencies(token: string, mselId: string): Promise<any[]> {
  const r = await blueprintCall<any[]>(token, `/api/msels/${mselId}/teamcompetencies`);
  if (!r.ok) {
    throw new Error(`listMselTeamCompetencies(${mselId}) failed (${r.status}): ${r.text}`);
  }
  return r.data ?? [];
}

/**
 * Fill a dialog's inputs and confirm every one of them still holds its value.
 *
 * Under parallel load, Firefox sometimes drops a Playwright fill: a field typed a moment
 * earlier reads empty again by the time Save is clicked, and the request goes out without
 * it. (A probe that logged the DOM and the POST body showed this for both text and number
 * inputs, and never for a real typist.) Re-reading every field after the batch and retrying
 * the whole batch keeps the dialog from being saved half-filled.
 */
export async function fillDialogFields(fields: Array<[Locator, string]>): Promise<void> {
  await expect(async () => {
    for (const [input, value] of fields) {
      if ((await input.inputValue()) !== value) await input.fill(value);
    }
    for (const [input, value] of fields) {
      expect(await input.inputValue()).toBe(value);
    }
  }).toPass({ timeout: 15000, intervals: [100, 250, 500, 1000] });
}

/**
 * Create an option-list DataField (`isChosenFromList`) with its DataOptions in one
 * `POST /api/dataFields` — the API creates the field's options in the same call. Options are
 * `{ optionName, optionValue }`: the UI labels `optionName` "ID" and `optionValue` "Name" /
 * "Description", and a scenario event's dropdown shows `optionName` but stores `optionValue`.
 * Cascade-deletes with its MSEL.
 */
export async function createOptionListDataField(
  token: string,
  mselId: string,
  name: string,
  options: Array<{ optionName: string; optionValue: string }>,
  field: { dataType?: string; displayOrder?: number } & Record<string, unknown> = {}
): Promise<any> {
  const id = randomUUID();
  return createDataField(token, mselId, {
    dataType: 'String',
    displayOrder: 100,
    onExerciseView: true,
    isShownOnDefaultTab: true,
    ...field,
    id,
    name,
    isChosenFromList: true,
    dataOptions: options.map((o, i) => ({
      id: randomUUID(),
      dataFieldId: id,
      displayOrder: i + 1,
      ...o,
    })),
  });
}
