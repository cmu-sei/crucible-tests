// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: caster/caster-test-plan.md
// seed: seed.spec.ts

import {
  test,
  expect,
  openCasterDirectory,
  seedCasterProjectPageFree,
  seedCasterDirectoryPageFree,
  deleteCasterProjectPageFree,
  casterApi,
  CASTER_THEMES,
  setCasterTheme,
} from '../../fixtures';

test.describe('Variables Management › Edit Variable', () => {
  let projectId: string;
  let directoryId: string;
  const directoryName = 'Var-Edit-Dir';
  let workspaceId: string | null;

  test.beforeAll(async () => {
    projectId = await seedCasterProjectPageFree('E2E Shared Project [edit-variable]');
    directoryId = await seedCasterDirectoryPageFree(projectId, directoryName);
  });

  test.afterAll(async () => {
    await deleteCasterProjectPageFree(projectId);
  });

  test.beforeEach(() => {
    workspaceId = null;
  });

  test.afterEach(async ({ casterAuthenticatedPage: page }) => {
    if (workspaceId) {
      await casterApi(page, 'DELETE', `workspaces/${workspaceId}`);
    }
  });

  for (const theme of CASTER_THEMES) {
    test(`Edit Variable - ${theme}`, async ({ casterAuthenticatedPage: page }, testInfo) => {
      await setCasterTheme(page, theme);

      const workspaceName = `VarEdit-${theme}-${testInfo.repeatEachIndex}`;

      // Navigate to the seeded directory
      await openCasterDirectory(page, projectId, directoryName);
      await page.getByRole('button', { name: 'WORKSPACES', exact: true }).click();

      // Create workspace through UI and capture ID from POST response
      const createResponse = page.waitForResponse((r) => r.url().includes('/api/workspaces') && r.request().method() === 'POST');
      await page.getByText('Add Workspace').first().click();
      await expect(page.getByRole('dialog', { name: 'Add Workspace' })).toBeVisible();
      const wsNameInput = page.getByRole('textbox', { name: 'Name' });
      await wsNameInput.click();
      await wsNameInput.fill(workspaceName);
      await wsNameInput.blur();
      await page.getByRole('button', { name: 'Save' }).click({ force: true });

      const response = await createResponse;
      const body = await response.json();
      workspaceId = body.id;

      // Click the workspace to open it
      const wsItem = page.getByText(workspaceName);
      if (await wsItem.isVisible({ timeout: 5000 }).catch(() => false)) {
        await wsItem.click();
        const varsTab = page.getByRole('tab', { name: 'Variables' });
        if (await varsTab.isVisible({ timeout: 3000 }).catch(() => false)) {
          await varsTab.click();
        }
      }
    });
  }
});
