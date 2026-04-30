// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { APIRequestContext } from '@playwright/test';
import { Services } from '../../fixtures';

const API = Services.Steamfitter.API;

export interface HistorySeedData {
  scenarioId: string;
  taskId: string;
  resultIds: string[];
  userId: string;
}

/**
 * Seed the Steamfitter database with a scenario, task, and multiple result
 * records so the History section has data to display.
 *
 * Returns IDs that must be passed to `cleanupHistorySeedData` after the test.
 */
export async function seedHistoryData(
  api: ReturnType<typeof import('../../fixtures').authenticatedApi>,
): Promise<HistorySeedData> {
  // 1. Look up the current user id from the users list
  const usersResp = await api.get(`${API}/api/users`);
  if (!usersResp.ok()) {
    throw new Error(`Failed to get users: ${usersResp.status()} ${await usersResp.text()}`);
  }
  const users = await usersResp.json();
  if (!users || users.length === 0) {
    throw new Error('No users found in the system');
  }
  // Pick the admin user (the one making the request) or fall back to the first user
  const adminUser = users.find((u: any) => u.name?.toLowerCase().includes('admin')) || users[0];
  const userId: string = adminUser.id;

  // 2. Create a scenario
  const scenarioResp = await api.post(`${API}/api/Scenarios`, {
    data: {
      name: 'History Test Scenario',
      description: 'Temporary scenario for history tests',
      status: 'active',
    },
  });
  if (!scenarioResp.ok()) {
    throw new Error(`Failed to create scenario: ${scenarioResp.status()} ${await scenarioResp.text()}`);
  }
  const scenario = await scenarioResp.json();

  // 3. Create a task on the scenario
  const taskResp = await api.post(`${API}/api/Tasks`, {
    data: {
      name: 'History Test Task',
      description: 'Task for history result testing',
      scenarioId: scenario.id,
      action: 'guest_file_read',
      triggerCondition: 'Manual',
      vmMask: 'test-vm',
      expectedOutput: 'expected-output-value',
      expirationSeconds: 600,
      iterations: 1,
      intervalSeconds: 0,
      delaySeconds: 0,
      actionParameters: {},
    },
  });
  if (!taskResp.ok()) {
    throw new Error(`Failed to create task: ${taskResp.status()} ${await taskResp.text()}`);
  }
  const task = await taskResp.json();

  // 4. Create multiple result records with varying dates, statuses, and VM names
  const resultDefs = [
    {
      vmName: 'web-server-01',
      status: 'succeeded',
      actualOutput: 'test alpha output',
      expectedOutput: 'expected-output-value',
      statusDate: new Date(Date.now() - 3600_000).toISOString(), // 1 hour ago
    },
    {
      vmName: 'db-server-01',
      status: 'failed',
      actualOutput: 'unexpected result',
      expectedOutput: 'expected-output-value',
      statusDate: new Date(Date.now() - 1800_000).toISOString(), // 30 min ago
    },
    {
      vmName: 'web-server-02',
      status: 'succeeded',
      actualOutput: 'test beta output',
      expectedOutput: 'expected-output-value',
      statusDate: new Date(Date.now() - 600_000).toISOString(), // 10 min ago
    },
  ];

  const resultIds: string[] = [];
  for (const def of resultDefs) {
    const rResp = await api.post(`${API}/api/Results`, {
      data: {
        taskId: task.id,
        vmId: null,
        vmName: def.vmName,
        status: def.status,
        actualOutput: def.actualOutput,
        expectedOutput: def.expectedOutput,
        statusDate: def.statusDate,
        sentDate: def.statusDate,
        action: 'guest_file_read',
        actionParameters: {},
        expirationSeconds: 600,
        iterations: 1,
        currentIteration: 1,
        intervalSeconds: 0,
      },
    });
    if (!rResp.ok()) {
      throw new Error(`Failed to create result: ${rResp.status()} ${await rResp.text()}`);
    }
    const result = await rResp.json();
    resultIds.push(result.id);
  }

  return { scenarioId: scenario.id, taskId: task.id, resultIds, userId };
}

/**
 * Delete all resources created by `seedHistoryData`.
 * The scenario is created with status "active", so we must end it first
 * before deletion is allowed. We also delete results explicitly in case
 * the cascade doesn't cover them.
 */
export async function cleanupHistorySeedData(
  api: ReturnType<typeof import('../../fixtures').authenticatedApi>,
  data: HistorySeedData | null,
): Promise<void> {
  if (!data) return;

  // 1. Delete results
  for (const id of data.resultIds) {
    try { await api.delete(`${API}/api/Results/${id}`); } catch { /* ignore */ }
  }

  // 2. End the scenario (must be ended before it can be deleted)
  try {
    const endResp = await api.put(`${API}/api/Scenarios/${data.scenarioId}/end`);
    if (!endResp.ok()) {
      console.warn(`[cleanup] Failed to end scenario ${data.scenarioId}: ${endResp.status()}`);
    }
  } catch (e) {
    console.warn(`[cleanup] Error ending scenario: ${e}`);
  }

  // 3. Delete the scenario
  try {
    const delResp = await api.delete(`${API}/api/Scenarios/${data.scenarioId}`);
    if (!delResp.ok()) {
      console.warn(`[cleanup] Failed to delete scenario ${data.scenarioId}: ${delResp.status()} ${await delResp.text()}`);
    }
  } catch (e) {
    console.warn(`[cleanup] Error deleting scenario: ${e}`);
  }
}

/**
 * Navigate to the History section on the Steamfitter home page.
 */
export async function navigateToHistory(page: import('@playwright/test').Page) {
  await page.goto(Services.Steamfitter.UI);

  const sectionMenuTrigger = page.locator('button.section-menu-trigger');
  await sectionMenuTrigger.waitFor({ state: 'visible', timeout: 15000 });
  await sectionMenuTrigger.click();

  await page.getByRole('menuitem', { name: 'History' }).click();
}

/**
 * Select a user in the History "Users" dropdown to load result data.
 * Default category is already "User" so we just need to pick one.
 */
export async function selectHistoryUser(page: import('@playwright/test').Page) {
  const usersSelect = page.getByLabel('Users');
  await usersSelect.click();
  await page.getByRole('option').first().click();
}
