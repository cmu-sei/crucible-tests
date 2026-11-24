// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: caster/caster-test-plan.md
// seed: seed.spec.ts

import {
  test,
  expect,
  casterApi,
  openCasterDirectory,
  seedCasterDirectory,
  seedCasterProject,
  CASTER_THEMES,
  setCasterTheme,
} from '../../fixtures';

// A file is written to `<workspace working directory>/<name>` before a run, so the
// API rejects any name that could land outside it. Everything else is allowed,
// including spaces inside the name, so no name Caster accepted before stops working.
const NAME_RULE =
  'File names cannot be . or .., cannot contain path separators or control characters, ' +
  'and cannot begin or end with whitespace';

for (const theme of CASTER_THEMES) {
  test.describe(`${theme} theme › Error Handling and Validation`, () => {
    test('File Names Cannot Leave The Working Directory', async ({ casterAuthenticatedPage: page, cleanupCasterProject }) => {
      await setCasterTheme(page, theme);
      const projectId = await seedCasterProject(page, `File Name Project ${Date.now()}`);
      cleanupCasterProject(projectId);
      const directoryId = await seedCasterDirectory(page, projectId, 'File-Name-Dir');

      await openCasterDirectory(page, projectId, 'File-Name-Dir');
      await page.getByRole('button', { name: 'FILES', exact: true }).click();
      const files = page.getByRole('region', { name: 'FILES' });

      for (const name of ['../escape.tf', 'nested/main.tf', '..', ' padded.tf']) {
        // 1. Try to add a file with a name that could escape the working directory
        await files.getByText('Add File').click();
        const create = page.getByRole('dialog', { name: 'Add File' });
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
      expect((await casterApi(page, 'GET', `directories/${directoryId}/files`)).body).toHaveLength(0);

      // 2. Add one with a space inside its name, which stays allowed
      await files.getByText('Add File').click();
      const create = page.getByRole('dialog', { name: 'Add File' });
      await create.getByRole('textbox', { name: 'Name' }).fill('my vars.auto.tfvars');
      await create.getByRole('button', { name: 'Save' }).click();

      // expect: it is created and listed
      await expect(create).toBeHidden();
      await expect(files.getByText('my vars.auto.tfvars', { exact: true })).toBeVisible();
    });
  });
}
