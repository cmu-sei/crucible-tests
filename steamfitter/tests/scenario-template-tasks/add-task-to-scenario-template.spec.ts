// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: steamfitter/steamfitter-test-plan.md
// seed: tests/seed.spec.ts

import { test, expect } from '../../fixtures';
import { seedScenarioTemplate, deleteScenarioTemplatesByPrefix } from '../../fixtures';
import {
  navigateToHomeSection,
  findHomeRowByText,
  expandScenarioTemplateRow,
  findTaskNode,
  fillTaskDialog,
} from '../../test-helpers';

/**
 * Adding a task through the UI: expand a template's task tree, click "Add a Task",
 * fill the task dialog, and Save. The task dialog's Save is gated only on a non-empty
 * Name, so a name is enough to persist a new task (POST /api/tasks). The task is
 * removed when its parent template is deleted, so cleanup is by template name prefix.
 */
test.describe('Scenario Template Tasks', () => {
  const TEMPLATE_NAME = `E2E Task Add Template ${Date.now()}`;
  const TASK_NAME = `E2E Added Task ${Date.now()}`;

  test.beforeEach(async () => {
    await seedScenarioTemplate(TEMPLATE_NAME, 'Template to add a task to', 1);
  });

  test.afterEach(async () => {
    await deleteScenarioTemplatesByPrefix(['E2E Task Add Template']);
  });

  test('Add a task to a scenario template', async ({ steamfitterAuthenticatedPage: page }) => {
    // 1. Open the Scenario Templates section and expand the seeded template.
    await navigateToHomeSection(page, 'Scenario Templates');
    const row = await findHomeRowByText(page, TEMPLATE_NAME);
    await expandScenarioTemplateRow(page, row);

    // 2. Click "Add a Task" to open the task dialog, then fill and Save. The helper
    // waits on the tasks POST so the new task is persisted before we assert.
    await page.locator('button[title="Add a Task"]').click();
    await fillTaskDialog(page, {
      name: TASK_NAME,
      description: 'Task added by an automated end-to-end test',
    });

    // expect: The new task appears as a node in the tree.
    const taskNode = findTaskNode(page, TASK_NAME);
    await expect(taskNode).toBeVisible({ timeout: 10000 });
  });
});
