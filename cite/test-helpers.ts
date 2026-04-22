// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { Page, expect } from '@playwright/test';
import { Services } from '../shared-fixtures';

/**
 * Helper utilities for CITE tests
 */

/**
 * Navigate to CITE admin section and wait for it to load
 * @param page - Playwright Page object
 * @param section - Optional section name (Evaluations, Scoring Models, etc.)
 */
export async function navigateToAdminSection(page: Page, section?: string): Promise<void> {
  const url = section ? `${Services.Cite.UI}/admin?section=${encodeURIComponent(section)}` : `${Services.Cite.UI}/admin`;

  // Helper to handle Keycloak login if needed
  const handleKeycloakLogin = async () => {
    console.log('Keycloak login page detected during navigation, logging in...');
    await page.fill('input[name="username"]', 'admin');
    await page.fill('input[name="password"]', 'admin');
    try {
      await page.click('button:has-text("Sign In")', { timeout: 2000 });
    } catch {
      await page.click('input[type="submit"]');
    }
    // Wait for redirect back to the app
    const appHost = new URL(Services.Cite.UI).host;
    await page.waitForURL((navUrl) => navUrl.host === appHost, { timeout: 30000 });
    await page.waitForLoadState('domcontentloaded');
  };

  await page.goto(url, { waitUntil: 'domcontentloaded' });

  // Angular OIDC client may redirect to Keycloak asynchronously after the page loads.
  // Wait for either the admin table to appear OR a Keycloak redirect to occur.
  const keycloakField = page.locator('input[name="username"]');
  const adminTable = page.locator('table').first();

  try {
    // Race between Keycloak redirect and admin page loading
    const winner = await Promise.race([
      keycloakField.waitFor({ state: 'visible', timeout: 15000 }).then(() => 'keycloak' as const),
      adminTable.waitFor({ state: 'visible', timeout: 15000 }).then(() => 'admin' as const),
    ]);

    if (winner === 'keycloak') {
      console.log('Keycloak login form appeared during admin navigation');
      await handleKeycloakLogin();
      // After login, wait for admin table
      await expect(adminTable).toBeVisible({ timeout: 15000 });
    }
  } catch (error) {
    // Neither appeared - check current URL to provide better error
    const currentUrl = page.url();
    const isOnKeycloak = currentUrl.includes(':8443') || currentUrl.includes('/realms/crucible');

    if (isOnKeycloak) {
      console.log(`On Keycloak page but login form not visible. URL: ${currentUrl}`);
      // Try to handle Keycloak login anyway
      if (await keycloakField.isVisible({ timeout: 2000 }).catch(() => false)) {
        await handleKeycloakLogin();
        await expect(adminTable).toBeVisible({ timeout: 15000 });
        return;
      }
    }

    throw new Error(`Failed to navigate to admin section. Current URL: ${currentUrl}. ${error}`);
  }
}

/**
 * Delete an evaluation by name
 * @param page - Playwright Page object
 * @param evaluationName - Name/description of the evaluation to delete
 * @returns true if deleted, false if not found
 */
export async function deleteEvaluationByName(page: Page, evaluationName: string): Promise<boolean> {
  try {
    // Close any open dialogs first
    const openDialog = page.getByRole('dialog').first();
    if (await openDialog.isVisible({ timeout: 1000 }).catch(() => false)) {
      console.log(`Closing open dialog before cleanup for "${evaluationName}"`);
      const cancelButton = openDialog.getByRole('button', { name: /Cancel|Close/i });
      if (await cancelButton.isVisible({ timeout: 1000 }).catch(() => false)) {
        await cancelButton.click();
        await expect(openDialog).not.toBeVisible({ timeout: 5000 });
      } else {
        await page.keyboard.press('Escape');
        await page.waitForTimeout(500);
      }
    }

    // Ensure we're on the evaluations admin page
    if (!page.url().includes('/admin')) {
      await navigateToAdminSection(page, 'Evaluations');
    }

    const evaluationRow = page.locator('tbody tr').filter({ hasText: evaluationName }).first();
    if (!(await evaluationRow.isVisible({ timeout: 2000 }).catch(() => false))) {
      return false;
    }

    // Click the row to enable action buttons
    await evaluationRow.click();
    await page.waitForTimeout(500);

    // Try to find delete button by title attribute first, fallback to role
    let deleteButton = evaluationRow.locator(`button[title*="Delete ${evaluationName}"]`);
    if (!(await deleteButton.isVisible({ timeout: 1000 }).catch(() => false))) {
      deleteButton = evaluationRow.getByRole('button', { name: 'Delete Evaluation' });
    }

    if (!(await deleteButton.isVisible({ timeout: 1000 }).catch(() => false))) {
      return false;
    }

    // Check if the button is enabled, if not, click the row again to select it
    if (!(await deleteButton.isEnabled({ timeout: 1000 }).catch(() => false))) {
      await evaluationRow.click();
      await page.waitForTimeout(500);
    }

    // Wait for the button to be enabled before clicking
    await expect(deleteButton).toBeEnabled({ timeout: 5000 });
    await deleteButton.click();

    const confirmDialog = page.getByRole('dialog', { name: 'Delete this evaluation?' });
    await expect(confirmDialog).toBeVisible({ timeout: 5000 });

    const yesButton = confirmDialog.getByRole('button', { name: 'Yes' });
    await yesButton.click();

    await expect(confirmDialog).not.toBeVisible({ timeout: 5000 });
    await page.waitForTimeout(1000);

    return true;
  } catch (error) {
    return false;
  }
}

/**
 * Delete a scoring model by name
 * @param page - Playwright Page object
 * @param scoringModelName - Name of the scoring model to delete
 * @returns true if deleted, false if not found
 */
export async function deleteScoringModelByName(page: Page, scoringModelName: string): Promise<boolean> {
  try {
    // Close any open dialogs first
    const openDialog = page.getByRole('dialog').first();
    if (await openDialog.isVisible({ timeout: 1000 }).catch(() => false)) {
      console.log(`Closing open dialog before cleanup for "${scoringModelName}"`);
      const cancelButton = openDialog.getByRole('button', { name: /Cancel|Close/i });
      if (await cancelButton.isVisible({ timeout: 1000 }).catch(() => false)) {
        await cancelButton.click();
        await expect(openDialog).not.toBeVisible({ timeout: 5000 });
      } else {
        // Try pressing Escape
        await page.keyboard.press('Escape');
        await page.waitForTimeout(500);
      }
    }

    await navigateToAdminSection(page, 'Scoring Models');

    // Use .first() to handle Angular Material spacer rows
    const scoringModelRow = page.locator('tbody tr').filter({ hasText: scoringModelName }).first();
    if (!(await scoringModelRow.isVisible({ timeout: 2000 }).catch(() => false))) {
      console.log(`Scoring model "${scoringModelName}" not found for cleanup`);
      return false;
    }

    // Click the row to enable action buttons
    await scoringModelRow.click();
    await page.waitForTimeout(500);

    // Look for the delete button by title attribute (icon buttons use title, not text)
    const deleteButton = scoringModelRow.locator(`button[title*="Delete ${scoringModelName}"]`);

    if (!(await deleteButton.isVisible({ timeout: 1000 }).catch(() => false))) {
      console.log(`Delete button not found for scoring model "${scoringModelName}"`);
      return false;
    }

    await deleteButton.click();

    const confirmDialog = page.getByRole('dialog').first();
    await expect(confirmDialog).toBeVisible({ timeout: 5000 });

    const yesButton = confirmDialog.getByRole('button', { name: /Yes|Delete|Confirm/i });
    await yesButton.click();

    await expect(confirmDialog).not.toBeVisible({ timeout: 5000 });
    await page.waitForTimeout(1000);

    console.log(`Successfully deleted scoring model "${scoringModelName}"`);
    return true;
  } catch (error) {
    console.log(`Failed to delete scoring model "${scoringModelName}":`, error);
    return false;
  }
}

/**
 * Delete a group by name
 * @param page - Playwright Page object
 * @param groupName - Name of the group to delete
 * @returns true if deleted, false if not found
 */
export async function deleteGroupByName(page: Page, groupName: string): Promise<boolean> {
  try {
    // Close any open dialogs first
    const openDialog = page.getByRole('dialog').first();
    if (await openDialog.isVisible({ timeout: 1000 }).catch(() => false)) {
      console.log(`Closing open dialog before cleanup for "${groupName}"`);
      const cancelButton = openDialog.getByRole('button', { name: /Cancel|Close/i });
      if (await cancelButton.isVisible({ timeout: 1000 }).catch(() => false)) {
        await cancelButton.click();
        await expect(openDialog).not.toBeVisible({ timeout: 5000 });
      } else {
        await page.keyboard.press('Escape');
        await page.waitForTimeout(500);
      }
    }

    await navigateToAdminSection(page, 'Groups');

    const groupRow = page.locator('tbody tr').filter({ hasText: groupName }).first();
    if (!(await groupRow.isVisible({ timeout: 2000 }).catch(() => false))) {
      console.log(`Group "${groupName}" not found for cleanup`);
      return false;
    }

    // Click the row to enable action buttons
    await groupRow.click();
    await page.waitForTimeout(500);

    // Look for the delete button by MDI icon (trash icon)
    const deleteButton = groupRow.locator('button mat-icon[fonticon*="trash"]').locator('..');

    if (!(await deleteButton.isVisible({ timeout: 1000 }).catch(() => false))) {
      console.log(`Delete button not found for group "${groupName}"`);
      return false;
    }

    await deleteButton.click();

    const confirmDialog = page.getByRole('dialog').first();
    await expect(confirmDialog).toBeVisible({ timeout: 5000 });

    const yesButton = confirmDialog.getByRole('button', { name: /Yes|Delete|Confirm/i });
    await yesButton.click();

    await expect(confirmDialog).not.toBeVisible({ timeout: 5000 });
    await page.waitForTimeout(1000);

    console.log(`Successfully deleted group "${groupName}"`);
    return true;
  } catch (error) {
    console.log(`Failed to delete group "${groupName}":`, error);
    return false;
  }
}

/**
 * Delete a team type by name
 * @param page - Playwright Page object
 * @param teamTypeName - Name of the team type to delete
 * @returns true if deleted, false if not found
 */
export async function deleteTeamTypeByName(page: Page, teamTypeName: string): Promise<boolean> {
  try {
    // Close any open dialogs first
    const openDialog = page.getByRole('dialog').first();
    if (await openDialog.isVisible({ timeout: 1000 }).catch(() => false)) {
      console.log(`Closing open dialog before cleanup for "${teamTypeName}"`);
      const cancelButton = openDialog.getByRole('button', { name: /Cancel|Close/i });
      if (await cancelButton.isVisible({ timeout: 1000 }).catch(() => false)) {
        await cancelButton.click();
        await expect(openDialog).not.toBeVisible({ timeout: 5000 });
      } else {
        await page.keyboard.press('Escape');
        await page.waitForTimeout(500);
      }
    }

    await navigateToAdminSection(page, 'Team Types');

    const teamTypeRow = page.locator('tbody tr').filter({ hasText: teamTypeName }).first();
    if (!(await teamTypeRow.isVisible({ timeout: 2000 }).catch(() => false))) {
      console.log(`Team type "${teamTypeName}" not found for cleanup`);
      return false;
    }

    // Click the row to enable action buttons
    await teamTypeRow.click();
    await page.waitForTimeout(500);

    // Look for the delete button by MDI icon (trash icon)
    const deleteButton = teamTypeRow.locator('button mat-icon[fonticon*="trash"]').locator('..');

    if (!(await deleteButton.isVisible({ timeout: 1000 }).catch(() => false))) {
      console.log(`Delete button not found for team type "${teamTypeName}"`);
      return false;
    }

    await deleteButton.click();

    const confirmDialog = page.getByRole('dialog').first();
    await expect(confirmDialog).toBeVisible({ timeout: 5000 });

    const yesButton = confirmDialog.getByRole('button', { name: /Yes|Delete|Confirm/i });
    await yesButton.click();

    await expect(confirmDialog).not.toBeVisible({ timeout: 5000 });
    await page.waitForTimeout(1000);

    console.log(`Successfully deleted team type "${teamTypeName}"`);
    return true;
  } catch (error) {
    console.log(`Failed to delete team type "${teamTypeName}":`, error);
    return false;
  }
}

/**
 * Create an evaluation via the admin UI
 * @param page - Playwright Page object
 * @param evaluationName - Description for the new evaluation
 */
export async function createEvaluation(page: Page, evaluationName: string): Promise<void> {
  await navigateToAdminSection(page, 'Evaluations');

  const addButton = page.getByRole('button', { name: 'Add Evaluation' });
  await expect(addButton).toBeVisible({ timeout: 10000 });
  await addButton.click();

  const dialog = page.getByRole('dialog', { name: 'Add Evaluation' });
  await expect(dialog).toBeVisible({ timeout: 5000 });

  const descField = page.getByRole('textbox', { name: 'Evaluation Description' });
  await descField.fill(evaluationName);
  await expect(descField).toHaveValue(evaluationName);

  const scoringModelSelect = page.getByRole('combobox', { name: 'Scoring Model' });
  await expect(scoringModelSelect).toBeVisible({ timeout: 5000 });

  // Wait for the scoring models API to respond before opening the dropdown
  await page.waitForResponse(
    response => response.url().includes('/api/scoringmodels') && response.status() === 200,
    { timeout: 15000 }
  ).catch(() => {});
  await page.waitForTimeout(1500);

  // Try multiple approaches to open the dropdown - Angular Material can be finicky
  // First try clicking the combobox itself
  await scoringModelSelect.click();
  await page.waitForTimeout(1000);

  // Check if options appeared, if not try clicking the trigger element directly
  let firstOption = page.locator('mat-option').first();
  let optionsVisible = await firstOption.isVisible({ timeout: 1000 }).catch(() => false);

  if (!optionsVisible) {
    // Try clicking the mat-select element inside the form field
    const matSelect = page.locator('mat-select[formcontrolname="scoringModelId"], mat-select[ng-reflect-name="scoringModelId"]').first();
    if (await matSelect.isVisible({ timeout: 1000 }).catch(() => false)) {
      await matSelect.click();
      await page.waitForTimeout(1000);
    }
  }

  // Wait for options to appear in the DOM
  firstOption = page.locator('mat-option').first();
  await expect(firstOption).toBeVisible({ timeout: 10000 });
  await firstOption.click();

  // Wait for the dropdown to close and the value to be set
  await page.waitForTimeout(1000);

  const saveButton = dialog.getByRole('button', { name: 'Save' });
  await expect(saveButton).toBeEnabled({ timeout: 5000 });

  // Wait for the POST request to create the evaluation
  const createPromise = page.waitForResponse(
    response => response.url().includes('/api/evaluations') && response.request().method() === 'POST' && response.ok(),
    { timeout: 15000 }
  );

  await saveButton.click();

  // Wait for the evaluation to be created
  await createPromise.catch(() => {});

  await expect(dialog).not.toBeVisible({ timeout: 15000 });
  await page.waitForLoadState('domcontentloaded');
  await page.waitForTimeout(3000);

  // Note: Due to known timing/refresh issues in the CITE UI, evaluations may not immediately
  // appear in the list after creation. The tests that use this helper should verify
  // the evaluation exists when they need to interact with it.
}

/**
 * Clean up all test resources with a specific prefix
 * @param page - Playwright Page object
 * @param prefix - Prefix to identify test resources (e.g., "Test ", "Automation ")
 */
export async function cleanupTestResources(page: Page, prefix: string = 'Test '): Promise<void> {
  // Clean up evaluations
  try {
    await navigateToAdminSection(page, 'Evaluations');
    const evaluationRows = page.locator('tbody tr').filter({ hasText: prefix });
    const count = await evaluationRows.count();
    for (let i = 0; i < count; i++) {
      await deleteEvaluationByName(page, prefix);
    }
  } catch (error) {
    console.log('Error cleaning up evaluations:', error);
  }

  // Clean up scoring models
  try {
    await navigateToAdminSection(page, 'Scoring Models');
    const scoringModelRows = page.locator('tbody tr').filter({ hasText: prefix });
    const count = await scoringModelRows.count();
    for (let i = 0; i < count; i++) {
      await deleteScoringModelByName(page, prefix);
    }
  } catch (error) {
    console.log('Error cleaning up scoring models:', error);
  }

  // Clean up groups
  try {
    await navigateToAdminSection(page, 'Groups');
    const groupRows = page.locator('tbody tr').filter({ hasText: prefix });
    const count = await groupRows.count();
    for (let i = 0; i < count; i++) {
      await deleteGroupByName(page, prefix);
    }
  } catch (error) {
    console.log('Error cleaning up groups:', error);
  }

  // Clean up team types
  try {
    await navigateToAdminSection(page, 'Team Types');
    const teamTypeRows = page.locator('tbody tr').filter({ hasText: prefix });
    const count = await teamTypeRows.count();
    for (let i = 0; i < count; i++) {
      await deleteTeamTypeByName(page, prefix);
    }
  } catch (error) {
    console.log('Error cleaning up team types:', error);
  }
}
