// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: alloy/alloy-test-plan.md

import { APIRequestContext, expect, request as playwrightRequest, test } from '@playwright/test';
import {
  createKeycloakUser,
  deleteKeycloakUser,
  getKeycloakAdminToken,
  getUserToken,
  tempUsername,
} from '../../../keycloak-admin';
import { Services } from '../../../shared-fixtures';

const EVENT_MEMBER_ROLE_ID = 'f870d8ee-7332-4f7f-8ee0-63bd07cfd7e4';

interface ApiResult<T = any> {
  ok: boolean;
  status: number;
  data: T;
  text: string;
}

interface CreatedEventTemplate {
  id: string;
  name: string;
}

interface CreatedEvent {
  id: string;
  eventTemplateId: string;
  name: string;
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

async function getAlloyAdminToken(): Promise<string> {
  return getUserToken(
    'admin',
    'admin',
    'alloy.ui',
    'openid profile player player-vm alloy caster steamfitter'
  );
}

async function createEventTemplate(token: string): Promise<CreatedEventTemplate> {
  const name = `AdminEnlist Template ${Date.now()} ${Math.floor(Math.random() * 1_000_000)}`;
  const result = await apiCall<CreatedEventTemplate>(token, '/api/eventTemplates', {
    method: 'POST',
    body: {
      name,
      description: 'Automated admin enlist endpoint test. Will be deleted after the test.',
      durationHours: 1,
      useDynamicHost: false,
      isPublished: false,
    },
  });

  if (!result.ok) {
    throw new Error(`Failed to create Alloy event template (${result.status}): ${result.text}`);
  }

  return result.data;
}

async function createActiveEvent(
  token: string,
  eventTemplateId: string
): Promise<CreatedEvent> {
  const name = `AdminEnlist Event ${Date.now()} ${Math.floor(Math.random() * 1_000_000)}`;
  const result = await apiCall<CreatedEvent>(token, '/api/events', {
    method: 'POST',
    body: {
      eventTemplateId,
      name,
      description: 'Automated admin enlist endpoint test. Will be deleted after the test.',
      status: 'Active',
      internalStatus: 'Launched',
      lastLaunchStatus: 'Active',
      lastLaunchInternalStatus: 'Launched',
      lastEndStatus: 'Ended',
      lastEndInternalStatus: 'Ended',
      statusDate: new Date().toISOString(),
      launchDate: new Date().toISOString(),
      expirationDate: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
    },
  });

  if (!result.ok) {
    throw new Error(`Failed to create Alloy event (${result.status}): ${result.text}`);
  }

  return result.data;
}

async function deleteEventMemberships(token: string, eventId: string, userId: string): Promise<void> {
  const memberships = await apiCall<Array<{ id: string; userId?: string }>>(
    token,
    `/api/events/${eventId}/memberships`
  );

  if (!memberships.ok) {
    return;
  }

  for (const membership of memberships.data.filter((m) => m.userId === userId)) {
    await apiCall(token, `/api/events/memberships/${membership.id}`, { method: 'DELETE' });
  }
}

async function deleteEventTemplateMemberships(
  token: string,
  eventTemplateId: string,
  userId: string
): Promise<void> {
  const memberships = await apiCall<Array<{ id: string; userId?: string }>>(
    token,
    `/api/eventTemplates/${eventTemplateId}/memberships`
  );

  if (!memberships.ok) {
    return;
  }

  for (const membership of memberships.data.filter((m) => m.userId === userId)) {
    await apiCall(token, `/api/eventTemplates/memberships/${membership.id}`, { method: 'DELETE' });
  }
}

test.describe('Alloy admin enlist endpoint', () => {
  test('requires ManageEvents permission', async () => {
    const keycloakAdminToken = await getKeycloakAdminToken();
    const username = tempUsername('alloy-enlist-denied');
    const user = await createKeycloakUser(keycloakAdminToken, {
      username,
      password: 'pw',
      firstName: 'Denied',
      lastName: 'User',
    });

    try {
      const token = await getUserToken(
        user.username,
        user.password,
        'alloy.ui',
        'openid profile player player-vm alloy caster steamfitter'
      );

      const result = await apiCall(
        token,
        `/api/events/${crypto.randomUUID()}/enlist/${crypto.randomUUID()}`,
        {
          method: 'POST',
          body: { userName: 'Blocked User' },
        }
      );

      expect(result.status).toBe(403);
    } finally {
      await deleteKeycloakUser(keycloakAdminToken, user.id);
    }
  });

  test('enlists a specified user and keeps an existing Alloy user name', async () => {
    const keycloakAdminToken = await getKeycloakAdminToken();
    const token = await getAlloyAdminToken();
    const username = tempUsername('alloy-enlist-user');
    const student = await createKeycloakUser(keycloakAdminToken, {
      username,
      password: 'pw',
      firstName: 'Moodle',
      lastName: 'Student',
    });
    let eventTemplate: CreatedEventTemplate | undefined;
    let event: CreatedEvent | undefined;

    try {
      eventTemplate = await createEventTemplate(token);
      event = await createActiveEvent(token, eventTemplate.id);

      const enlistResult = await apiCall<CreatedEvent>(
        token,
        `/api/events/${event.id}/enlist/${student.id}`,
        {
          method: 'POST',
          body: { userName: 'Moodle Student' },
        }
      );

      expect(enlistResult.status).toBe(201);
      expect(enlistResult.data.id).toBe(event.id);

      const userResult = await apiCall<{ id: string; name: string }>(
        token,
        `/api/users/${student.id}`
      );
      expect(userResult.ok).toBeTruthy();
      expect(userResult.data.name).toBe('Moodle Student');

      const eventMemberships = await apiCall<Array<{ userId?: string; roleId: string }>>(
        token,
        `/api/events/${event.id}/memberships`
      );
      expect(eventMemberships.ok).toBeTruthy();
      expect(eventMemberships.data).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            userId: student.id,
            roleId: EVENT_MEMBER_ROLE_ID,
          }),
        ])
      );

      const eventTemplateMemberships = await apiCall<Array<{ userId?: string }>>(
        token,
        `/api/eventTemplates/${eventTemplate.id}/memberships`
      );
      expect(eventTemplateMemberships.ok).toBeTruthy();
      expect(eventTemplateMemberships.data).toEqual(
        expect.arrayContaining([expect.objectContaining({ userId: student.id })])
      );

      const secondEnlistResult = await apiCall(
        token,
        `/api/events/${event.id}/enlist/${student.id}`,
        {
          method: 'POST',
          body: { userName: 'Different Name' },
        }
      );
      expect(secondEnlistResult.status).toBe(201);

      const unchangedUserResult = await apiCall<{ name: string }>(
        token,
        `/api/users/${student.id}`
      );
      expect(unchangedUserResult.ok).toBeTruthy();
      expect(unchangedUserResult.data.name).toBe('Moodle Student');
    } finally {
      if (event) {
        await deleteEventMemberships(token, event.id, student.id);
        await apiCall(token, `/api/events/${event.id}`, { method: 'DELETE' });
      }
      if (eventTemplate) {
        await deleteEventTemplateMemberships(token, eventTemplate.id, student.id);
        await apiCall(token, `/api/eventTemplates/${eventTemplate.id}`, { method: 'DELETE' });
      }
      await apiCall(token, `/api/users/${student.id}`, { method: 'DELETE' });
      await deleteKeycloakUser(keycloakAdminToken, student.id);
    }
  });
});
