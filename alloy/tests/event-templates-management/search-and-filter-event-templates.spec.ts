// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: alloy/alloy-test-plan.md

import { test, expect } from '@playwright/test';
import { authenticateWithKeycloak, Services } from '../../../shared-fixtures';
import { createTestEventTemplate, deleteEventTemplateByName, deleteDefaultEventTemplates } from '../../test-helpers';

test.describe('Event Templates Management', () => {
  let templateName: string;

  test.beforeEach(async ({ page }) => {
    await authenticateWithKeycloak(page, Services.Alloy.UI);
    templateName = `Search Filter Test ${Date.now()}`;
    await createTestEventTemplate(page, templateName);
  });

  test.afterEach(async ({ page }) => {
    await deleteEventTemplateByName(page, templateName);
    await deleteDefaultEventTemplates(page);
  });

  test('Search and Filter Event Templates', async ({ page }) => {
    // 1. Navigate to admin Event Templates section
    await page.goto(`${Services.Alloy.UI}/admin`);
    await expect(page.getByRole('heading', { name: 'Administration' })).toBeVisible();

    // expect: Event templates list is visible
    await expect(page.getByRole('table')).toBeVisible();

    // 2. Enter a search term in the search box using the known template name
    const searchBox = page.getByRole('textbox', { name: 'Search' });
    await searchBox.fill(templateName);

    // expect: The list filters to show only templates matching the search term
    await expect(page.getByRole('cell', { name: templateName }).first()).toBeVisible();

    // 3. Search for non-existent template
    await searchBox.fill('NonExistentTemplate');

    // expect: No results shown - table has no data rows (status should show 0)
    await expect(page.getByRole('status')).toContainText('0');

    // 4. Clear the search box
    await searchBox.fill('');

    // expect: All event templates are displayed again
    await expect(page.getByRole('cell', { name: templateName }).first()).toBeVisible();
  });
});
