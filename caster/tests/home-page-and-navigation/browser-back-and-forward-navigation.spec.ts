// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: caster/caster-test-plan.md
// seed: seed.spec.ts

import { test, expect, Services, expectCasterProjectOpen } from '../../fixtures';

test.describe('Home Page and Navigation', () => {
  test('Browser Back and Forward Navigation', async ({ casterAuthenticatedPage: page, cleanupCasterProject }) => {

    const projectName = `Nav Test Project ${Date.now()}`;

    // 1. Navigate to home page
    await expect(page.getByText('My Projects')).toBeVisible();

    // Create a project for navigation testing - click the add project button (plus icon next to "My Projects")
    await page.getByText('My Projects').locator('..').getByRole('button').click();
    await expect(page.getByRole('dialog', { name: 'Create New Project?' })).toBeVisible();
    await page.getByRole('textbox', { name: 'Name' }).fill(projectName);
    await page.getByRole('button', { name: 'Save' }).click();
    cleanupCasterProject(await expectCasterProjectOpen(page, projectName));

    // 3. Navigate to admin section
    await page.goto(Services.Caster.UI + '/admin');
    await expect(page.getByRole('heading', { name: 'Administration' })).toBeVisible({ timeout: 10000 });

    // 4. Click browser back button
    await page.goBack();

    // expect: Application navigates back to project details page
    await expect(page).toHaveURL(/\/projects\//, { timeout: 10000 });

    // 5. Click browser forward button
    await page.goForward();

    // expect: Application navigates forward to admin page
    await expect(page).toHaveURL(/\/admin/, { timeout: 10000 });
  });
});
