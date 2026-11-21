// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license
// information.

// spec: specs/blueprint-test-plan.md
//
// Authoring automation tasks on a scenario event: the edit dialog's Automation tab, where an
// author adds, chains, and saves tasks; the Scenario Events list's Automation column; and the
// Test Automation dialog, which runs a task as a test, outside the exercise's history.
//
// Each test seeds its own MSEL with one renderable event. The tasks are http GETs of Blueprint's
// health endpoint (see healthCheckTask in test-helpers.ts), which need no Player view.

import { test, expect, BLUEPRINT_THEMES, applyBlueprintTheme, selectMatSelectOption } from '../../fixtures';
import type { Locator, Page } from '@playwright/test';
import {
  getBlueprintToken,
  createMsel,
  deleteMsel,
  createRenderableScenarioEvent,
  navigateToMselSection,
  findScenarioEventRow,
  setAutomationTasks,
  healthCheckTask,
  listEventAutomationTasks,
  listAutomationRuns,
  blueprintHealthUrl,
  tempBlueprintName,
} from '../../test-helpers';

const FIRST_TASK = 'Check health';
const CHAINED_TASK = 'Check again';

/** Choose a mat-select option by its text. */
async function choose(page: Page, select: Locator, option: string | RegExp): Promise<void> {
  await selectMatSelectOption(page, select, page.getByRole('option', { name: option, exact: typeof option === 'string' }));
}

async function openEventMenu(page: Page, row: Locator): Promise<void> {
  // The row's own action menu, not the header's (see edit-scenario-event.spec.ts).
  await row.getByRole('button', { name: /Action List/i }).click();
}

async function openAutomationTab(page: Page, row: Locator): Promise<Locator> {
  await openEventMenu(page, row);
  await page.getByRole('menuitem', { name: 'Edit', exact: true }).click();
  const dialog = page.getByRole('dialog').filter({ hasText: 'Edit Event' });
  await expect(dialog).toBeVisible({ timeout: 10000 });
  await dialog.getByRole('tab', { name: /^Automation/ }).click();
  await expect(dialog.getByText('Tasks run in list order unless a trigger says otherwise.')).toBeVisible();
  return dialog;
}

/** Add a task on the Automation tab and fill it in as a GET of Blueprint's health endpoint. */
async function addHealthCheckTask(page: Page, dialog: Locator, name: string): Promise<Locator> {
  await dialog.getByRole('button', { name: 'Add Task' }).click();
  // The new task's panel opens; it is the last one.
  const panel = dialog.locator('mat-expansion-panel').last();
  await expect(panel.getByRole('textbox', { name: 'Name' })).toBeVisible();
  await panel.getByRole('textbox', { name: 'Name' }).fill(name);
  await choose(page, panel.getByRole('combobox', { name: 'Action' }), 'GET request');
  await panel.getByRole('textbox', { name: 'URL' }).fill(blueprintHealthUrl());
  await panel.getByRole('textbox', { name: 'Expected output' }).fill('Healthy');
  return panel;
}

for (const theme of BLUEPRINT_THEMES) {
  test.describe(`${theme} theme › Automation Tasks`, () => {
    let token: string;
    let mselId: string | undefined;
    let description: string;
    let eventId: string;

    test.beforeEach(async () => {
      token = await getBlueprintToken();
      mselId = (await createMsel(token, { name: tempBlueprintName('TestBP-Automation') })).id;
      description = tempBlueprintName('TestBP-AutomationEvent');
      eventId = (await createRenderableScenarioEvent(token, mselId, description)).id;
    });

    test.afterEach(async () => {
      if (mselId) await deleteMsel(token, mselId);
      mselId = undefined;
    });

    test('An author adds two tasks, chains the second to the first, and saves them', async ({
      blueprintAuthenticatedPage: page,
    }) => {
      await applyBlueprintTheme(page, theme);
      await navigateToMselSection(page, mselId!, 'Scenario Events');
      const row = await findScenarioEventRow(page, description);
      const dialog = await openAutomationTab(page, row);

      // expect: an event without tasks says so
      await expect(dialog.getByText('This event has no automation tasks.')).toBeVisible();

      await addHealthCheckTask(page, dialog, FIRST_TASK);
      const chained = await addHealthCheckTask(page, dialog, CHAINED_TASK);
      await choose(page, chained.getByRole('combobox', { name: 'Trigger' }), 'On success of');
      await choose(page, chained.getByRole('combobox', { name: 'Task' }), new RegExp(`${FIRST_TASK}$`));

      // expect: the panel headers number the tasks in their order
      await expect(dialog.locator('mat-panel-title')).toHaveText([`1. ${FIRST_TASK}`, `2. ${CHAINED_TASK}`]);

      const saved = page.waitForResponse(
        (res) => /\/api\/scenarioevents\//i.test(res.url()) && res.request().method() === 'PUT'
      );
      await dialog.getByRole('button', { name: /^Save$/ }).click();
      expect((await saved).status()).toBe(200);
      await expect(dialog).toBeHidden();

      // expect: the server has both, in order, the second following the first on success
      const tasks = await listEventAutomationTasks(token, eventId);
      expect(tasks.map((t) => t.name)).toEqual([FIRST_TASK, CHAINED_TASK]);
      expect(tasks[0]).toMatchObject({ action: 'http_get', triggerCondition: 'Manual', expectedOutput: 'Healthy' });
      expect(tasks[0].actionParameters).toEqual({ Url: blueprintHealthUrl() });
      expect(tasks[1]).toMatchObject({ triggerCondition: 'OnSuccess', triggerTaskId: tasks[0].id });

      // expect: the list's Automation column counts the event's tasks
      await expect(page.getByRole('columnheader', { name: 'Automation' })).toBeVisible();
      await expect(row.getByRole('button', { name: /^2 automation tasks on event \d+$/ })).toBeVisible();
    });

    test('Test Automation runs a task as a test, outside the exercise', async ({
      blueprintAuthenticatedPage: page,
    }) => {
      await applyBlueprintTheme(page, theme);
      const [task] = await setAutomationTasks(token, eventId, [healthCheckTask(FIRST_TASK)]);
      await navigateToMselSection(page, mselId!, 'Scenario Events');
      const row = await findScenarioEventRow(page, description);

      await openEventMenu(page, row);
      await page.getByRole('menuitem', { name: /Test Automation/ }).click();
      const dialog = page.getByRole('dialog').filter({ hasText: 'Test Automation' });
      await expect(dialog).toBeVisible();
      // expect: the dialog warns that an http action runs for real
      await expect(dialog.getByText(/This action runs for real/)).toBeVisible();

      await dialog.getByRole('button', { name: 'Run Test' }).click();

      // expect: the result shows the endpoint's answer, and the run is a test run
      await expect(dialog.locator('.test-results')).toContainText('Succeeded', { timeout: 30000 });
      await expect(dialog.locator('.test-results')).toContainText('Healthy');
      const tests = await listAutomationRuns(token, mselId!, 'Test');
      expect(tests.map((r) => r.automationTaskId)).toEqual([task.id]);
      expect(await listAutomationRuns(token, mselId!, 'Exercise')).toEqual([]);

      await dialog.getByRole('button', { name: 'Close' }).click();
      await expect(dialog).toBeHidden();
    });

    test('A task that is missing what its action needs cannot be saved', async ({
      blueprintAuthenticatedPage: page,
    }) => {
      await applyBlueprintTheme(page, theme);
      await navigateToMselSection(page, mselId!, 'Scenario Events');
      const row = await findScenarioEventRow(page, description);
      const dialog = await openAutomationTab(page, row);

      await dialog.getByRole('button', { name: 'Add Task' }).click();
      const panel = dialog.locator('mat-expansion-panel').last();
      await panel.getByRole('textbox', { name: 'Name' }).fill(FIRST_TASK);
      await choose(page, panel.getByRole('combobox', { name: 'Action' }), 'GET request');

      // expect: without its URL the task is flagged, and saving it is refused
      await expect(dialog.getByRole('img', { name: 'Task 1 needs attention' })).toBeVisible();
      await expect(dialog.getByRole('button', { name: /^Save$/ })).toBeDisabled();
      await dialog.getByRole('button', { name: /^Cancel$/ }).click();
      await expect(dialog).toBeHidden();
      expect(await listEventAutomationTasks(token, eventId)).toEqual([]);
    });
  });
}
