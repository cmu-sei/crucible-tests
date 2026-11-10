// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: caster/caster-test-plan.md
// seed: seed.spec.ts

import {
  test,
  expect,
  casterApi,
  openCasterDirectory,
  seedCasterFile,
  seedCasterProjectPageFree,
  seedCasterDirectoryPageFree,
  seedCasterWorkspacePageFree,
  deleteCasterProjectPageFree,
  deleteCasterWorkspacePageFree,
  CASTER_THEMES,
  setCasterTheme,
} from '../../fixtures';

// Caster has no per-workspace Lock/Unlock control: the API's workspace lock is an
// internal mutex taken while a run executes, and the only user-facing switch is the
// global "Disable Workspace Operations" toggle (covered by
// global-workspace-settings/enable-disable-operations.spec.ts — it is global state, so
// it is not flipped here). What a user can lock and unlock inside a workspace is the
// edit lock on the workspace's files: "Edit this file" takes the lock (the tree shows
// the file-lock icon, the API records lockedById) and "Finish editing" releases it.
test.describe('Workspaces Management › Lock and Unlock Workspace', () => {
  let projectId: string;
  let directoryId: string;
  const directoryName = 'WS-Lock-Dir';
  let workspaceId: string | null = null;

  test.beforeAll(async () => {
    projectId = await seedCasterProjectPageFree('E2E Shared Project [lock-and-unlock-workspace]');
    directoryId = await seedCasterDirectoryPageFree(projectId, directoryName);
  });

  test.beforeEach(() => {
    workspaceId = null;
  });

  test.afterEach(async () => {
    if (workspaceId) {
      await deleteCasterWorkspacePageFree(workspaceId);
    }
  });

  test.afterAll(async () => {
    await deleteCasterProjectPageFree(projectId);
  });

  for (const theme of CASTER_THEMES) {
    test(`Lock and Unlock Workspace - ${theme}`, async ({ casterAuthenticatedPage: page }, testInfo) => {
      await setCasterTheme(page, theme);

      // Each test gets its own workspace and workspace file (mutator: locks/unlocks it)
      const workspaceName = `Lock_WS_${theme}_${testInfo.repeatEachIndex}`;
      const fileName = `lock-${theme}_${testInfo.repeatEachIndex}.tf`;
      workspaceId = await seedCasterWorkspacePageFree(directoryId, workspaceName);
      const fileId = await seedCasterFile(page, directoryId, fileName, '# locked file\n', workspaceId);

      try {
        // 1. Navigate to the workspace and expand it to list its files
        await openCasterDirectory(page, projectId, directoryName);
        await page.getByRole('button', { name: 'WORKSPACES' }).click();
        const workspaces = page.getByRole('region', { name: 'WORKSPACES' });
        const wsHeader = workspaces.getByRole('button', { name: workspaceName, exact: true });
        await expect(wsHeader).toBeVisible();
        // The header's name link opens the workspace view; the expansion chevron only
        // toggles the file list.
        await wsHeader.locator('.mat-expansion-indicator').click();
        const workspaceFiles = workspaces.getByRole('region', { name: workspaceName, exact: true });
        const fileLink = workspaceFiles.getByText(fileName, { exact: true });
        await expect(fileLink).toBeVisible();
        const fileRow = workspaceFiles.locator('mat-list-item').filter({ hasText: fileName });
        await expect(fileRow.locator('mat-icon.mdi-file')).toBeVisible();

        // 2. Open the file and lock it
        await fileLink.click();
        const lockButton = page.getByRole('button', { name: 'Edit this file' });
        const unlockButton = page.getByRole('button', { name: 'Finish editing' });
        await expect(lockButton).toBeEnabled();
        await lockButton.click();

        // expect: the file is locked by the current user, and the tree shows the lock icon
        await expect(unlockButton).toBeVisible();
        await expect(fileRow.locator('mat-icon.mdi-file-lock')).toBeVisible();
        await expect
          .poll(async () => (await casterApi(page, 'GET', `files/${fileId}`)).body.lockedById)
          .not.toBeNull();

        // 3. Unlock it
        await unlockButton.click();

        // expect: the lock is released and the indicator removed
        await expect(lockButton).toBeVisible();
        await expect(fileRow.locator('mat-icon.mdi-file')).toBeVisible();
        await expect(fileRow.locator('mat-icon.mdi-file-lock')).toHaveCount(0);
        await expect
          .poll(async () => (await casterApi(page, 'GET', `files/${fileId}`)).body.lockedById)
          .toBeNull();
      } finally {
        // Release the lock if the test stopped while holding it, so afterAll can delete the project.
        await casterApi(page, 'POST', `files/${fileId}/actions/unlock`);
      }
    });
  }
});
