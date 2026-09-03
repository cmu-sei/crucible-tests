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
 * A VM-targeting task selects its VMs by a "VM Mask" — a substring matched against VM
 * names. The VM Mask field only renders in the dialog once a VM-requiring Action is
 * chosen (e.g. "Power on a VM"), so configuring it is a pure UI concern that needs no
 * live VM. This spec picks such an action, sets a mask, saves, then re-opens the Edit
 * dialog to confirm both the action and the mask persisted (neither is shown in the
 * read-only detail panel by mask, though the panel does echo the action). Cleanup is
 * by parent-template prefix (tasks cascade-delete).
 */
test.describe('Scenario Template Tasks', () => {
  const TEMPLATE_NAME = `E2E Task VmMask Template ${Date.now()}`;
  const TASK_NAME = `E2E VmMask Task ${Date.now()}`;
  const VM_ACTION = 'Power on a VM';
  const VM_MASK = 'web-';

  let templateId: string;

  test.beforeEach(async () => {
    templateId = await seedScenarioTemplate(TEMPLATE_NAME, 'Template holding a VM task', 1);
    await seedTask(templateId, TASK_NAME, 'Task whose VM mask is configured');
  });

  test.afterEach(async () => {
    await deleteScenarioTemplatesByPrefix(['E2E Task VmMask Template']);
  });

  test('Configure task VM selection with mask', async ({
    steamfitterAuthenticatedPage: page,
  }) => {
    // 1. Expand the template and open the task's Edit dialog.
    await navigateToHomeSection(page, 'Scenario Templates');
    const row = await findHomeRowByText(page, TEMPLATE_NAME);
    await expandScenarioTemplateRow(page, row);

    const taskNode = findTaskNode(page, TASK_NAME);
    await expect(taskNode).toBeVisible({ timeout: 10000 });
    await openTaskMenu(page, taskNode);
    await clickContextMenuItem(page, 'Edit');

    // 2. Choose a VM-requiring action (reveals the VM Mask field), set the mask, Save.
    await fillTaskDialog(page, { action: VM_ACTION, vmMask: VM_MASK });

    // 3. Re-open Edit to confirm both persisted. The VM Mask field only renders when a
    // VM-requiring action is selected, so a populated VM Mask on re-open proves the
    // action stuck too; this is the authoritative check (the read-only detail panel's
    // body can re-collapse after the post-save tree refresh, so we don't rely on it).
    const detail = findTaskNode(page, TASK_NAME);
    await expect(detail).toBeVisible({ timeout: 10000 });
    await openTaskMenu(page, detail);
    await clickContextMenuItem(page, 'Edit');
    const dialog = page.getByRole('dialog');
    await expect(dialog.getByRole('textbox', { name: /VM Mask/ })).toHaveValue(VM_MASK, {
      timeout: 10000,
    });
    await dialog.getByRole('button', { name: 'Cancel' }).click();
    await expect(dialog).not.toBeVisible({ timeout: 10000 });
  });
});
