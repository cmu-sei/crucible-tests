// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: steamfitter/steamfitter-test-plan.md
// seed: tests/seed.spec.ts

import { writeFile } from 'node:fs/promises';
import { Page } from '@playwright/test';
import { test, expect } from '../../fixtures';
import {
  seedScenarioTemplate,
  seedTask,
  deleteScenarioTemplatesByPrefix,
  apiGetScenarioTemplatesByNamePrefix,
  apiGetScenarioTemplateTasks,
} from '../../fixtures';
import { navigateToHomeSection, findHomeRowByText } from '../../test-helpers';

/**
 * Export a scenario template from a selection, as Player and Alloy do, then import
 * the json back through the "Import Scenario Templates" dialog.
 *
 * The seeded template has a parent task and a child task triggered by the parent's
 * success, so the round trip has to rebuild the task tree, not just copy rows.
 * The source still exists when the file comes back, so the copy is renamed
 * "<name> - <user>"; it is found by the name prefix and told apart from the source by id.
 */
test.describe('Scenario Templates Management', () => {
  const TEMPLATE_NAME = `E2E Export Template ${Date.now()}`;
  const PARENT_TASK = 'E2E Export Parent Task';
  const CHILD_TASK = 'E2E Export Child Task';
  let templateId: string;
  let parentTaskId: string;
  let childTaskId: string;

  test.beforeEach(async () => {
    templateId = await seedScenarioTemplate(TEMPLATE_NAME, 'Template to be exported', 2);
    parentTaskId = await seedTask(templateId, PARENT_TASK, 'Root task', { score: 3 });
    childTaskId = await seedTask(templateId, CHILD_TASK, 'Runs after the root task', {
      triggerTaskId: parentTaskId,
      triggerCondition: 'Success',
      score: 5,
    });
  });

  // The source and every imported copy start with the name, so one prefix removes them all.
  test.afterEach(async () => {
    await deleteScenarioTemplatesByPrefix(['E2E Export Template']);
  });

  async function exportSelected(page: Page, outputPath: string): Promise<string> {
    await navigateToHomeSection(page, 'Scenario Templates');
    const row = await findHomeRowByText(page, TEMPLATE_NAME);
    await expect(row).toBeVisible({ timeout: 10000 });

    await row.getByRole('checkbox', { name: `Select ${TEMPLATE_NAME}` }).check();
    await page.getByRole('button', { name: 'Export 1 Selected Scenario Template' }).click();

    const dialog = page.getByRole('dialog');
    await expect(dialog).toContainText('Selected Scenario Templates: 1');
    await expect(dialog).toContainText('VM Credential passwords are included');
    const downloadPromise = page.waitForEvent('download', { timeout: 15000 });
    await dialog.getByRole('button', { name: 'Export', exact: true }).click();
    const download = await downloadPromise;
    await expect(dialog).not.toBeVisible({ timeout: 5000 });

    expect(download.suggestedFilename()).toMatch(/^E2E-Export-Template-\d+\.json$/);
    await download.saveAs(outputPath);
    return outputPath;
  }

  async function importFile(page: Page, filePath: string) {
    await page.getByRole('button', { name: 'Import Scenario Templates' }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible({ timeout: 5000 });

    await dialog.getByLabel('Scenario Template export file').setInputFiles(filePath);
    const importResponse = page.waitForResponse(
      (response) =>
        response.url().includes('/actions/import') && response.request().method() === 'POST',
      { timeout: 15000 }
    );
    await dialog.getByRole('button', { name: 'Import', exact: true }).click();
    const response = await importResponse;
    expect(response.ok()).toBeTruthy();
    return dialog;
  }

  test('Export a selected scenario template and import it as a renamed copy', async (
    { steamfitterAuthenticatedPage: page },
    testInfo
  ) => {
    // 1. Export the seeded template from a selection.
    const file = await exportSelected(page, testInfo.outputPath('export.json'));

    // 2. Import it while the source still exists.
    // expect: One template imported, renamed "<name> - <user>", with a note and no failures.
    const dialog = await importFile(page, file);
    const imported = dialog.locator('.imported-list li');
    await expect(imported).toHaveCount(1, { timeout: 10000 });
    await expect(imported).toContainText(`${TEMPLATE_NAME} - `);
    await expect(dialog.locator('.warning-list')).toContainText('already exists and was imported as');
    await expect(dialog.locator('.failure-list')).toHaveCount(0);
    await dialog.getByRole('button', { name: 'OK' }).click();
    await expect(dialog).not.toBeVisible({ timeout: 5000 });

    // expect: The copy has new ids, the same details, and the same task tree.
    const templates = await apiGetScenarioTemplatesByNamePrefix(TEMPLATE_NAME);
    expect(templates).toHaveLength(2);
    const copy = templates.find((t) => t.id !== templateId)!;
    expect(copy.name).toMatch(new RegExp(`^${TEMPLATE_NAME} - .+`));
    expect(copy.description).toBe('Template to be exported');
    expect(copy.durationHours).toBe(2);

    const tasks = await apiGetScenarioTemplateTasks(copy.id);
    expect(tasks).toHaveLength(2);
    const parent = tasks.find((t) => t.name === PARENT_TASK)!;
    const child = tasks.find((t) => t.name === CHILD_TASK)!;
    expect(parent).toBeTruthy();
    expect(child).toBeTruthy();
    expect([parentTaskId, childTaskId]).not.toContain(parent.id);
    expect([parentTaskId, childTaskId]).not.toContain(child.id);
    expect(parent.triggerTaskId).toBeNull();
    expect(child.triggerTaskId).toBe(parent.id);
    expect(child.triggerCondition).toBe('Success');
    expect(parent.score).toBe(3);
    expect(child.score).toBe(5);
  });

  test('Import reports a file that is not a scenario template export', async (
    { steamfitterAuthenticatedPage: page },
    testInfo
  ) => {
    const file = testInfo.outputPath('not-an-export.json');
    await writeFile(file, '"not a scenario template"');
    await navigateToHomeSection(page, 'Scenario Templates');

    // expect: The file is listed as a failure and nothing is created.
    const dialog = await importFile(page, file);
    await expect(dialog.locator('.failure-list')).toContainText('not-an-export.json', {
      timeout: 10000,
    });
    await expect(dialog.locator('.imported-list')).toHaveCount(0);
    await dialog.getByRole('button', { name: 'OK' }).click();

    expect(await apiGetScenarioTemplatesByNamePrefix(TEMPLATE_NAME)).toHaveLength(1);
  });
});
