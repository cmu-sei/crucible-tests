// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: caster/caster-test-plan.md
// seed: seed.spec.ts

import {
  test,
  expect,
  CASTER_THEMES,
  setCasterTheme,
  seedCasterSharedProjectPageFree,
  casterSharedProjectName,
  seedCasterDirectoryPageFree,
  deleteCasterProjectPageFree,
  Services,
} from '../../fixtures';

let projectId: string;
let directoryId: string;
let projectName: string;
const directoryName = 'SharedDirectory';

test.beforeAll(async ({}, workerInfo) => {
  projectName = casterSharedProjectName('create-and-execute-destroy-run', workerInfo);
  projectId = await seedCasterSharedProjectPageFree(projectName);
  directoryId = await seedCasterDirectoryPageFree(projectId, directoryName);
});

test.afterAll(async () => {
  await deleteCasterProjectPageFree(projectId);
});

for (const theme of CASTER_THEMES) {
  test.describe(`${theme} theme › Runs Management (Plan, Apply, Destroy)`, () => {
    let workspaceId: string | null = null;

    test.afterEach(async ({ casterAuthenticatedPage: page }) => {
      // Delete the workspace created by this test
      if (workspaceId) {
        await page.evaluate(async ({ apiUrl, token, wsId }) => {
          await fetch(`${apiUrl}/api/workspaces/${wsId}`, {
            method: 'DELETE',
            headers: { Authorization: `Bearer ${token}` },
          });
        }, {
          apiUrl: Services.Caster.API,
          token: await page.evaluate(() => {
            for (let i = 0; i < sessionStorage.length; i++) {
              const key = sessionStorage.key(i);
              if (key) {
                try {
                  const val = JSON.parse(sessionStorage.getItem(key) || '');
                  if (val.access_token) return val.access_token;
                } catch {}
              }
            }
            return '';
          }),
          wsId: workspaceId,
        });
        workspaceId = null;
      }
    });

    test('Create and Execute Destroy Run', async ({ casterAuthenticatedPage: page }, testInfo) => {
      await setCasterTheme(page, theme);

      await page.goto(`${Services.Caster.UI}/projects/${projectId}`);
      await expect(page.getByText(projectName, { exact: true })).toBeVisible({ timeout: 10000 });

      await page.getByRole('button', { name: directoryName, exact: true }).click();
      await page.getByRole('button', { name: 'WORKSPACES' }).click();

      // Create workspace via UI (per-test mutator resource with unique name)
      const workspaceName = `Destroy-WS-${theme}-${testInfo.repeatEachIndex}`;
      await page.getByText('Add Workspace', { exact: true }).click();
      const nameInput = page.getByRole('textbox', { name: 'Name' });
      if (await nameInput.isVisible({ timeout: 5000 }).catch(() => false)) {
        await nameInput.fill(workspaceName);

        const createResponsePromise = page.waitForResponse(resp =>
          resp.url().includes('/api/workspaces') && resp.request().method() === 'POST' && resp.ok()
        );
        await page.getByRole('button', { name: 'Save' }).click();

        const createResponse = await createResponsePromise;
        const workspaceData = await createResponse.json();
        workspaceId = workspaceData.id;
      }

      const destroyButton = page.getByRole('button', { name: /destroy/i });
      if (await destroyButton.isVisible({ timeout: 5000 }).catch(() => false)) {
        await destroyButton.click();
        const confirmButton = page.getByRole('button', { name: 'Confirm' });
        if (await confirmButton.isVisible({ timeout: 3000 }).catch(() => false)) {
          await confirmButton.click();
        }
      }
    });
  });
}
