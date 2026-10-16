// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: alloy/alloy-test-plan.md

// A request Alloy cannot carry out answers with a status code and a ProblemDetails.title the user
// can act on, rather than a 500 "A server error occurred." or an empty 204.

import { APIRequestContext, expect, request as playwrightRequest, test } from '@playwright/test';
import {
  createKeycloakUser,
  deleteKeycloakUser,
  getKeycloakAdminToken,
  getUserToken,
  KeycloakUser,
  tempUsername,
} from '../../../keycloak-admin';
import { Services } from '../../../shared-fixtures';

const ALLOY_SCOPE = 'openid profile player player-vm alloy caster steamfitter';

interface ApiResult<T = any> {
  ok: boolean;
  status: number;
  data: T;
  text: string;
}

async function newContext(): Promise<APIRequestContext> {
  return playwrightRequest.newContext({ ignoreHTTPSErrors: true });
}

async function apiCall<T = any>(
  token: string,
  path: string,
  options: { method?: 'GET' | 'POST' | 'PUT' | 'DELETE'; body?: any } = {}
): Promise<ApiResult<T>> {
  const base = Services.Alloy.API.replace(/\/$/, '');
  const ctx = await newContext();
  try {
    const response = await ctx.fetch(`${base}${path}`, {
      method: options.method ?? 'GET',
      headers: { Authorization: `Bearer ${token}` },
      data: options.body,
    });
    const text = await response.text();
    let data: any;
    try {
      data = text ? JSON.parse(text) : undefined;
    } catch {
      data = undefined;
    }
    return { ok: response.ok(), status: response.status(), data, text };
  } finally {
    await ctx.dispose();
  }
}

function uniqueName(prefix: string): string {
  return `${prefix} ${Date.now()} ${Math.floor(Math.random() * 1_000_000)}`;
}

async function createEventTemplate(token: string, isPublished = false): Promise<string> {
  const result = await apiCall<{ id: string }>(token, '/api/eventTemplates', {
    method: 'POST',
    body: {
      name: uniqueName('ZZ Error Messages Template'),
      description: 'Automated error message test. Will be deleted after the test.',
      durationHours: 1,
      useDynamicHost: false,
      isPublished,
    },
  });
  if (!result.ok) {
    throw new Error(`Failed to create Alloy event template (${result.status}): ${result.text}`);
  }
  return result.data.id;
}

/**
 * Launches an event as the token's user. The templates here reference no Player View, Caster
 * Directory or Steamfitter Scenario Template, so the launch has nothing to deploy and goes
 * straight to Active with no Caster workspace.
 */
async function launch(token: string, eventTemplateId: string): Promise<ApiResult> {
  return apiCall(token, `/api/eventTemplates/${eventTemplateId}/events`, {
    method: 'POST',
  });
}

async function waitForStatus(token: string, eventId: string, status: string): Promise<void> {
  await expect
    .poll(async () => (await apiCall(token, `/api/events/${eventId}`)).data?.status, {
      timeout: 60000,
    })
    .toBe(status);
}

test.describe('Alloy API error messages', () => {
  let adminToken: string;
  const createdEvents: string[] = [];
  const createdTemplates: string[] = [];
  let seededUser: KeycloakUser | null = null;

  test.beforeAll(async () => {
    adminToken = await getUserToken('admin', 'admin', 'alloy.ui', ALLOY_SCOPE);
  });

  test.afterEach(async () => {
    for (const id of createdEvents.splice(0)) {
      await apiCall(adminToken, `/api/events/${id}/end`, { method: 'DELETE' });
      await apiCall(adminToken, `/api/events/${id}`, { method: 'DELETE' });
    }
    for (const id of createdTemplates.splice(0)) {
      await apiCall(adminToken, `/api/eventTemplates/${id}`, { method: 'DELETE' });
    }
    if (seededUser) {
      await deleteKeycloakUser(await getKeycloakAdminToken(), seededUser.id);
      seededUser = null;
    }
  });

  test('a missing Event, Event Template or Group is a 404 naming it', async () => {
    const id = crypto.randomUUID();

    // expect: each names the kind of thing and the id asked for
    const event = await apiCall(adminToken, `/api/events/${id}`);
    expect(event.status).toBe(404);
    expect(event.data?.title).toBe(`Event ${id} was not found.`);

    // expect: previously a 403 for an administrator, as if they lacked permission
    const template = await apiCall(adminToken, `/api/eventTemplates/${id}`);
    expect(template.status).toBe(404);
    expect(template.data?.title).toBe(`Event Template ${id} was not found.`);

    // expect: previously an empty 204
    const group = await apiCall(adminToken, `/api/groups/${id}`);
    expect(group.status).toBe(404);
    expect(group.data?.title).toBe(`Group ${id} was not found.`);
  });

  test('redeploying an event with nothing to redeploy, or that has ended, is a 409 saying why', async () => {
    const templateId = await createEventTemplate(adminToken);
    createdTemplates.push(templateId);
    const launched = await launch(adminToken, templateId);
    expect(launched.status).toBe(201);
    const eventId = launched.data.id;
    createdEvents.push(eventId);
    await waitForStatus(adminToken, eventId, 'Active');

    // expect: a conflict the user can understand, not a 500 "A server error occurred."
    const noWorkspace = await apiCall(adminToken, `/api/events/${eventId}/redeploy`, { method: 'POST' });
    expect(noWorkspace.status).toBe(409);
    expect(noWorkspace.data?.title).toBe(
      'This event has no Caster workspace, so there is nothing to redeploy.'
    );

    await apiCall(adminToken, `/api/events/${eventId}/end`, { method: 'DELETE' });
    await waitForStatus(adminToken, eventId, 'Ended');

    const ended = await apiCall(adminToken, `/api/events/${eventId}/redeploy`, { method: 'POST' });
    expect(ended.status).toBe(409);
    expect(ended.data?.title).toBe("This event is no longer active, so it can't be redeployed.");
  });

  test('launching a second event from the same template is a 409 saying what to do', async () => {
    const username = tempUsername('alloy-errors-dup');
    const password = 'Cr4ucible!Test';
    seededUser = await createKeycloakUser(await getKeycloakAdminToken(), { username, password });
    const userToken = await getUserToken(username, password, 'alloy.ui', ALLOY_SCOPE);

    // Every authenticated user can launch from a published template, so the user needs no role.
    const templateId = await createEventTemplate(adminToken, true);
    createdTemplates.push(templateId);
    const first = await launch(userToken, templateId);
    expect(first.status).toBe(201);
    createdEvents.push(first.data.id);

    // expect: previously a generic 500
    const second = await launch(userToken, templateId);
    expect(second.status).toBe(409);
    expect(second.data?.title).toBe(
      'You already have an active event from this template. End it before launching another.'
    );
  });

  test('launching past the active event limit is a 409 giving the limit', async () => {
    const username = tempUsername('alloy-errors-limit');
    const password = 'Cr4ucible!Test';
    seededUser = await createKeycloakUser(await getKeycloakAdminToken(), { username, password });
    const userToken = await getUserToken(username, password, 'alloy.ui', ALLOY_SCOPE);

    // The limit is configuration (ResourceOptions:MaxEventsForBasicUser, 2 by default), so launch
    // from one new template after another until it is reached rather than assuming it. Each is a
    // different template, so this is the limit and not the one-per-template rule.
    let result: ApiResult | undefined;
    for (let i = 0; i < 10; i++) {
      const templateId = await createEventTemplate(adminToken, true);
      createdTemplates.push(templateId);
      result = await launch(userToken, templateId);
      if (result.status !== 201) break;
      createdEvents.push(result.data.id);
    }

    expect(result?.status).toBe(409);
    expect(result?.data?.title).toMatch(
      /^You already have as many active events as you can have at once \(\d+\)\. End one before launching another\.$/
    );
  });
});
