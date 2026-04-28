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
    templateName = `Details Test ${Date.now()}`;
    await createTestEventTemplate(page, templateName);
  });

  test.afterEach(async ({ page }) => {
    await deleteEventTemplateByName(page, templateName);
    await deleteDefaultEventTemplates(page);
  });

  test('View Event Template Details', async ({ page }) => {
    // 1. Verify we're on the admin Event Templates section (beforeEach already navigated here)
    await expect(page.getByRole('heading', { name: 'Administration' })).toBeVisible();

    // expect: Event templates list is visible
    await expect(page.getByRole('table')).toBeVisible();

    // 2. Click on the test event template edit button
    const editButton = page.getByRole('button', { name: `Edit: ${templateName}` });
    await expect(editButton).toBeVisible({ timeout: 15000 });
    await editButton.click();

    // expect: The event template detail view is displayed
    await expect(page.getByRole('dialog', { name: 'Edit Event Template' })).toBeVisible();

    // expect: All template properties are shown: name, description, duration
    await expect(page.getByRole('textbox', { name: 'Name (required)' })).toBeVisible();
    await expect(page.getByRole('textbox', { name: 'Event Template Description' })).toBeVisible();
    await expect(page.getByRole('spinbutton', { name: 'Duration Hours' })).toBeVisible();

    // expect: Associated Player View ID, Caster Directory ID, and Steamfitter Scenario Template ID are visible
    await expect(page.getByRole('combobox', { name: 'Player View Template' })).toBeVisible();
    await expect(page.getByRole('combobox', { name: 'Caster Directory' })).toBeVisible();
    await expect(page.getByRole('combobox', { name: 'Steamfitter Scenario Template' })).toBeVisible();

    // expect: Public and Use Dynamic Host checkboxes are visible
    await expect(page.getByRole('checkbox', { name: 'Public' })).toBeVisible();
    await expect(page.getByRole('checkbox', { name: 'Use Dynamic Host' })).toBeVisible();

    // Close the dialog
    await page.getByRole('button', { name: 'Cancel' }).first().click();
  });
});
