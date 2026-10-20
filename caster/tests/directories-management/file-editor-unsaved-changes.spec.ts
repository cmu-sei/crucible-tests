// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: caster/caster-test-plan.md
// seed: seed.spec.ts

import { Page } from '@playwright/test';
import { test, expect, expectCasterProjectOpen, casterApi } from '../../fixtures';

/**
 * Create a project in the UI, then a directory and one file through the API,
 * and open the file in the editor. Returns the file ID.
 */
async function openNewFile(
  page: Page,
  cleanupCasterProject: (projectId: string) => void,
  fileName: string,
  content: string
): Promise<string> {
  const projectName = `Editor Changes Project ${Date.now()}`;

  await expect(page.getByText('My Projects')).toBeVisible();
  await page.locator('button:has(.mdi-plus-circle)').click();
  await expect(page.getByRole('dialog', { name: 'Create New Project?' })).toBeVisible();
  await page.getByRole('textbox', { name: 'Name' }).fill(projectName);
  await page.getByRole('button', { name: 'Save' }).click();
  const projectId = await expectCasterProjectOpen(page, projectName);
  cleanupCasterProject(projectId);

  const directory = await casterApi(page, 'POST', 'directories', { projectId, name: 'editor-dir' });
  const file = await casterApi(page, 'POST', 'files', { directoryId: directory.id, name: fileName, content });
  expect((await casterApi(page, 'GET', `files/${file.id}`)).content).toBe(content);

  await page.reload();
  await page.getByRole('button', { name: 'editor-dir' }).click();
  await page.getByRole('button', { name: 'FILES' }).click();
  await page.getByText(fileName, { exact: true }).click();
  return file.id;
}

test.describe('Directories Management', () => {
  test('File with mixed line endings is not reported unsaved, and saves with LF', async ({
    casterAuthenticatedPage: page,
    cleanupCasterProject,
  }) => {
    // Monaco shows mixed endings as all-CRLF, which used to mark the file
    // unsaved as soon as it opened
    const fileId = await openNewFile(
      page,
      cleanupCasterProject,
      'mixed.tf',
      'variable "a" {}\r\nvariable "b" {}\nvariable "c" {}\r\n'
    );
    const editor = page.locator('#editor .monaco-editor');
    const save = page.getByRole('button', { name: 'Save Changes' });
    await expect(editor).toContainText('variable "c" {}', { timeout: 15000 });

    // Opening the file without editing it leaves it saved
    await expect(save).toBeDisabled();

    // Closing the tab does not ask to discard changes
    await page.getByRole('button', { name: 'Close mixed.tf' }).click();
    await expect(page.getByText('Not all changes have been saved!!!')).toBeHidden();
    await expect(page.getByRole('button', { name: 'Close mixed.tf' })).toBeHidden();

    // Edit and save: the stored file has LF endings only
    await page.getByText('mixed.tf', { exact: true }).click();
    await expect(editor).toContainText('variable "c" {}', { timeout: 15000 });
    await page.getByRole('button', { name: 'Edit this file' }).click();
    await expect(page.getByRole('button', { name: 'Finish editing' })).toBeVisible();
    await editor.click();
    await page.keyboard.press('Control+End');
    await page.keyboard.type('variable "d" {}');
    await expect(save).toBeEnabled();
    await save.click();
    await expect(save).toBeDisabled();

    const saved = await casterApi(page, 'GET', `files/${fileId}`);
    expect(saved.content).toBe('variable "a" {}\nvariable "b" {}\nvariable "c" {}\nvariable "d" {}');

    await page.getByRole('button', { name: 'Finish editing' }).click();
    await expect(page.getByRole('button', { name: 'Edit this file' })).toBeVisible();
  });

  test('Unsaved edits survive an update that does not change the content', async ({
    casterAuthenticatedPage: page,
    cleanupCasterProject,
  }) => {
    // A rename (like a lock change) reaches the editor without content, which
    // used to reload the file over the user's unsaved edits
    const fileId = await openNewFile(page, cleanupCasterProject, 'draft.tf', 'variable "a" {}\n');
    const editor = page.locator('#editor .monaco-editor');
    const save = page.getByRole('button', { name: 'Save Changes' });
    await expect(editor).toContainText('variable "a" {}', { timeout: 15000 });

    await page.getByRole('button', { name: 'Edit this file' }).click();
    await expect(page.getByRole('button', { name: 'Finish editing' })).toBeVisible();
    await editor.click();
    await page.keyboard.press('Control+End');
    await page.keyboard.type('variable "draft" {}');
    await expect(save).toBeEnabled();

    const reloads: string[] = [];
    page.on('request', (r) => {
      if (r.method() === 'GET' && r.url().endsWith(`/api/files/${fileId}`)) reloads.push(r.url());
    });
    await casterApi(page, 'POST', `files/${fileId}/actions/rename`, { name: 'renamed.tf' });
    await expect(page.getByRole('button', { name: 'Close renamed.tf' })).toBeVisible();
    await page.waitForLoadState('networkidle');

    expect(reloads).toEqual([]);
    await expect(editor).toContainText('variable "draft" {}');
    await expect(save).toBeEnabled();

    await save.click();
    await expect(save).toBeDisabled();
    expect((await casterApi(page, 'GET', `files/${fileId}`)).content).toBe('variable "a" {}\nvariable "draft" {}');

    await page.getByRole('button', { name: 'Finish editing' }).click();
    await expect(page.getByRole('button', { name: 'Edit this file' })).toBeVisible();
  });
});
