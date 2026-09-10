// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: steamfitter/steamfitter-test-plan.md

import { APIRequestContext, expect, request as playwrightRequest, test } from '@playwright/test';
import { getUserToken } from '../../../keycloak-admin';
import { Services } from '../../../shared-fixtures';

const SCENARIO_TEMPLATE_NAME = 'Moodle Task Grading Test Scenario';

const EXPECTED_TASKS = [
  {
    name: 'Moodle grading complete',
    description: 'Deterministic passing task for full-credit Moodle grading checks.',
    expectedOutput: 'MOODLE_TASK_COMPLETE',
    commandOutput: 'MOODLE_TASK_COMPLETE',
    score: 50,
  },
  {
    name: 'Moodle grading partial',
    description: 'Second passing task used with incomplete result sets for partial-credit checks.',
    expectedOutput: 'MOODLE_TASK_PARTIAL',
    commandOutput: 'MOODLE_TASK_PARTIAL',
    score: 25,
  },
  {
    name: 'Moodle grading expected failure',
    description: 'Deterministic task with mismatched output for failed-result grading checks.',
    expectedOutput: 'MOODLE_TASK_EXPECTED_FAILURE',
    commandOutput: 'MOODLE_TASK_ACTUAL_FAILURE',
    score: 25,
  },
];

interface ApiResult<T = any> {
  ok: boolean;
  status: number;
  data: T;
  text: string;
}

interface SteamfitterScenarioTemplate {
  id: string;
  name: string;
  description: string;
  score?: number;
}

interface SteamfitterScenario {
  id: string;
  name: string;
  scenarioTemplateId?: string;
  score?: number;
}

interface SteamfitterTask {
  id: string;
  name: string;
  description: string;
  scenarioTemplateId?: string;
  scenarioId?: string;
  action: string;
  vmMask?: string;
  vmList?: string[];
  apiUrl: string;
  actionParameters?: Record<string, string>;
  expectedOutput: string;
  expirationSeconds: number;
  delaySeconds: number;
  intervalSeconds: number;
  iterations: number;
  iterationTermination: string;
  currentIteration: number;
  triggerCondition: string;
  score: number;
  userExecutable: boolean;
  repeatable: boolean;
  executable: boolean;
}

interface GradeCheckInfo {
  gradedTaskId: string;
  executionStartTime: string;
}

async function newContext(): Promise<APIRequestContext> {
  return playwrightRequest.newContext({ ignoreHTTPSErrors: true });
}

function steamfitterApiBase(): string {
  const configuredBase = Services.Steamfitter.API.replace(/\/$/, '');
  const url = new URL(configuredBase);

  if (url.pathname.toLowerCase().endsWith('/api')) {
    return configuredBase;
  }

  return `${configuredBase}/api`;
}

async function apiCall<T = any>(
  token: string,
  path: string,
  options: { method?: 'GET' | 'POST' | 'PUT' | 'DELETE'; body?: any } = {}
): Promise<ApiResult<T>> {
  const ctx = await newContext();
  try {
    const response = await ctx.fetch(`${steamfitterApiBase()}${path}`, {
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

async function getSteamfitterAdminToken(): Promise<string> {
  return getUserToken(
    'admin',
    'admin',
    'steamfitter.admin',
    'openid profile player player-vm steamfitter'
  );
}

async function requireMoodleGradingScenarioTemplate(
  token: string
): Promise<SteamfitterScenarioTemplate> {
  const result = await apiCall<SteamfitterScenarioTemplate[]>(token, '/scenarioTemplates');
  expect(result.ok, `GET /scenarioTemplates failed (${result.status}): ${result.text}`).toBe(true);

  const template = result.data.find((item) => item.name === SCENARIO_TEMPLATE_NAME);
  expect(
    template,
    `${SCENARIO_TEMPLATE_NAME} was not found. Run scripts/setup-crucible-proxmox.sh to seed test tasks.`
  ).toBeTruthy();

  return template!;
}

async function getScenarioTemplateTasks(
  token: string,
  scenarioTemplateId: string
): Promise<SteamfitterTask[]> {
  const result = await apiCall<SteamfitterTask[]>(
    token,
    `/scenarioTemplates/${scenarioTemplateId}/Tasks`
  );
  expect(
    result.ok,
    `GET /scenarioTemplates/${scenarioTemplateId}/Tasks failed (${result.status}): ${result.text}`
  ).toBe(true);
  return result.data;
}

async function cloneScenarioForTest(
  token: string,
  scenarioTemplateId: string
): Promise<SteamfitterScenario> {
  const result = await apiCall<SteamfitterScenario>(
    token,
    `/ScenarioTemplates/${scenarioTemplateId}/Scenarios`,
    {
      method: 'POST',
      body: {
        nameSuffix: ` Playwright ${Date.now()} ${Math.floor(Math.random() * 1_000_000)}`,
        userIds: [],
      },
    }
  );

  expect(
    result.ok,
    `POST /ScenarioTemplates/${scenarioTemplateId}/Scenarios failed (${result.status}): ${result.text}`
  ).toBe(true);
  return result.data;
}

async function deleteScenario(token: string, scenarioId: string): Promise<void> {
  await apiCall(token, `/Scenarios/${scenarioId}`, { method: 'DELETE' });
}

function taskByName(tasks: SteamfitterTask[], name: string): SteamfitterTask {
  const task = tasks.find((item) => item.name === name);
  expect(task, `Expected Steamfitter task "${name}" to exist`).toBeTruthy();
  return task!;
}

test.describe('Steamfitter Moodle grading task execution', () => {
  test('seeds deterministic Steamfitter tasks for Moodle grading', async () => {
    const token = await getSteamfitterAdminToken();
    const template = await requireMoodleGradingScenarioTemplate(token);
    const tasks = await getScenarioTemplateTasks(token, template.id);

    expect(tasks.filter((task) => task.name.startsWith('Moodle grading '))).toHaveLength(
      EXPECTED_TASKS.length
    );

    for (const expected of EXPECTED_TASKS) {
      const task = taskByName(tasks, expected.name);
      expect(task.description).toBe(expected.description);
      expect(task.scenarioTemplateId).toBe(template.id);
      expect(task.scenarioId ?? null).toBeNull();
      expect(task.action).toBe('guest_process_run');
      expect(task.apiUrl).toBe('player-vm');
      expect(task.actionParameters?.CommandText).toBe('sh');
      expect(task.actionParameters?.CommandArgs).toContain(`printf %s ${expected.commandOutput}`);
      expect(task.actionParameters?.Username).toBe('root');
      expect(task.expectedOutput).toBe(expected.expectedOutput);
      expect(task.expirationSeconds).toBe(30);
      expect(task.delaySeconds).toBe(0);
      expect(task.intervalSeconds).toBe(0);
      expect(task.iterations).toBe(1);
      expect(task.iterationTermination).toBe('IterationCount');
      expect(task.triggerCondition).toBe('Manual');
      expect(task.score).toBe(expected.score);
      expect(task.userExecutable).toBe(true);
      expect(task.repeatable).toBe(true);
      expect(task.executable).toBe(true);
    }
  });

  test('clones Moodle grading task definitions onto a scenario', async () => {
    const token = await getSteamfitterAdminToken();
    const template = await requireMoodleGradingScenarioTemplate(token);
    const scenario = await cloneScenarioForTest(token, template.id);

    try {
      expect(scenario.scenarioTemplateId).toBe(template.id);

      const tasksResult = await apiCall<SteamfitterTask[]>(token, `/scenarios/${scenario.id}/Tasks`);
      expect(
        tasksResult.ok,
        `GET /scenarios/${scenario.id}/Tasks failed (${tasksResult.status}): ${tasksResult.text}`
      ).toBe(true);

      for (const expected of EXPECTED_TASKS) {
        const task = taskByName(tasksResult.data, expected.name);
        expect(task.scenarioTemplateId ?? null).toBeNull();
        expect(task.scenarioId).toBe(scenario.id);
        expect(task.expectedOutput).toBe(expected.expectedOutput);
        expect(task.score).toBe(expected.score);
        expect(task.triggerCondition).toBe('Manual');
        expect(task.userExecutable).toBe(true);
        expect(task.executable).toBe(true);
      }
    } finally {
      await deleteScenario(token, scenario.id);
    }
  });

  test('queues graded execution for a cloned Moodle grading scenario when enabled', async () => {
    test.skip(
      process.env.RUN_STEAMFITTER_TASK_EXECUTION_TESTS !== '1',
      'Set RUN_STEAMFITTER_TASK_EXECUTION_TESTS=1 to queue live Steamfitter task execution.'
    );

    const token = await getSteamfitterAdminToken();
    const template = await requireMoodleGradingScenarioTemplate(token);
    const scenario = await cloneScenarioForTest(token, template.id);

    try {
      const result = await apiCall<GradeCheckInfo>(token, '/tasks/execute/graded', {
        method: 'POST',
        body: {
          scenarioId: scenario.id,
          startTaskName: 'Moodle grading complete',
          gradedTaskName: 'Moodle grading complete',
          taskSubstitutions: {},
        },
      });

      expect(
        result.ok,
        `POST /tasks/execute/graded failed (${result.status}): ${result.text}`
      ).toBe(true);
      expect(result.data.gradedTaskId).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
      );
      expect(Date.parse(result.data.executionStartTime)).not.toBeNaN();
    } finally {
      await deleteScenario(token, scenario.id);
    }
  });
});
