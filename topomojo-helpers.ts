// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

/**
 * TopoMojo API helpers for tests across Crucible apps.
 *
 * Lives at the repo root so Gameboard, Alloy, Steamfitter, etc., can share
 * the same workspace/challenge-creation flows. Tests that need a TopoMojo
 * workspace (for example, Gameboard challenges that link back to a TopoMojo
 * workspace id) create one here, exercise the scenario, then delete it.
 *
 * TopoMojo listens on http://localhost:5000 by default. The `topomojo.ui`
 * public OIDC client accepts password grants against the `crucible` realm.
 */

import { APIRequestContext, request as playwrightRequest } from '@playwright/test';
import { Services } from './shared-fixtures';
export const TOPOMOJO_API_CANDIDATES = [
  process.env.TOPOMOJO_API_URL?.replace(/\/$/, ''),
  Services.TopoMojo.API,
].filter((x): x is string => !!x);

let _resolvedTopoApi: string | null = null;

async function newContext(): Promise<APIRequestContext> {
  return playwrightRequest.newContext({ ignoreHTTPSErrors: true });
}

export async function resolveTopoApiBase(): Promise<string> {
  if (_resolvedTopoApi) return _resolvedTopoApi;
  const ctx = await newContext();
  try {
    for (const candidate of TOPOMOJO_API_CANDIDATES) {
      try {
        // Unauthenticated ping should at least return a non-network-error HTTP code.
        const res = await ctx.fetch(`${candidate}/api/workspaces`, { timeout: 3000 });
        if (res.status() === 401 || res.ok()) {
          _resolvedTopoApi = candidate;
          return candidate;
        }
      } catch { /* try next */ }
    }
  } finally {
    await ctx.dispose();
  }
  throw new Error(`Could not reach TopoMojo API at any of: ${TOPOMOJO_API_CANDIDATES.join(', ')}`);
}

/**
 * Acquire a TopoMojo-scoped bearer token using the `topomojo.ui` public client.
 * Default credentials are `admin`/`admin` (the seed Keycloak admin who is
 * granted the TopoMojo Creator role in the `crucible` realm).
 */
export async function getTopoMojoAdminToken(
  username: string = 'admin',
  password: string = 'admin'
): Promise<string> {
  const ctx = await newContext();
  try {
    const keycloak = Services.Keycloak.replace(/\/$/, '');
    const res = await ctx.post(
      `${keycloak}/realms/crucible/protocol/openid-connect/token`,
      {
        form: {
          client_id: 'topomojo.ui',
          grant_type: 'password',
          username,
          password,
          scope: 'openid profile topomojo',
        },
      }
    );
    if (!res.ok()) {
      throw new Error(`TopoMojo token request failed (${res.status()}): ${await res.text()}`);
    }
    const data = await res.json();
    return data.access_token as string;
  } finally {
    await ctx.dispose();
  }
}

interface ApiOpts {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  body?: any;
  query?: Record<string, string | number | boolean | undefined>;
  /**
   * Extra request headers. Needed for endpoints taking a bare `[FromBody] string`:
   * Playwright sends a string `data` as text/plain, which those reject with 415,
   * so the caller has to JSON-encode the body and say so here.
   */
  headers?: Record<string, string>;
}

async function tmCall<T = any>(
  token: string,
  path: string,
  opts: ApiOpts = {}
): Promise<{ ok: boolean; status: number; data: T; text: string }> {
  const base = await resolveTopoApiBase();
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
      headers: { Authorization: `Bearer ${token}`, ...opts.headers },
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

export interface CreatedWorkspace {
  id: string;
  name: string;
  audience: string | null;
}

export interface CreateWorkspaceOptions {
  name?: string;
  description?: string;
  /**
   * Space-separated audience tokens. For Gameboard to see this workspace,
   * include `gameboard`. Defaults to `gameboard everyone`. Pass an empty
   * string or null to explicitly leave the workspace audience blank (so
   * Gameboard cannot see it — useful for permission-restriction tests).
   */
  audience?: string | null;
  author?: string;
  tags?: string;
  /**
   * Challenge spec JSON string (YAML-derived). If omitted, the workspace has
   * no challenge content but still exists and is addressable by id.
   */
  challenge?: string;
  durationMinutes?: number;
}

/**
 * Create a workspace via the TopoMojo API. Returns the workspace id —
 * pair every call with `deleteWorkspace` in test teardown.
 *
 * After creation, this helper also PUTs the full workspace body so that
 * `audience` is applied (POST /api/workspace uses a subset of fields and
 * does not always persist the `audience` field reliably).
 */
export async function createWorkspace(
  token: string,
  opts: CreateWorkspaceOptions = {}
): Promise<CreatedWorkspace> {
  const name = opts.name ?? `TestWorkspace-${Date.now()}-${Math.floor(Math.random() * 1_000_000)}`;
  // Default audience includes `gameboard` so Gameboard can discover it.
  const audience = opts.audience === undefined ? 'gameboard everyone' : (opts.audience ?? '');

  const createBody = {
    name,
    description: opts.description ?? 'Automated test workspace; deleted on teardown.',
    tags: opts.tags ?? 'test',
    audience,
    author: opts.author ?? 'Crucible Tests',
    challenge: opts.challenge ?? '',
    document: '',
    templateScope: '',
    templateLimit: 3,
  };

  const createRes = await tmCall<any>(token, '/api/workspace', {
    method: 'POST',
    body: createBody,
  });
  if (!createRes.ok) {
    throw new Error(`createWorkspace failed (${createRes.status}): ${createRes.text}`);
  }
  const id = createRes.data.id as string;

  // Apply full settings via PUT so audience/duration are persisted.
  const putBody = {
    id,
    name,
    description: createBody.description,
    tags: createBody.tags,
    author: createBody.author,
    audience,
    templateScope: '',
    templateLimit: 3,
    durationMinutes: opts.durationMinutes ?? 60,
  };
  const putRes = await tmCall(token, '/api/workspace', {
    method: 'PUT',
    body: putBody,
  });
  if (!putRes.ok) {
    // Not fatal — keep the workspace and return what we have. Some Topomojo
    // builds make PUT fields strict.
    console.warn(`createWorkspace PUT settings returned ${putRes.status}: ${putRes.text}`);
  }

  return { id, name, audience: audience || null };
}

export async function deleteWorkspace(token: string, workspaceId: string): Promise<void> {
  const r = await tmCall(token, `/api/workspace/${workspaceId}`, { method: 'DELETE' });
  if (!r.ok && r.status !== 404) {
    console.warn(`deleteWorkspace(${workspaceId}) returned ${r.status}`);
  }
}

/**
 * Write the workspace's markdown document. Stored as `<DocRoot>/<id>.md`, a
 * sibling of the `<DocRoot>/<id>/` directory that holds the document's images.
 */
export async function saveWorkspaceDocument(
  token: string,
  workspaceId: string,
  text: string
): Promise<void> {
  const r = await tmCall(token, `/api/document/${workspaceId}`, {
    method: 'PUT',
    body: JSON.stringify(text),
    headers: { 'Content-Type': 'application/json' },
  });
  if (!r.ok) {
    throw new Error(`saveWorkspaceDocument(${workspaceId}) returned ${r.status}: ${r.text}`);
  }
}

/**
 * Read the workspace's markdown document, or null when the endpoint refuses.
 * The API returns the markdown as a JSON string; older builds send it as
 * text/plain, so fall back to the raw body.
 */
export async function loadWorkspaceDocument(
  token: string,
  workspaceId: string
): Promise<string | null> {
  const r = await tmCall<string>(token, `/api/document/${workspaceId}`);
  if (!r.ok) return null;
  return typeof r.data === 'string' ? r.data : r.text;
}

export interface DocumentImage {
  filename: string;
}

export async function listDocumentImages(
  token: string,
  workspaceId: string
): Promise<string[]> {
  const r = await tmCall<DocumentImage[]>(token, `/api/images/${workspaceId}`);
  if (!r.ok) {
    throw new Error(`listDocumentImages(${workspaceId}) returned ${r.status}: ${r.text}`);
  }
  return (r.data ?? []).map((i) => i.filename);
}

/**
 * Upload a document image. The API sanitizes the name and appends a random
 * suffix, so the stored filename it returns will not match `filename`.
 */
export async function uploadDocumentImage(
  token: string,
  workspaceId: string,
  filename: string,
  contents: Buffer
): Promise<string> {
  const base = await resolveTopoApiBase();
  const ctx = await newContext();
  try {
    const res = await ctx.fetch(`${base}/api/image/${workspaceId}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      multipart: {
        file: { name: filename, mimeType: 'image/png', buffer: contents },
      },
    });
    const text = await res.text();
    if (!res.ok()) {
      throw new Error(`uploadDocumentImage(${workspaceId}) returned ${res.status()}: ${text}`);
    }
    return JSON.parse(text).filename as string;
  } finally {
    await ctx.dispose();
  }
}

/**
 * Delete a document image by name. Returns the raw status so callers can assert
 * a rejection; `filename` is sent as a query parameter exactly as given, which
 * is what lets a test submit a traversing name.
 */
export async function deleteDocumentImage(
  token: string,
  workspaceId: string,
  filename: string
): Promise<number> {
  const r = await tmCall(token, `/api/image/${workspaceId}`, {
    method: 'DELETE',
    query: { filename },
  });
  return r.status;
}

/**
 * Write a challenge spec into a workspace. The challenge spec is typically
 * authored as YAML in the TopoMojo UI Challenge tab but is stored as a JSON
 * string on the workspace. For simple tests we can store any arbitrary JSON
 * shape (Gameboard only cares that the workspace exists and has an id).
 */
export async function setWorkspaceChallenge(
  token: string,
  workspaceId: string,
  challengeJson: object
): Promise<void> {
  const r = await tmCall(token, `/api/challenge/${workspaceId}`, {
    method: 'PUT',
    body: challengeJson,
  });
  if (!r.ok) {
    throw new Error(`setWorkspaceChallenge(${workspaceId}) failed (${r.status}): ${r.text}`);
  }
}

/**
 * Set the workspace's `audience` tokens (space-separated). Include `gameboard`
 * to make it visible to Gameboard's challenge search; omit `gameboard` (or
 * set to empty) to restrict visibility.
 */
export async function setWorkspaceAudience(
  token: string,
  workspaceId: string,
  audience: string
): Promise<void> {
  // Fetch current workspace, then PUT back with updated audience.
  const cur = await tmCall<any>(token, `/api/workspace/${workspaceId}`);
  if (!cur.ok) {
    throw new Error(`Could not fetch workspace ${workspaceId} (${cur.status}): ${cur.text}`);
  }
  const body = {
    id: workspaceId,
    name: cur.data.name,
    description: cur.data.description,
    tags: cur.data.tags,
    author: cur.data.author,
    audience,
    templateScope: cur.data.templateScope,
    templateLimit: cur.data.templateLimit,
    durationMinutes: cur.data.durationMinutes ?? 60,
  };
  const r = await tmCall(token, '/api/workspace', { method: 'PUT', body });
  if (!r.ok) {
    throw new Error(`setWorkspaceAudience failed (${r.status}): ${r.text}`);
  }
}

/** One question of a challenge variant, as TopoMojo authored it. */
export interface TopoMojoChallengeQuestion {
  text: string;
  answer: string;
  weight?: number;
  [key: string]: unknown;
}

/** A variant of a challenge. `mod_topomojo` imports one of these per deployed gamespace. */
export interface TopoMojoChallengeVariant {
  text?: string;
  sections?: { name?: string; questions?: TopoMojoChallengeQuestion[] }[];
}

export interface TopoMojoChallengeSpec {
  text?: string;
  /** Substitutions resolved at deploy time. When non-empty a variant's stored answer is only a template. */
  transforms?: unknown[];
  variants?: TopoMojoChallengeVariant[];
}

/**
 * The challenge spec a workspace holds, which is the authoring source for every
 * answer a gamespace deployed from it will grade against.
 *
 * The workspace GET returns `challenge` as a JSON *string* rather than an object —
 * it is stored that way, as `setWorkspaceChallenge` notes — so it is parsed here.
 */
export async function getWorkspaceChallengeSpec(
  token: string,
  workspaceId: string
): Promise<TopoMojoChallengeSpec> {
  const r = await tmCall<any>(token, `/api/workspace/${workspaceId}`);
  if (!r.ok || !r.data) {
    throw new Error(`getWorkspaceChallengeSpec(${workspaceId}) failed (${r.status}): ${r.text}`);
  }
  const challenge = r.data.challenge;
  if (!challenge) {
    throw new Error(`Workspace ${workspaceId} has no challenge spec.`);
  }
  return typeof challenge === 'string' ? JSON.parse(challenge) : challenge;
}

/**
 * The questions of one variant, in the order `qorder` counts them.
 *
 * Flattened across the variant's sections and 1-based, matching how
 * `mod_topomojo\questionmanager` assigns qorder at import: indexing a single
 * section instead would place a question in a multi-section challenge wrongly.
 *
 * @param variant 1-based, as the plugin stores it.
 */
export function challengeQuestionsForVariant(
  spec: TopoMojoChallengeSpec,
  variant: number
): TopoMojoChallengeQuestion[] {
  const variants = spec.variants ?? [];
  const chosen = variants[variant - 1];
  if (!chosen) {
    throw new Error(`Challenge has no variant ${variant}; it has ${variants.length}.`);
  }
  return (chosen.sections ?? []).flatMap(section => section.questions ?? []);
}

export async function listWorkspaces(
  token: string,
  query: { term?: string; aud?: string; take?: number } = {}
): Promise<any[]> {
  const r = await tmCall<any[]>(token, '/api/workspaces', { query });
  if (!r.ok) {
    throw new Error(`listWorkspaces failed (${r.status}): ${r.text}`);
  }
  return r.data ?? [];
}

/**
 * A gamespace as TopoMojo reports it. Only the fields mod_topomojo's bulk-deploy
 * launcher reads are typed; the API returns considerably more.
 */
export interface TopoMojoGamespace {
  id: string;
  isActive?: boolean;
  /** ISO 8601 with a fractional-second component, e.g. `2026-09-09T22:47:26.0021833+00:00`. */
  expirationTime?: string | null;
  /**
   * Only ever populated by `POST /api/gamespace`, which mints a one-time ticket
   * token and embeds it in the URL. The GET never sets it, so a poll response
   * always reports null here.
   */
  launchpointUrl?: string | null;
  /** 0-based. mod_topomojo stores `variant + 1`. */
  variant?: number;
  vms?: unknown[];
  [key: string]: unknown;
}

export interface RegisterGamespaceOptions {
  workspaceId: string;
  /** 0 means "no limit was requested". Maps to the payload's `maxMinutes`. */
  maxMinutes?: number;
  maxAttempts?: number;
  points?: number;
  /** 0 asks TopoMojo to pick a variant at random. */
  variant?: number;
  subjectId?: string;
  subjectName?: string;
}

/**
 * Register and start a gamespace, mirroring the payload
 * `mod_topomojo\local\bulkdeploy\payload_builder::build()` sends. Pair every
 * call with `deleteGamespace` in test teardown — a live gamespace holds real VMs.
 */
export async function registerGamespace(
  token: string,
  opts: RegisterGamespaceOptions
): Promise<TopoMojoGamespace> {
  const subjectId = opts.subjectId ?? `e2e-${Date.now()}`;
  const body = {
    resourceId: opts.workspaceId,
    startGamespace: true,
    allowPreview: false,
    allowReset: false,
    maxAttempts: opts.maxAttempts ?? 0,
    maxMinutes: opts.maxMinutes ?? 30,
    points: opts.points ?? 100,
    variant: opts.variant ?? 0,
    players: [{ subjectId, subjectName: opts.subjectName ?? subjectId }],
  };
  const r = await tmCall<TopoMojoGamespace>(token, '/api/gamespace', { method: 'POST', body });
  if (!r.ok || !r.data?.id) {
    throw new Error(`registerGamespace(${opts.workspaceId}) failed (${r.status}): ${r.text}`);
  }
  return r.data;
}

/** Reads a gamespace back, the way the bulk-deploy wait phase polls it. */
export async function getGamespace(token: string, gamespaceId: string): Promise<TopoMojoGamespace> {
  const r = await tmCall<TopoMojoGamespace>(token, `/api/gamespace/${gamespaceId}`);
  if (!r.ok || !r.data) {
    throw new Error(`getGamespace(${gamespaceId}) failed (${r.status}): ${r.text}`);
  }
  return r.data;
}

/**
 * Tears a gamespace down and releases its VMs. Tolerates 404 so teardown is
 * safe to call unconditionally.
 */
export async function deleteGamespace(token: string, gamespaceId: string): Promise<void> {
  const r = await tmCall(token, `/api/gamespace/${gamespaceId}`, { method: 'DELETE' });
  if (!r.ok && r.status !== 404) {
    console.warn(`deleteGamespace(${gamespaceId}) returned ${r.status}: ${r.text}`);
  }
}

/**
 * Polls until the gamespace reports itself active with at least one VM — the
 * same readiness condition `launcher::wait_phase()` waits on.
 */
export async function waitForGamespaceReady(
  token: string,
  gamespaceId: string,
  timeoutMs: number = 180_000,
  intervalMs: number = 5_000
): Promise<TopoMojoGamespace> {
  const deadline = Date.now() + timeoutMs;
  let last: TopoMojoGamespace | undefined;
  while (Date.now() < deadline) {
    last = await getGamespace(token, gamespaceId);
    if (last.isActive && Array.isArray(last.vms) && last.vms.length > 0) {
      return last;
    }
    await new Promise(resolve => setTimeout(resolve, intervalMs));
  }
  throw new Error(
    `Gamespace ${gamespaceId} was not ready within ${timeoutMs}ms `
    + `(last seen isActive=${last?.isActive}, vms=${Array.isArray(last?.vms) ? last?.vms.length : 'none'})`
  );
}
