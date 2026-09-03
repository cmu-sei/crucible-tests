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
 * Editing a task through the UI: expand the template's task tree, open the task's
 * menu, choose Edit, change the name, and Save (PUT /api/tasks/{id}). The renamed
 * task should appear under its new name and no longer under the old one. The task is
 * removed when its parent template is deleted, so cleanup is by template name prefix.
 */
test.describe('Scenario Template Tasks', () => {
  const TEMPLATE_NAME = `E2E Task Edit Template ${Date.now()}`;
  const ORIGINAL_TASK_NAME = `E2E Edit Task ${Date.now()}`;
  const UPDATED_TASK_NAME = `E2E Edit Task Updated ${Date.now()}`;

  let templateId: string;

  test.beforeEach(async () => {
    templateId = await seedScenarioTemplate(TEMPLATE_NAME, 'Template holding a task to edit', 1);
    await seedTask(templateId, ORIGINAL_TASK_NAME, 'Task to be edited');
  });

  test.afterEach(async () => {
    await deleteScenarioTemplatesByPrefix(['E2E Task Edit Template']);
  });

  test('Edit a task in a scenario template', async ({ steamfitterAuthenticatedPage: page }) => {
    // 1. Open the Scenario Templates section and expand the seeded template.
    await navigateToHomeSection(page, 'Scenario Templates');
    const row = await findHomeRowByText(page, TEMPLATE_NAME);
    await expandScenarioTemplateRow(page, row);

    // 2. Open the task's menu and choose Edit.
    const taskNode = findTaskNode(page, ORIGINAL_TASK_NAME);
    await expect(taskNode).toBeVisible({ timeout: 10000 });
    await openTaskMenu(page, taskNode);
    await clickContextMenuItem(page, 'Edit');

    // 3. Rename the task and Save. The helper waits on the tasks PUT.
    await fillTaskDialog(page, { name: UPDATED_TASK_NAME });

    // expect: The renamed task appears in the tree; the old name no longer matches a
    // node.
    const updatedNode = findTaskNode(page, UPDATED_TASK_NAME);
    await expect(updatedNode).toBeVisible({ timeout: 10000 });
    await expect(
      page.locator('mat-tree-node').filter({ hasText: ORIGINAL_TASK_NAME })
    ).toHaveCount(0);
  });
});
