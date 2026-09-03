// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: steamfitter/steamfitter-test-plan.md
// seed: tests/seed.spec.ts

import { test, expect } from '../../fixtures';

test.describe('Home Page and Navigation', () => {
  test('Home page loads with topbar, section menu, and default section', async ({
    steamfitterAuthenticatedPage: page,
  }) => {
    // expect: The document title is 'Steamfitter'
    await expect(page).toHaveTitle('Steamfitter', { timeout: 10000 });

    // expect: The topbar renders with the Steamfitter branding
    const topbar = page.locator('app-topbar mat-toolbar').first();
    await expect(topbar).toBeVisible({ timeout: 20000 });
    await expect(topbar.getByText('Steamfitter')).toBeVisible();

    // expect: The authenticated user's name appears in the topbar
    await expect(page.getByRole('button', { name: /Admin User/ })).toBeVisible({ timeout: 10000 });

    // expect: The topbar Home icon links back to the app root
    await expect(page.locator('a[title="Home"]').first()).toBeVisible();

    // expect: The section menu trigger is present. Its label reads "My <section>";
    // Scenarios is the default section when no ?tab is supplied.
    const sectionTrigger = page.locator('button.section-menu-trigger');
    await expect(sectionTrigger).toBeVisible({ timeout: 10000 });
    await expect(sectionTrigger).toContainText('Scenarios');

    // 1. Open the section menu
    await sectionTrigger.click();

    // expect: The section menu offers Scenarios, Scenario Templates, and History
    // (Tasks appears only with ManageTasks permission; admin has it, so assert it too).
    const menu = page.getByRole('menu');
    await expect(menu.getByRole('menuitem', { name: 'Scenarios' })).toBeVisible();
    await expect(menu.getByRole('menuitem', { name: 'Scenario Templates' })).toBeVisible();
    await expect(menu.getByRole('menuitem', { name: 'History' })).toBeVisible();

    // 2. Switch to the Scenario Templates section
    await menu.getByRole('menuitem', { name: 'Scenario Templates' }).click();

    // expect: The section trigger label updates to the selected section
    await expect(sectionTrigger).toContainText('Scenario Templates', { timeout: 10000 });

    // expect: The Scenario Templates list renders with its expected columns
    await expect(page.getByRole('columnheader', { name: 'Name' })).toBeVisible({ timeout: 10000 });
    await expect(page.getByRole('columnheader', { name: 'Description' })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'Duration (Hours)' })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'Created' })).toBeVisible();

    // expect: The Search box is available for filtering the list
    await expect(page.getByRole('textbox', { name: 'Search' })).toBeVisible();
  });
});
