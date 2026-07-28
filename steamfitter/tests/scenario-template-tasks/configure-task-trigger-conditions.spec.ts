// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: steamfitter/steamfitter-test-plan.md
// seed: tests/seed.spec.ts

import { test, expect } from '../../fixtures';
import { seedScenarioTemplate, seedTask, deleteScenarioTemplatesByPrefix } from '../../fixtures';
import {
  navigateToHomeSection,
  findHomeRowByText,
  expandScenarioTemplateRow,
  findTaskNode,
  openTaskMenu,
  clickContextMenuItem,
  fillTaskDialog,
} from '../../test-helpers';

/**
 * A task's schedule is driven by its Trigger Condition plus the delay/iteration
 * settings. This spec edits a seeded task to run on a "Time" trigger with an explicit
 * delay, iteration count, interval, and iteration-termination mode, saves, and
 * verifies the persisted values. The detail panel surfaces the delay/iteration
 * settings directly; the Trigger Condition itself is only editable-visible, so we
 * re-open the Edit dialog to confirm it. Cleanup is by parent-template prefix (tasks
 * cascade-delete).
 */
test.describe('Scenario Template Tasks', () => {
  const TEMPLATE_NAME = `E2E Task Trigger Template ${Date.now()}`;
  const TASK_NAME = `E2E Trigger Task ${Date.now()}`;

  let templateId: string;

  test.beforeEach(async () => {
    templateId = await seedScenarioTemplate(TEMPLATE_NAME, 'Template holding a task to schedule', 1);
    await seedTask(templateId, TASK_NAME, 'Task whose trigger is configured');
  });

  test.afterEach(async () => {
    await deleteScenarioTemplatesByPrefix(['E2E Task Trigger Template']);
  });

  test('Configure task trigger conditions', async ({ steamfitterAuthenticatedPage: page }) => {
    // 1. Expand the template and open the task's Edit dialog.
    await navigateToHomeSection(page, 'Scenario Templates');
    const row = await findHomeRowByText(page, TEMPLATE_NAME);
    await expandScenarioTemplateRow(page, row);

    const taskNode = findTaskNode(page, TASK_NAME);
    await expect(taskNode).toBeVisible({ timeout: 10000 });
    await openTaskMenu(page, taskNode);
    await clickContextMenuItem(page, 'Edit');

    // 2. Set a Time trigger with delay / iteration / interval / termination, then Save.
    await fillTaskDialog(page, {
      triggerCondition: 'Time',
      delaySeconds: '120',
      iterations: '3',
      intervalSeconds: '300',
      iterationTermination: 'IterationCount',
    });

    // expect: The detail panel reflects the scheduling values.
    const detail = findTaskNode(page, TASK_NAME);
    await expect(detail).toContainText('Delay (seconds): 120');
    await expect(detail).toContainText('Iterations: 3');
    await expect(detail).toContainText('Iteration Interval (seconds): 300');
    await expect(detail).toContainText('Iteration Termination: IterationCount');

    // 3. Re-open Edit to confirm the Trigger Condition persisted (it isn't shown in
    // the read-only detail panel).
    await openTaskMenu(page, detail);
    await clickContextMenuItem(page, 'Edit');
    const dialog = page.getByRole('dialog');
    await expect(dialog.getByRole('combobox', { name: /Trigger Condition/ })).toContainText('Time');
    await dialog.getByRole('button', { name: 'Cancel' }).click();
    await expect(dialog).not.toBeVisible({ timeout: 10000 });
  });
});
