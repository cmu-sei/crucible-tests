// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: steamfitter/steamfitter-test-plan.md
// seed: tests/seed.spec.ts

// Steamfitter 3.10 removed StackStorm. The RemoveStackstormApiUrl migration remapped its
// VM, email and SSH actions, but the Azure actions (az_vm_shell_script = 110 and so on)
// were dropped from the enum and left on api_url 'stackstorm'. Running one used to throw
// out of the execution loop, so the task never reached a terminal status and its
// Failure/Completion subtasks never ran. This checks it now fails like any other task.

import { request as pwRequest } from '@playwright/test';
import { test, expect } from '../../fixtures';
import { requirePrecondition } from '../../../shared-fixtures';
import {
  Services,
  getSteamfitterApiToken,
  seedScenario,
  deleteScenariosByPrefix,
  isPlayerApiAvailable,
  createPlayerView,
  deletePlayerView,
} from '../../fixtures';

const NAME_PREFIX = 'E2E Unsupported Action';

// az_vm_shell_script. Sent as a number because the name no longer exists in TaskAction.
const REMOVED_AZURE_ACTION = 110;

const TERMINAL_STATUSES = ['succeeded', 'failed', 'error', 'expired', 'cancelled'];

interface SteamfitterTask {
  id: string;
  name: string;
  status: string;
}

interface SteamfitterResult {
  id: string;
  taskId: string;
  status: string;
  actualOutput: string | null;
}

interface ApiResult<T> {
  ok: boolean;
  status: number;
  data: T;
  text: string;
}

// Steamfitter's own fixtures.ts posts to `${Services.Steamfitter.API}/api/...`, so the
// base URL carries no /api segment; keep that assumption in one place.
async function callApi<T>(
  path: string,
  options: { method?: 'GET' | 'POST' | 'PUT'; body?: unknown } = {}
): Promise<ApiResult<T>> {
  const apiContext = await pwRequest.newContext({ ignoreHTTPSErrors: true });
  try {
    const token = await getSteamfitterApiToken(apiContext);
    const response = await apiContext.fetch(`${Services.Steamfitter.API}/api${path}`, {
      method: options.method ?? 'GET',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      data: options.body as never,
    });
    const text = await response.text();
    let data: T = undefined as T;
    try {
      data = text ? JSON.parse(text) : (undefined as T);
    } catch {
      // Non-JSON body, which only happens on an error the caller reports via `text`.
    }
    return { ok: response.ok(), status: response.status(), data, text };
  } finally {
    await apiContext.dispose();
  }
}

async function createStackstormTask(
  scenarioId: string,
  name: string,
  trigger: { triggerTaskId?: string; triggerCondition: string }
): Promise<string> {
  const created = await callApi<SteamfitterTask>('/tasks', {
    method: 'POST',
    body: {
      name,
      description: 'Task using an action removed with StackStorm',
      scenarioId,
      action: REMOVED_AZURE_ACTION,
      apiUrl: 'stackstorm',
      actionParameters: {},
      expectedOutput: '',
      delaySeconds: 0,
      intervalSeconds: 0,
      iterations: 1,
      iterationTermination: 'IterationCount',
      expirationSeconds: 0,
      // No VM mask means one result and no Player VM lookup.
      vmMask: '',
      score: 0,
      userExecutable: false,
      repeatable: false,
      ...trigger,
    },
  });
  expect(created.ok, `POST /tasks failed (${created.status}): ${created.text}`).toBe(true);
  return created.data.id;
}

async function getResults(taskId: string): Promise<SteamfitterResult[]> {
  const results = await callApi<SteamfitterResult[]>(`/tasks/${taskId}/Results`);
  expect(results.ok, `GET /tasks/${taskId}/Results failed (${results.status}): ${results.text}`).toBe(
    true
  );
  return results.data;
}

test.describe('Scenarios Management', () => {
  let playerAvailable = false;
  let viewId: string | null = null;

  test.beforeAll(async () => {
    playerAvailable = await isPlayerApiAvailable();
    if (playerAvailable) {
      viewId = await createPlayerView(`${NAME_PREFIX} View ${Date.now()}`);
    }
  });

  test.afterAll(async () => {
    if (viewId) {
      await deletePlayerView(viewId);
      viewId = null;
    }
  });

  test.afterEach(async () => {
    await deleteScenariosByPrefix([NAME_PREFIX]);
  });

  test('a task using a removed StackStorm action fails and runs its Failure subtask', async () => {
    // Skips locally (Player is optional in a partial stack) but fails under CI.
    requirePrecondition(playerAvailable, 'Player API unavailable — tasks only run in a started scenario, which needs a view.');

    // 1. Seed a view-bound scenario and start it, since only an active scenario's tasks run.
    const scenarioId = await seedScenario(
      `${NAME_PREFIX} Scenario ${Date.now()}`,
      'Scenario holding a task whose action was removed',
      { viewId: viewId ?? undefined }
    );
    const started = await callApi(`/Scenarios/${scenarioId}/start`, { method: 'PUT' });
    expect(started.ok, `PUT /Scenarios/${scenarioId}/start failed (${started.status}): ${started.text}`).toBe(
      true
    );

    // 2. Add the removed-action task, plus a subtask that should run when it fails.
    const parentId = await createStackstormTask(scenarioId, `${NAME_PREFIX} Parent Task`, {
      triggerCondition: 'Manual',
    });
    const subtaskId = await createStackstormTask(scenarioId, `${NAME_PREFIX} Failure Subtask`, {
      triggerTaskId: parentId,
      triggerCondition: 'Failure',
    });

    // 3. Execute the parent. Execution is queued, so poll for a terminal result.
    const executed = await callApi(`/Tasks/${parentId}/execute`, { method: 'POST' });
    expect(executed.ok, `POST /Tasks/${parentId}/execute failed (${executed.status}): ${executed.text}`).toBe(
      true
    );

    // expect: The parent's result fails, with the reason in its output, instead of
    // staying pending.
    await expect
      .poll(
        async () => {
          const results = await getResults(parentId);
          return results.length > 0 && results.every((result) => TERMINAL_STATUSES.includes(result.status));
        },
        { timeout: 30000, message: 'parent task result never reached a terminal status' }
      )
      .toBe(true);
    const [parentResult] = await getResults(parentId);
    expect(parentResult.status).toBe('failed');
    expect(parentResult.actualOutput).toContain('removed in Steamfitter 3.10');

    // expect: The task itself records the failure.
    const parentTask = await callApi<SteamfitterTask>(`/tasks/${parentId}`);
    expect(parentTask.ok, `GET /tasks/${parentId} failed (${parentTask.status}): ${parentTask.text}`).toBe(true);
    expect(parentTask.data.status).toBe('failed');

    // expect: The Failure subtask was queued and ran, so a scenario that branches on
    // failure still progresses.
    await expect
      .poll(async () => (await getResults(subtaskId)).map((result) => result.status), {
        timeout: 30000,
        message: 'Failure subtask never ran',
      })
      .toEqual(['failed']);
  });
});
