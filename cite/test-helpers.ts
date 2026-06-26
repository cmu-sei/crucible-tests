// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { Page, expect } from '@playwright/test';
import { Services, waitForFirstVisible, settleForResponse } from '../shared-fixtures';

/**
 * Helper utilities for CITE tests
 */

/**
 * Navigate to CITE admin section and wait for it to load.
 *
 * With the storageState-based auth (see global-setup.ts and cite/fixtures.ts), the
 * browser context already carries a valid OIDC token, so we can navigate straight
 * to /admin without the old "visit home first to pre-load Angular state" workaround
 * or any fixed delay. We then wait on a concrete DOM signal (the admin table) rather
 * than sleeping. The Keycloak-redirect race below is retained as a safety net for
 * the rare case where the saved state is missing/expired.
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

  // Navigate directly to admin — storageState provides the token, so no home-page
  // pre-load is needed.
  await page.goto(url, { waitUntil: 'domcontentloaded' });

  // Angular OIDC client may redirect to Keycloak asynchronously after the page loads.
  // Wait for either the admin table to appear OR a Keycloak redirect to occur.
  const keycloakField = page.locator('input[name="username"]');
  const adminTable = page.locator('table').first();

  try {
    // Wait for either the admin table or a Keycloak redirect. Use the
    // cancellation-safe helper rather than Promise.race over two waitFor()s:
    // with storageState auth the admin table always wins, but a bare race would
    // leave the losing keycloakField.waitFor() running to its full 15s timeout in
    // the background on EVERY call (navigateToAdminSection runs 62× per CITE suite,
    // so that orphaned wait was the single largest cost in the run).
    const winner = await waitForFirstVisible(
      page,
      [
        { key: 'admin', locator: adminTable },
        { key: 'keycloak', locator: keycloakField },
      ],
      { timeout: 15000 }
    );

    if (winner === null) {
      // Neither appeared in the window — fall through to the catch's diagnostics.
      throw new Error('Neither admin table nor Keycloak login form became visible');
    }

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
 * Locate a row in a CITE admin list by name, typing into the Search box first so the
 * row is guaranteed onto the (paginated) first page.
 *
 * The admin lists paginate at 50 rows and the test suite seeds plenty of data, so a
 * freshly-created row routinely lands on page 2+. The Search box filters the FULL
 * client-side dataset and only then paginates (see admin-scoring-models.component:
 * applyFilter -> applyPagination), so filtering by the unique name collapses the list
 * to the single matching row on page 1. Scanning raw `tbody tr` without filtering only
 * ever sees page 1 and silently misses rows further down — the root cause of the
 * "element(s) not found" failures across the admin scoring suite.
 *
 * @param page - Playwright Page object
 * @param name - The row's display text to filter and match on
 * @returns A locator for the first matching data row (already filtered onto page 1)
 */
export async function findAdminRowByName(page: Page, name: string) {
  const searchField = page.getByRole('textbox', { name: 'Search' });
  if (await searchField.isVisible({ timeout: 5000 }).catch(() => false)) {
    await searchField.fill(name);
    // The filter applies on valueChanges with no debounce, but give the slice a tick
    // to re-render before we assert on the row.
    await page.waitForTimeout(500);
  }
  return page.locator('tbody tr').filter({ hasText: name }).first();
}

/**
 * Wait for the admin list to fully load data via async chain (permissions -> data).
 * The CITE admin UI loads permissions first, then based on permissions loads the actual data.
 * This can take several seconds as it waits for permissionDataService.load() to complete,
 * then evaluationDataService.load() to complete.
 * @param page - Playwright Page object
 * @param apiEndpoint - The API endpoint pattern (e.g., '/api/evaluations', '/api/teamtypes')
 * @param expectData - Whether to expect data to be present (default true). Set false for empty lists.
 */
export async function waitForAdminListLoad(
  page: Page,
  apiEndpoint: string,
  expectData: boolean = true
): Promise<void> {
  if (expectData) {
    // Wait for at least one real data row (excluding Material's spacer rows). A web-first
    // `expect` polls internally (~100ms) rather than the old 1s `page.evaluate` loop, so a
    // row that lands after, say, 1.3s no longer costs a full 2 seconds of rounding. Same
    // 30s ceiling and same non-throwing contract: on timeout we log and return, leaving the
    // caller's own assertions to produce the actual failure.
    const dataRow = page.locator('tbody tr:not(.mat-mdc-row-spacer):not(.spacer)').filter({ hasText: /\S/ });
    try {
      await expect(dataRow.first()).toBeVisible({ timeout: 30000 });
    } catch {
      console.log('Warning: No table rows found after 30 seconds of polling');
    }
  } else {
    // Empty list: wait for the table element itself to render before the caller asserts
    // emptiness, so an "is empty" check can't fire against a not-yet-rendered table. This
    // replaces a blind 2s sleep with a wait on a concrete signal.
    await page.locator('table').first().waitFor({ state: 'visible', timeout: 10000 }).catch(() => {});
  }
}

/**
 * Delete an evaluation by name - deletes ALL evaluations matching the name
 * @param page - Playwright Page object
 * @param evaluationName - Name/description of the evaluation to delete
 * @returns number of evaluations deleted
 */
export async function deleteEvaluationByName(page: Page, evaluationName: string): Promise<number> {
  let deletedCount = 0;

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

    // Filter by name so matching rows are on page 1 (the list paginates at 50);
    // otherwise rows further down are invisible to the delete loop below.
    await findAdminRowByName(page, evaluationName);

    // Loop to delete all evaluations with matching name
    while (true) {
      const evaluationRow = page.locator('tbody tr').filter({ hasText: evaluationName }).first();
      if (!(await evaluationRow.isVisible({ timeout: 2000 }).catch(() => false))) {
        break;
      }

      // Try to find delete button by title attribute first, fallback to role
      let deleteButton = evaluationRow.locator(`button[title*="Delete ${evaluationName}"]`);
      if (!(await deleteButton.isVisible({ timeout: 1000 }).catch(() => false))) {
        deleteButton = evaluationRow.getByRole('button', { name: 'Delete Evaluation' });
      }

      if (!(await deleteButton.isVisible({ timeout: 1000 }).catch(() => false))) {
        break;
      }

      // The delete button enables only when the row is "selected" (expanded).
      // Clicking the row toggles its expanded state, so poll until the button
      // becomes enabled rather than blindly clicking multiple times.
      let buttonEnabled = false;
      for (let attempt = 0; attempt < 6; attempt++) {
        if (await deleteButton.isEnabled({ timeout: 500 }).catch(() => false)) {
          buttonEnabled = true;
          break;
        }
        await evaluationRow.click();
        await page.waitForTimeout(800);
      }

      if (!buttonEnabled) {
        // One more strict wait; if this fails, exit rather than throw to allow cleanup
        // to surface the original test failure instead of the cleanup error.
        if (!(await deleteButton.isEnabled({ timeout: 2000 }).catch(() => false))) {
          console.log(`Delete button remained disabled for "${evaluationName}"; skipping`);
          break;
        }
      }

      await deleteButton.click();

      const confirmDialog = page.getByRole('dialog', { name: 'Delete this evaluation?' });
      await expect(confirmDialog).toBeVisible({ timeout: 5000 });

      const yesButton = confirmDialog.getByRole('button', { name: 'Yes' });
      await yesButton.click();

      await expect(confirmDialog).not.toBeVisible({ timeout: 5000 });

      // Wait for the row to actually disappear before looking for the next one,
      // otherwise we may find a stale row whose delete button is still disabled.
      await expect(evaluationRow).not.toBeVisible({ timeout: 10000 }).catch(() => {});
      await page.waitForTimeout(500);

      deletedCount++;
      console.log(`Deleted evaluation "${evaluationName}" (${deletedCount})`);
    }

    return deletedCount;
  } catch (error) {
    console.log(`Error deleting evaluations "${evaluationName}":`, error);
    return deletedCount;
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

    // Filter by name first so the row is on page 1 (the list paginates at 50), then
    // take .first() to skip Angular Material spacer rows.
    const scoringModelRow = await findAdminRowByName(page, scoringModelName);
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

  // Best-effort wait for the scoring models API to respond before opening the dropdown.
  // settleForResponse matches on URL only (not status===200) and uses a short timeout,
  // so when the call already fired it returns at once instead of burning the full 15s.
  await settleForResponse(page, '/api/scoringmodels');

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
 * Add the admin user as a member of an evaluation
 * @param page - Playwright Page object
 * @param evaluationName - Description of the evaluation to add member to
 */
export async function addAdminUserToEvaluation(page: Page, evaluationName: string): Promise<void> {
  await navigateToAdminSection(page, 'Evaluations');
  await page.waitForTimeout(2000);

  // Find and click the evaluation row (filter by name so it's on page 1)
  const evalRow = await findAdminRowByName(page, evaluationName);
  await expect(evalRow).toBeVisible({ timeout: 15000 });
  await evalRow.click();
  await page.waitForTimeout(2000);

  // Find and expand the Memberships panel
  const membershipsPanel = page.locator('mat-expansion-panel').filter({ hasText: 'Memberships' }).first();
  await expect(membershipsPanel).toBeVisible({ timeout: 10000 });

  // Check if panel is already expanded, if not expand it
  const panelHeader = membershipsPanel.locator('mat-expansion-panel-header');
  const isExpanded = await membershipsPanel.locator('.mat-expanded').isVisible({ timeout: 1000 }).catch(() => false);

  if (!isExpanded) {
    await panelHeader.click();
    await page.waitForTimeout(1000);
  }

  // Wait for memberships content to load
  const membershipContent = membershipsPanel.locator('.mat-expansion-panel-body, mat-expansion-panel-body').first();
  await expect(membershipContent).toBeVisible({ timeout: 5000 });

  // Look for Admin User in the available users list (left side) and click to add
  // The structure has two panels - non-members on left, members on right
  const adminUserRow = membershipsPanel.locator('tr, mat-row, .user-row').filter({ hasText: 'Admin User' }).first();

  if (await adminUserRow.isVisible({ timeout: 5000 }).catch(() => false)) {
    await adminUserRow.click();
    await page.waitForTimeout(1000);

    // Look for add button (right arrow or plus icon)
    const addButton = membershipsPanel.locator('button').filter({ hasText: /add|→|>|\+/i }).first();
    if (await addButton.isVisible({ timeout: 2000 }).catch(() => false)) {
      await addButton.click();
      await page.waitForTimeout(2000);
    }
  }
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
