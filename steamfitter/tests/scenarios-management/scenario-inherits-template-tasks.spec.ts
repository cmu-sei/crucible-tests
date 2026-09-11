// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: steamfitter/steamfitter-test-plan.md
// seed: tests/seed.spec.ts

// The UI spec for 5.2 stops at "a scenario row appears in the list", so the plan's
// "the scenario inherits all tasks from the template" expectation has never been
// checked. This is that check, at the API level: task definitions are copied onto the
// new scenario with the fields that decide what each task does and what it scores.

import { request as pwRequest } from '@playwright/test';
import { test, expect } from '../../fixtures';
import {
  Services,
  getSteamfitterApiToken,
  seedScenarioTemplate,
  seedTask,
  deleteScenariosByPrefix,
  deleteScenarioTemplatesByPrefix,
} from '../../fixtures';

const NAME_PREFIX = 'E2E Inherit Tasks';
const TEMPLATE_NAME = `${NAME_PREFIX} Template ${Date.now()}`;

// Every task carries different values, so a field that comes back defaulted, or
// belonging to the wrong task, fails instead of matching by coincidence.
const SEEDED_TASKS = [
  {
    name: `${NAME_PREFIX} Scored Task`,
    expectedOutput: 'INHERIT_TASK_SCORED',
    score: 50,
    userExecutable: true,
    repeatable: true,
  },
  {
    name: `${NAME_PREFIX} Partly Scored Task`,
    expectedOutput: 'INHERIT_TASK_PARTIAL',
    score: 25,
    userExecutable: true,
    repeatable: false,
  },
  {
    name: `${NAME_PREFIX} Unscored Task`,
    expectedOutput: 'INHERIT_TASK_UNSCORED',
    score: 0,
    userExecutable: false,
    repeatable: false,
  },
];

interface SteamfitterScenario {
  id: string;
  name: string;
  scenarioTemplateId?: string | null;
}

interface SteamfitterTask {
  id: string;
  name: string;
  scenarioId?: string | null;
  scenarioTemplateId?: string | null;
  expectedOutput: string;
  score: number;
  triggerCondition: string;
  userExecutable: boolean;
  repeatable: boolean;
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
  options: { method?: 'GET' | 'POST' | 'DELETE'; body?: unknown } = {}
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

function sortedNames(tasks: SteamfitterTask[]): string[] {
  return tasks.map((task) => task.name).sort();
}

test.describe('Scenarios Management', () => {
  let templateId: string;

  test.beforeEach(async () => {
    templateId = await seedScenarioTemplate(
      TEMPLATE_NAME,
      'Template whose tasks a scenario should inherit',
      2
    );

    for (const seeded of SEEDED_TASKS) {
      await seedTask(templateId, seeded.name, 'Seeded to be inherited by a scenario', {
        expectedOutput: seeded.expectedOutput,
        score: seeded.score,
        userExecutable: seeded.userExecutable,
        repeatable: seeded.repeatable,
      });
    }
  });

  // The scenario is named "<template name><nameSuffix>", so the one prefix covers it as
  // well. Scenarios reference the template, so they have to go first.
  test.afterEach(async () => {
    await deleteScenariosByPrefix([NAME_PREFIX]);
    await deleteScenarioTemplatesByPrefix([NAME_PREFIX]);
  });

  test('a scenario created from a template inherits its task definitions', async () => {
    // 1. Create a scenario from the template.
    const created = await callApi<SteamfitterScenario>(
      `/ScenarioTemplates/${templateId}/Scenarios`,
      {
        method: 'POST',
        body: { nameSuffix: ` Scenario ${Date.now()}`, userIds: [] },
      }
    );
    expect(
      created.ok,
      `POST /ScenarioTemplates/${templateId}/Scenarios failed (${created.status}): ${created.text}`
    ).toBe(true);

    // expect: The scenario records the template it was created from.
    expect(created.data.scenarioTemplateId).toBe(templateId);

    // 2. Read the tasks the new scenario ended up with.
    const scenarioTasks = await callApi<SteamfitterTask[]>(
      `/scenarios/${created.data.id}/Tasks`
    );
    expect(
      scenarioTasks.ok,
      `GET /scenarios/${created.data.id}/Tasks failed (${scenarioTasks.status}): ${scenarioTasks.text}`
    ).toBe(true);

    // expect: Every task on the template is present on the scenario, and nothing else is.
    expect(sortedNames(scenarioTasks.data)).toEqual(SEEDED_TASKS.map((task) => task.name).sort());

    for (const seeded of SEEDED_TASKS) {
      const task = scenarioTasks.data.find((candidate) => candidate.name === seeded.name);
      expect(task, `Expected an inherited task named "${seeded.name}"`).toBeTruthy();

      // expect: The copy belongs to the scenario, not to the template.
      expect(task!.scenarioId).toBe(created.data.id);
      expect(task!.scenarioTemplateId ?? null).toBeNull();

      // expect: The fields that decide what the task does, and what it is worth, survive
      // the copy. Score in particular is what a grading consumer reads back.
      expect(task!.expectedOutput).toBe(seeded.expectedOutput);
      expect(task!.score).toBe(seeded.score);
      expect(task!.userExecutable).toBe(seeded.userExecutable);
      expect(task!.repeatable).toBe(seeded.repeatable);
      expect(task!.triggerCondition).toBe('Manual');
    }

    // 3. Read the template's tasks back.
    const templateTasks = await callApi<SteamfitterTask[]>(
      `/scenarioTemplates/${templateId}/Tasks`
    );
    expect(
      templateTasks.ok,
      `GET /scenarioTemplates/${templateId}/Tasks failed (${templateTasks.status}): ${templateTasks.text}`
    ).toBe(true);

    // expect: The template keeps its own tasks — creating a scenario copies them rather
    // than re-parenting them, so the template stays reusable.
    expect(sortedNames(templateTasks.data)).toEqual(SEEDED_TASKS.map((task) => task.name).sort());
    for (const task of templateTasks.data) {
      expect(task.scenarioTemplateId).toBe(templateId);
      expect(task.scenarioId ?? null).toBeNull();
    }
  });
});
