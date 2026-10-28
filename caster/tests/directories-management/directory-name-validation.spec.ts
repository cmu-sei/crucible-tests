// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: caster/caster-test-plan.md
// seed: seed.spec.ts

import {
  test,
  expect,
  Services,
  casterApi,
  seedCasterDirectory,
  seedCasterProject,
  CASTER_THEMES,
  setCasterTheme,
} from '../../fixtures';

// Directory names become archive entry paths on export, so the API only accepts
// letters, numbers, -, _ and ., and rejects . and .. and the names Caster reserves
// inside an archive. The UI does no checking of its own and shows the API's answer.
const NAME_RULE =
  'Directory names can only include letters, numbers, -, _, and ., cannot be . or .., ' +
  'and cannot be one of the reserved names __Workspaces__, __Caster__';

for (const theme of CASTER_THEMES) {
  test.describe(`${theme} theme › Directories Management`, () => {
    test('Directory Names Are Limited To Archive-Safe Characters', async ({
      casterAuthenticatedPage: page,
      cleanupCasterProject,
    }) => {
      await setCasterTheme(page, theme);
      const projectId = await seedCasterProject(page, `Dir Name Project ${Date.now()}`);
      cleanupCasterProject(projectId);
      await page.goto(`${Services.Caster.UI}/projects/${projectId}`);

      for (const name of ['has space', '..', '__Workspaces__', 'slash/name']) {
        // 1. Try to create a directory with a name the rule rejects
        await page.getByText('Add Directory').filter({ visible: true }).first().click();
        const create = page.getByRole('dialog', { name: 'Add Directory' });
        await create.getByRole('textbox', { name: 'Name' }).fill(name);
        await create.getByRole('button', { name: 'Save' }).click();

        // expect: the API's validation error, with the rule in its details
        const error = page.getByRole('dialog').filter({
          has: page.getByRole('heading', { name: 'One or more validation errors occurred.' }),
        });
        await expect(error).toBeVisible();
        await error.getByRole('button', { name: 'Error Details' }).click();
        await expect(error.getByRole('region', { name: 'Error Details' })).toContainText(NAME_RULE);
        await error.getByRole('button', { name: 'Close' }).click();
        await expect(error).toBeHidden();
      }

      // expect: none of them was created
      expect((await casterApi(page, 'GET', `projects/${projectId}/directories`)).body).toHaveLength(0);

      // 2. Create one using every character the rule allows
      const allowed = 'Infra_v1.2-final';
      await page.getByText('Add Directory').filter({ visible: true }).first().click();
      const create = page.getByRole('dialog', { name: 'Add Directory' });
      await create.getByRole('textbox', { name: 'Name' }).fill(allowed);
      await create.getByRole('button', { name: 'Save' }).click();

      // expect: it is created and listed
      await expect(create).toBeHidden();
      await expect(page.getByRole('button', { name: allowed, exact: true })).toBeVisible();
    });

    test('Renaming A Directory Follows The Same Rule', async ({ casterAuthenticatedPage: page, cleanupCasterProject }) => {
      await setCasterTheme(page, theme);
      const projectId = await seedCasterProject(page, `Dir Rename Project ${Date.now()}`);
      cleanupCasterProject(projectId);
      const directoryId = await seedCasterDirectory(page, projectId, 'Rename-Me');

      // 1. Rename it to a name with a space
      const rejected = await casterApi(page, 'PATCH', `directories/${directoryId}`, { name: 'Rename Me' });

      // expect: a 400 naming the rule, and the name unchanged
      expect(rejected.status).toBe(400);
      expect(rejected.body.errors.Name).toEqual([NAME_RULE]);
      expect((await casterApi(page, 'GET', `directories/${directoryId}`)).body.name).toBe('Rename-Me');

      // 2. Rename it to a valid name
      const renamed = await casterApi(page, 'PATCH', `directories/${directoryId}`, { name: 'Renamed_Dir' });

      // expect: it is renamed, and the sidebar shows the new name
      expect(renamed.status).toBe(200);
      await page.goto(`${Services.Caster.UI}/projects/${projectId}`);
      await expect(page.getByRole('button', { name: 'Renamed_Dir', exact: true })).toBeVisible();
    });
  });
}
