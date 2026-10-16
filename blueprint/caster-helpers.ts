// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

/**
 * Helpers for Blueprint's Caster integration.
 *
 * A push from a MSEL that uses Caster creates a workspace in the MSEL's Caster directory, writes
 * a `blueprint-<msel id>.auto.tfvars` file into it and plans and applies it. Removing integrations
 * destroys and deletes that workspace. The tests seed their own Caster project and directory
 * holding a template that only declares variables: it creates no resources, so plan and apply
 * finish in seconds and need no hypervisor, while the vars file still shows which variable each
 * team's Player team ID was written to.
 *
 * Token acquisition mirrors `getBlueprintToken`: the Caster token comes from the `caster.ui`
 * session that global-setup.ts captures in `.auth/caster-session.json`.
 */

import { request as playwrightRequest } from '@playwright/test';
import fs from 'fs';
import { Services } from '../shared-fixtures';
import { authSessionStatePath } from '../auth-paths';
import { blueprintCall, tempBlueprintName } from './test-helpers';

let _cachedCasterToken: string | null = null;

/**
 * Acquire a Caster-scoped bearer token from the pre-authenticated `caster.ui` session.
 */
export async function getCasterToken(): Promise<string> {
  if (_cachedCasterToken) return _cachedCasterToken;

  const sessionPath = authSessionStatePath('caster');
  if (!fs.existsSync(sessionPath)) {
    throw new Error(
      `Caster sessionStorage auth state not found at ${sessionPath}. ` +
      `Run global-setup.ts first to provision authentication.`
    );
  }

  const sessionData: Array<[string, string]> = JSON.parse(fs.readFileSync(sessionPath, 'utf8'));
  const oidcEntry = sessionData.find(([key]) => key.includes('oidc.user:'));
  if (!oidcEntry) {
    throw new Error(`No oidc.user entry in ${sessionPath}`);
  }

  const token = JSON.parse(oidcEntry[1]).access_token as string;
  if (!token) {
    throw new Error(`No access_token in the Caster sessionStorage OIDC payload`);
  }

  _cachedCasterToken = token;
  return token;
}

async function casterCall<T = any>(
  token: string,
  path: string,
  opts: { method?: 'GET' | 'POST' | 'PUT' | 'DELETE'; body?: any } = {}
): Promise<{ ok: boolean; status: number; data: T; text: string }> {
  const base = Services.Caster.API.replace(/\/$/, '');
  const ctx = await playwrightRequest.newContext({ ignoreHTTPSErrors: true });
  try {
    const res = await ctx.fetch(`${base}${path}`, {
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
// Caster template seeding
// ============================================================================

const BLUEPRINT_VARIABLES = [
  'variable "exercise_id" { type = string }',
  'variable "view_id" { type = string }',
  'variable "user_id" { type = string }',
  'variable "username" { type = string }',
  '',
  '# team variables',
  'variable "blue_cell" { type = string }',
  'variable "red_cell" {}',
  'variable "spare_cell" {',
  '  type    = string',
  '  default = null',
  '}',
  '',
  '# cannot take a team ID',
  'variable "vm_count" { type = number }',
  'variable "region" { type = string }',
];

// assigned here, so a team ID cannot go in it
const TERRAFORM_TFVARS = { name: 'terraform.tfvars', content: 'vm_count = 0\nregion = "lab"\n' };

/**
 * A template that only declares variables. The four Blueprint variables are what every push
 * writes; `blue_cell`, `red_cell` and `spare_cell` take team IDs, the first two with no default,
 * so a push needs a team for each; the rest are declarations that cannot take a team ID, which
 * the team-variables endpoint has to leave out.
 *
 * `sensitive` needs terraform 0.14, and a directory with no terraform version of its own gets
 * Caster's default, 0.12.29, so this template is for reading only. Push with
 * `APPLYABLE_TEMPLATE`.
 */
export const VARIABLES_ONLY_TEMPLATE: Array<{ name: string; content: string }> = [
  {
    name: 'variables.tf',
    content: [
      ...BLUEPRINT_VARIABLES,
      'variable "secret" {',
      '  type      = string',
      '  sensitive = true',
      '}',
      '',
    ].join('\n'),
  },
  TERRAFORM_TFVARS,
];

/** `VARIABLES_ONLY_TEMPLATE` without the sensitive variable, so any terraform version can apply it. */
export const APPLYABLE_TEMPLATE: Array<{ name: string; content: string }> = [
  { name: 'variables.tf', content: [...BLUEPRINT_VARIABLES, ''].join('\n') },
  TERRAFORM_TFVARS,
];

/** The team variables `VARIABLES_ONLY_TEMPLATE` leaves open, as the API returns them. */
export const VARIABLES_ONLY_TEMPLATE_TEAM_VARIABLES = [
  { name: 'blue_cell', required: true },
  { name: 'red_cell', required: true },
  { name: 'spare_cell', required: false },
];

export interface CasterTemplate {
  projectId: string;
  directoryId: string;
}

/**
 * Create a Caster project and directory holding `files`. Pair with `deleteCasterTemplate`.
 */
export async function createCasterTemplate(
  token: string,
  files: Array<{ name: string; content: string }> = VARIABLES_ONLY_TEMPLATE
): Promise<CasterTemplate> {
  const project = await casterCall<any>(token, '/api/projects', {
    method: 'POST',
    body: { name: tempBlueprintName('TestBP-Caster') },
  });
  if (!project.ok) throw new Error(`create Caster project failed (${project.status}): ${project.text}`);

  const directory = await casterCall<any>(token, '/api/directories', {
    method: 'POST',
    body: { name: 'template', projectId: project.data.id },
  });
  if (!directory.ok) throw new Error(`create Caster directory failed (${directory.status}): ${directory.text}`);

  for (const file of files) {
    const created = await casterCall<any>(token, '/api/files', {
      method: 'POST',
      body: { name: file.name, directoryId: directory.data.id, content: file.content },
    });
    if (!created.ok) throw new Error(`create Caster file ${file.name} failed (${created.status}): ${created.text}`);
  }

  return { projectId: project.data.id, directoryId: directory.data.id };
}

/** Delete a seeded Caster project. Safe on a missing id. */
export async function deleteCasterTemplate(token: string, template?: CasterTemplate): Promise<void> {
  if (!template) return;
  const r = await casterCall(token, `/api/projects/${template.projectId}`, { method: 'DELETE' });
  if (!r.ok && r.status !== 404) {
    console.warn(`deleteCasterTemplate(${template.projectId}) returned ${r.status}: ${r.text}`);
  }
}

/** Fetch a Caster workspace, or `null` once it has been deleted. */
export async function getCasterWorkspace(token: string, workspaceId: string): Promise<any | null> {
  const r = await casterCall<any>(token, `/api/workspaces/${workspaceId}`);
  if (r.status === 404) return null;
  if (!r.ok) throw new Error(`getCasterWorkspace(${workspaceId}) failed (${r.status}): ${r.text}`);
  return r.data;
}

/** The content of the vars file Blueprint wrote into a workspace. */
export async function getBlueprintVarsFile(
  token: string,
  directoryId: string,
  workspaceId: string
): Promise<string> {
  const r = await casterCall<any[]>(token, `/api/directories/${directoryId}/files?includeContent=true`);
  if (!r.ok) throw new Error(`list Caster files failed (${r.status}): ${r.text}`);
  const file = r.data.find(f => f.workspaceId === workspaceId && /^blueprint-.*\.auto\.tfvars$/.test(f.name));
  if (!file) throw new Error(`No Blueprint vars file in workspace ${workspaceId}`);
  return file.content as string;
}

/** Fetch a Caster run. */
export async function getCasterRun(token: string, runId: string): Promise<any> {
  const r = await casterCall<any>(token, `/api/runs/${runId}`);
  if (!r.ok) throw new Error(`getCasterRun(${runId}) failed (${r.status}): ${r.text}`);
  return r.data;
}

// ============================================================================
// Blueprint side
// ============================================================================

/** The template variables Blueprint offers as Topology Teams for a directory. */
export async function getCasterTeamVariables(
  token: string,
  directoryId: string
): Promise<{ ok: boolean; status: number; data: Array<{ name: string; required: boolean }>; text: string }> {
  return blueprintCall(token, `/api/caster/directories/${directoryId}/team-variables`);
}

/**
 * Update a team. `PUT /api/teams/{id}` replaces the whole object, so this merges `changes`
 * into the current team. Returns the response so a rejection can be asserted.
 */
export async function tryUpdateTeam(
  token: string,
  teamId: string,
  changes: Record<string, unknown>
): Promise<{ ok: boolean; status: number; data: any; text: string }> {
  const current = await blueprintCall<any>(token, `/api/teams/${teamId}`);
  if (!current.ok) throw new Error(`get team ${teamId} failed (${current.status}): ${current.text}`);
  return blueprintCall<any>(token, `/api/teams/${teamId}`, {
    method: 'PUT',
    body: { ...current.data, ...changes },
  });
}

/** Start a push. Returns the response so a refused push can be asserted. */
export async function pushIntegrations(token: string, mselId: string) {
  return blueprintCall<any>(token, `/api/msels/${mselId}/integrations`, { method: 'POST' });
}

/** Start a remove. */
export async function removeIntegrations(token: string, mselId: string) {
  return blueprintCall<any>(token, `/api/msels/${mselId}/integrations`, { method: 'DELETE' });
}

/**
 * Poll a MSEL until `done` holds. A failed push or remove leaves the MSEL in Pushing or
 * Pulling with an `ERROR: ...` integration status, so that ends the wait too, failing with
 * the error rather than running out the clock.
 */
export async function waitForMsel(
  token: string,
  mselId: string,
  done: (msel: any) => boolean,
  timeout = 240_000
): Promise<any> {
  const deadline = Date.now() + timeout;
  for (;;) {
    const r = await blueprintCall<any>(token, `/api/msels/${mselId}`);
    if (!r.ok) throw new Error(`get MSEL ${mselId} failed (${r.status}): ${r.text}`);
    const msel = r.data;
    if (done(msel)) return msel;
    if (/^ERROR/i.test(msel.integrationStatus ?? '')) {
      throw new Error(`MSEL ${mselId} integration failed: ${msel.integrationStatus}`);
    }
    if (Date.now() > deadline) {
      throw new Error(`MSEL ${mselId} still ${msel.status} / ${msel.integrationStatus} after ${timeout} ms`);
    }
    // a push runs in Blueprint's background queue, so there is no response to wait on
    await new Promise(resolve => setTimeout(resolve, 3000));
  }
}
