// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: caster/caster-test-plan.md
// seed: seed.spec.ts

import { test, expect, expectCasterProjectOpen } from '../../fixtures';

test.describe('Projects Management', () => {
  test('View Project Details', async ({ casterAuthenticatedPage: page, cleanupCasterProject }) => {
    const projectName = `Project For Details ${Date.now()}`;

    // 1. Navigate to Projects section
    await expect(page.getByText('My Projects')).toBeVisible();

    // Create a project if needed
    await page.locator('button[mattooltip="Add New Project"]').click();
    await expect(page.getByRole('dialog', { name: 'Create New Project?' })).toBeVisible();
    await page.getByRole('textbox', { name: 'Name' }).fill(projectName);

    const createResponsePromise = page.waitForResponse(resp =>
      resp.url().includes('/api/projects') && resp.request().method() === 'POST' && resp.ok()
    );
    await page.getByRole('button', { name: 'Save' }).click();

    // Capture project ID for cleanup
    const createResponse = await createResponsePromise;
    const projectData = await createResponse.json();
    cleanupCasterProject(projectData.id);

    // expect: The project detail view is displayed after creation.
    await expectCasterProjectOpen(page, projectName);

    // expect: Project name is shown in the topbar
    await expect(page.getByText(projectName, { exact: true })).toBeVisible();

    // expect: Sidebar options are available for: Add Directory, Export Project, Import Project
    await expect(page.getByText('Add Directory', { exact: true })).toBeVisible();
    await expect(page.getByText('Export Project', { exact: true })).toBeVisible();
    await expect(page.getByText('Import Project', { exact: true })).toBeVisible();

    // expect: Main content shows placeholder when no file/workspace is selected
    await expect(page.getByText('Please open a file or workspace')).toBeVisible();
  });
});
