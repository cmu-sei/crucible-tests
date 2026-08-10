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
  respondToConfirmDialog,
} from '../../test-helpers';

/**
 * Deleting a task through the UI: expand the template's task tree, open the task's
 * menu, choose Delete, and confirm the "Delete Task" prompt (DELETE /api/tasks/{id}).
 * The task node should leave the tree. Cleanup deletes the parent template (a no-op
 * for the task itself once the delete under test succeeds), so it is by template name
 * prefix.
 */
test.describe('Scenario Template Tasks', () => {
  const TEMPLATE_NAME = `E2E Task Delete Template ${Date.now()}`;
  const TASK_NAME = `E2E Delete Task ${Date.now()}`;

  let templateId: string;

  test.beforeEach(async () => {
    templateId = await seedScenarioTemplate(TEMPLATE_NAME, 'Template holding a task to delete', 1);
    await seedTask(templateId, TASK_NAME, 'Task to be deleted');
  });

  test.afterEach(async () => {
    await deleteScenarioTemplatesByPrefix(['E2E Task Delete Template']);
  });

  test('Delete a task from a scenario template', async ({
    steamfitterAuthenticatedPage: page,
  }) => {
    // 1. Open the Scenario Templates section and expand the seeded template.
    await navigateToHomeSection(page, 'Scenario Templates');
    const row = await findHomeRowByText(page, TEMPLATE_NAME);
    await expandScenarioTemplateRow(page, row);

    // 2. Open the task's menu and choose Delete.
    const taskNode = findTaskNode(page, TASK_NAME);
    await expect(taskNode).toBeVisible({ timeout: 10000 });
    await openTaskMenu(page, taskNode);
    await clickContextMenuItem(page, 'Delete');

    // 3. Confirm the "Delete Task" prompt. Wait on the DELETE so removal is persisted
    // before we assert the node is gone.
    const deleteResponse = page.waitForResponse(
      (response) =>
        /\/api\/tasks\//.test(response.url()) &&
        response.request().method() === 'DELETE' &&
        response.ok(),
      { timeout: 15000 }
    );
    await respondToConfirmDialog(page, true);
    await deleteResponse.catch(() => {});

    // expect: The task node no longer appears in the tree.
    await expect(
      page.locator('mat-tree-node').filter({ hasText: TASK_NAME })
    ).toHaveCount(0, { timeout: 10000 });
  });
});
