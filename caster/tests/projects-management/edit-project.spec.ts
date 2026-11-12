// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: caster/caster-test-plan.md
// seed: seed.spec.ts

import {
  test,
  expect,
  CASTER_THEMES,
  setCasterTheme,
  seedCasterProject,
  Services,
} from '../../fixtures';

for (const theme of CASTER_THEMES) {
  test.describe(`${theme} theme › Projects Management`, () => {
    test('Edit Project', async ({ casterAuthenticatedPage: page, cleanupCasterProject }) => {
      await setCasterTheme(page, theme);
      const projectName = `Project To Edit ${Date.now()}`;
      const updatedProjectName = `Updated Project Name ${Date.now()}`;

      // Create project via API for testing edit
      const projectId = await seedCasterProject(page, projectName);
      cleanupCasterProject(projectId);

      // Navigate to Projects list
      await page.goto(Services.Caster.UI);
      await expect(page.getByText('My Projects')).toBeVisible();
      const searchBox = page.getByRole('textbox', { name: 'Search' });
      await searchBox.fill(projectName);
      await searchBox.press('End');

      // 2. Click on the edit icon for the project
      const projectRow = page.getByRole('row').filter({ hasText: projectName });
      const editButton = projectRow.getByRole('button').first();
      await editButton.click();

      // expect: The project edit dialog is displayed
      await expect(page.getByRole('dialog')).toBeVisible({ timeout: 5000 });

      // 3. Modify the Name field
      const nameField = page.getByRole('textbox', { name: 'Name' });
      await expect(nameField).toBeVisible();
      await nameField.clear();
      await nameField.fill(updatedProjectName);

      // expect: The name field accepts the new value
      await expect(nameField).toHaveValue(updatedProjectName);

      // 4. Click 'Save' button
      await page.getByRole('button', { name: 'Save' }).click();

      // expect: The updated name is reflected in the project list.
      await searchBox.fill(updatedProjectName);
      await searchBox.press('End');
      await expect(page.getByRole('link', { name: updatedProjectName })).toBeVisible();
    });
  });
}
