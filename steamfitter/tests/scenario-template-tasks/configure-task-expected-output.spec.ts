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
 * A task's Expected Output is the string a run's result is compared against to decide
 * success/failure. This spec edits a seeded task to set an expected output, saves, and
 * verifies it in the read-only detail panel (which renders "Expected Output: <value>").
 * Cleanup is by parent-template prefix (tasks cascade-delete).
 */
test.describe('Scenario Template Tasks', () => {
  const TEMPLATE_NAME = `E2E Task Output Template ${Date.now()}`;
  const TASK_NAME = `E2E Output Task ${Date.now()}`;
  const EXPECTED_OUTPUT = 'success';

  let templateId: string;

  test.beforeEach(async () => {
    templateId = await seedScenarioTemplate(TEMPLATE_NAME, 'Template holding a task to score', 1);
    await seedTask(templateId, TASK_NAME, 'Task whose expected output is configured');
  });

  test.afterEach(async () => {
    await deleteScenarioTemplatesByPrefix(['E2E Task Output Template']);
  });

  test('Configure task expected output', async ({ steamfitterAuthenticatedPage: page }) => {
    // 1. Expand the template and open the task's Edit dialog.
    await navigateToHomeSection(page, 'Scenario Templates');
    const row = await findHomeRowByText(page, TEMPLATE_NAME);
    await expandScenarioTemplateRow(page, row);

    const taskNode = findTaskNode(page, TASK_NAME);
    await expect(taskNode).toBeVisible({ timeout: 10000 });
    await openTaskMenu(page, taskNode);
    await clickContextMenuItem(page, 'Edit');

    // 2. Set the Expected Output and Save.
    await fillTaskDialog(page, { expectedOutput: EXPECTED_OUTPUT });

    // expect: The detail panel reports the configured expected output.
    const detail = findTaskNode(page, TASK_NAME);
    await expect(detail).toContainText(`Expected Output: ${EXPECTED_OUTPUT}`);
  });
});
