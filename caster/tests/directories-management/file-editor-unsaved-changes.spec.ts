// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: caster/caster-test-plan.md
// seed: seed.spec.ts

import { Page } from '@playwright/test';
import {
  test,
  expect,
  casterApi,
  casterEditorContent,
  openCasterDirectory,
  seedCasterDirectory,
  seedCasterFile,
  seedCasterProject,
} from '../../fixtures';

const DIRECTORY = 'Editor-Changes-Dir';

/** Seed a project, a directory and one file, and open the file. Returns the file ID. */
async function openSeededFile(
  page: Page,
  cleanupCasterProject: (projectId: string) => void,
  fileName: string,
  content: string
): Promise<string> {
  const projectId = await seedCasterProject(page, `Editor Changes Project ${Date.now()}`);
  cleanupCasterProject(projectId);
  const directoryId = await seedCasterDirectory(page, projectId, DIRECTORY);
  const fileId = await seedCasterFile(page, directoryId, fileName, content);
  expect((await casterApi(page, 'GET', `files/${fileId}`)).body.content).toBe(content);

  await openCasterDirectory(page, projectId, DIRECTORY);
  await page.getByRole('button', { name: 'FILES', exact: true }).click();
  await page.getByRole('region', { name: 'FILES' }).getByText(fileName, { exact: true }).click();
  return fileId;
}

/** Start editing the open file and type at its end. */
async function typeAtEnd(page: Page, text: string): Promise<void> {
  await page.getByRole('button', { name: 'Edit this file' }).click();
  await expect(page.getByRole('button', { name: 'Finish editing' })).toBeVisible();
  // Monaco's own input is invisible; clicking its rendered lines focuses it.
  await page.locator('.monaco-editor .view-lines').click();
  await page.keyboard.press('ControlOrMeta+End');
  await page.keyboard.type(text);
}

test.describe('Directories Management', () => {
  test('File with mixed line endings is not reported unsaved, and saves with LF', async ({
    casterAuthenticatedPage: page,
    cleanupCasterProject,
  }) => {
    // Monaco shows mixed endings as all-CRLF, which used to mark the file
    // unsaved as soon as it opened
    const fileId = await openSeededFile(
      page,
      cleanupCasterProject,
      'mixed.tf',
      'variable "a" {}\r\nvariable "b" {}\nvariable "c" {}\r\n'
    );
    const save = page.getByRole('button', { name: 'Save Changes' });
    await expect.poll(() => casterEditorContent(page)).toContain('variable "c" {}');

    // Opening the file without editing it leaves it saved
    await expect(save).toBeDisabled();

    // Closing the tab does not ask to discard changes
    await page.getByRole('button', { name: 'Close mixed.tf' }).click();
    await expect(page.getByText('Not all changes have been saved!!!')).toBeHidden();
    await expect(page.getByRole('button', { name: 'Close mixed.tf' })).toBeHidden();

    // Edit and save: the stored file has LF endings only
    await page.getByRole('region', { name: 'FILES' }).getByText('mixed.tf', { exact: true }).click();
    await expect.poll(() => casterEditorContent(page)).toContain('variable "c" {}');
    await typeAtEnd(page, 'variable "d" {}');
    await expect(save).toBeEnabled();
    await save.click();
    await expect(save).toBeDisabled();

    const saved = await casterApi(page, 'GET', `files/${fileId}`);
    expect(saved.body.content).toBe('variable "a" {}\nvariable "b" {}\nvariable "c" {}\nvariable "d" {}');

    await page.getByRole('button', { name: 'Finish editing' }).click();
    await expect(page.getByRole('button', { name: 'Edit this file' })).toBeVisible();
  });

  test('Unsaved edits survive an update that does not change the content', async ({
    casterAuthenticatedPage: page,
    cleanupCasterProject,
  }) => {
    // A rename (like a lock change) reaches the editor without content, which
    // used to reload the file over the user's unsaved edits
    const fileId = await openSeededFile(page, cleanupCasterProject, 'draft.tf', 'variable "a" {}\n');
    const save = page.getByRole('button', { name: 'Save Changes' });
    await expect.poll(() => casterEditorContent(page)).toBe('variable "a" {}\n');

    await typeAtEnd(page, 'variable "draft" {}');
    await expect(save).toBeEnabled();

    const reloads: string[] = [];
    page.on('request', (r) => {
      if (r.method() === 'GET' && r.url().endsWith(`/api/files/${fileId}`)) reloads.push(r.url());
    });
    const rename = await casterApi(page, 'POST', `files/${fileId}/actions/rename`, { name: 'renamed.tf' });
    expect(rename.status).toBe(200);
    await expect(page.getByRole('button', { name: 'Close renamed.tf' })).toBeVisible();
    await page.waitForLoadState('networkidle');

    expect(reloads).toEqual([]);
    await expect.poll(() => casterEditorContent(page)).toBe('variable "a" {}\nvariable "draft" {}');
    await expect(save).toBeEnabled();

    await save.click();
    await expect(save).toBeDisabled();
    expect((await casterApi(page, 'GET', `files/${fileId}`)).body.content).toBe(
      'variable "a" {}\nvariable "draft" {}'
    );

    await page.getByRole('button', { name: 'Finish editing' }).click();
    await expect(page.getByRole('button', { name: 'Edit this file' })).toBeVisible();
  });
});
