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
} from '../../test-helpers';

/**
 * A scenario template's tasks are shown in an expandable detail row: clicking the
 * template row reveals the task tree (`app-tasks`). This spec seeds a template with a
 * task via the API and verifies the task appears in the tree when the row is expanded.
 * Deleting the template cascades its tasks, so cleanup is by template name prefix.
 */
test.describe('Scenario Template Tasks', () => {
  const TEMPLATE_NAME = `E2E Task View Template ${Date.now()}`;
  const TASK_NAME = `E2E View Task ${Date.now()}`;

  let templateId: string;

  test.beforeEach(async () => {
    templateId = await seedScenarioTemplate(TEMPLATE_NAME, 'Template holding a task to view', 1);
    await seedTask(templateId, TASK_NAME, 'Task seeded for the view test');
  });

  test.afterEach(async () => {
    await deleteScenarioTemplatesByPrefix(['E2E Task View Template']);
  });

  test('View tasks within a scenario template', async ({
    steamfitterAuthenticatedPage: page,
  }) => {
    // 1. Open the Scenario Templates section and locate the seeded template.
    await navigateToHomeSection(page, 'Scenario Templates');
    const row = await findHomeRowByText(page, TEMPLATE_NAME);
    await expect(row).toBeVisible({ timeout: 10000 });

    // 2. Expand the row to reveal the task tree.
    await expandScenarioTemplateRow(page, row);

    // expect: The seeded task appears as a node in the tree.
    const taskNode = findTaskNode(page, TASK_NAME);
    await expect(taskNode).toBeVisible({ timeout: 10000 });
  });
});
