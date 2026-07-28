// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { Page, expect } from '@playwright/test';
import { Services, waitForFirstVisible } from '../shared-fixtures';

/**
 * Helper utilities for Steamfitter tests.
 *
 * Unlike CITE (whose lists live under /admin), Steamfitter's Scenario, Scenario
 * Template, Tasks, and History lists all render on the HOME page and are switched
 * via a section dropdown that is reflected in the `tab` query param (see
 * home-app.component.ts `selectTab` -> `queryParams: { tab: section }`). So we
 * navigate by setting `?tab=<Section>` directly.
 */

/** Section names as rendered by the home page's `Section` enum. */
export type HomeSection = 'Scenarios' | 'Scenario Templates' | 'Tasks' | 'History';

/**
 * Navigate to a Steamfitter home section (Scenarios, Scenario Templates, Tasks,
 * History) by setting the `tab` query param, and wait for the section's content
 * to render.
 *
 * With storageState-based auth the browser context already carries a valid OIDC
 * token, so we navigate straight to the URL. A Keycloak-redirect race is retained
 * as a safety net for the rare case where the saved state is missing/expired.
 *
 * @param page - Playwright Page object
 * @param section - Section to switch to (default 'Scenario Templates')
 */
export async function navigateToHomeSection(
  page: Page,
  section: HomeSection = 'Scenario Templates'
): Promise<void> {
  const url = `${Services.Steamfitter.UI}/?tab=${encodeURIComponent(section)}`;

  const handleKeycloakLogin = async () => {
    console.log('Keycloak login page detected during navigation, logging in...');
    await page.fill('input[name="username"]', 'admin');
    await page.fill('input[name="password"]', 'admin');
    try {
      await page.click('button:has-text("Sign In")', { timeout: 2000 });
    } catch {
      await page.click('input[type="submit"]');
    }
    const appHost = new URL(Services.Steamfitter.UI).host;
    await page.waitForURL((navUrl) => navUrl.host === appHost, { timeout: 30000 });
    await page.waitForLoadState('domcontentloaded');
  };

  await page.goto(url, { waitUntil: 'domcontentloaded' });

  // Race the section-menu trigger (authenticated shell rendered) against a Keycloak
  // login form. waitForFirstVisible is cancellation-safe — a bare Promise.race would
  // leave the losing waitFor() running to its full timeout on every call.
  const sectionTrigger = page.locator('button.section-menu-trigger');
  const keycloakField = page.locator('input[name="username"]');

  const winner = await waitForFirstVisible(
    page,
    [
      { key: 'shell', locator: sectionTrigger },
      { key: 'keycloak', locator: keycloakField },
    ],
    { timeout: 20000 }
  );

  if (winner === 'keycloak') {
    await handleKeycloakLogin();
    await expect(sectionTrigger).toBeVisible({ timeout: 20000 });
  } else if (winner === null) {
    throw new Error(
      `Failed to load Steamfitter home section "${section}". Current URL: ${page.url()}`
    );
  }

  // The section trigger label reads "My <selectedSection>"; wait until it reflects
  // the requested section so callers don't act on the previous section's table.
  await expect(sectionTrigger).toContainText(section, { timeout: 10000 });
}

/** Admin sidebar section names (the `section` query param values). */
export type AdminSection = 'Scenario Templates' | 'Scenarios' | 'Users' | 'Roles' | 'Groups';

/**
 * Navigate to a Steamfitter admin section (Users / Roles / Groups / Scenario
 * Templates / Scenarios) by setting the `/admin?section=<Section>` query param, and
 * wait for the admin shell to render.
 *
 * The admin container reads the `section` query param to pick which panel to show
 * (see admin-container.component.ts `selectQueryParams('section')`). As with
 * {@link navigateToHomeSection}, storageState carries a valid token so we navigate
 * straight to the URL, racing the admin shell against a Keycloak form as a safety net.
 *
 * @param page - Playwright Page object
 * @param section - Admin section to open (default 'Users')
 */
export async function navigateToAdminSection(
  page: Page,
  section: AdminSection = 'Users'
): Promise<void> {
  const url = `${Services.Steamfitter.UI}/admin?section=${encodeURIComponent(section)}`;

  const handleKeycloakLogin = async () => {
    console.log('Keycloak login page detected during navigation, logging in...');
    await page.fill('input[name="username"]', 'admin');
    await page.fill('input[name="password"]', 'admin');
    try {
      await page.click('button:has-text("Sign In")', { timeout: 2000 });
    } catch {
      await page.click('input[type="submit"]');
    }
    const appHost = new URL(Services.Steamfitter.UI).host;
    await page.waitForURL((navUrl) => navUrl.host === appHost, { timeout: 30000 });
    await page.waitForLoadState('domcontentloaded');
  };

  await page.goto(url, { waitUntil: 'domcontentloaded' });

  // The admin sidebar renders an "Administration" heading once permissions load; race
  // it against a Keycloak login form.
  const adminHeading = page.getByRole('heading', { name: 'Administration' });
  const keycloakField = page.locator('input[name="username"]');

  const winner = await waitForFirstVisible(
    page,
    [
      { key: 'shell', locator: adminHeading },
      { key: 'keycloak', locator: keycloakField },
    ],
    { timeout: 20000 }
  );

  if (winner === 'keycloak') {
    await handleKeycloakLogin();
    await expect(adminHeading).toBeVisible({ timeout: 20000 });
  } else if (winner === null) {
    throw new Error(
      `Failed to load Steamfitter admin section "${section}". Current URL: ${page.url()}`
    );
  }
}

/**
 * Filter the current home list by typing into the Search box, so a freshly-created
 * row is collapsed onto the first (paginated) page before we match it. The home
 * list paginates at 10 rows, so without filtering a new row routinely lands on a
 * later page and is invisible to the matcher.
 *
 * @param page - Playwright Page object
 * @param text - Text to filter on (typically a unique name)
 * @returns A locator for the first data row matching `text`
 */
export async function findHomeRowByText(page: Page, text: string) {
  const searchField = page.getByRole('textbox', { name: 'Search' });
  if (
    await searchField
      .waitFor({ state: 'visible', timeout: 5000 })
      .then(() => true)
      .catch(() => false)
  ) {
    await searchField.fill(text);
    // The filter applies on input with no debounce; give the slice a tick to render.
    await page.waitForTimeout(300);
  }
  return page.locator('tbody tr.element-row').filter({ hasText: text }).first();
}

/**
 * Ensure the given statuses are selected in the Scenarios section's "Status" filter
 * (a `mat-select multiple` with Active / Ready / Ended options). The Scenarios list
 * defaults to showing only Active + Ready, so a test that needs to see an `ended`
 * scenario must add "Ended" here. Idempotent: only toggles options whose selected
 * state differs from the requested set; leaves the rest untouched.
 *
 * @param page - Playwright Page object
 * @param statuses - the statuses that should be checked after this call
 */
export async function setScenarioStatusFilter(
  page: Page,
  statuses: Array<'Active' | 'Ready' | 'Ended'>
): Promise<void> {
  const statusSelect = page.getByRole('combobox', { name: 'Status' });
  await expect(statusSelect).toBeVisible({ timeout: 10000 });
  await statusSelect.click();

  const wanted = new Set(statuses);
  for (const label of ['Active', 'Ready', 'Ended'] as const) {
    const option = page.getByRole('option', { name: label });
    await expect(option).toBeVisible({ timeout: 5000 });
    const isSelected = (await option.getAttribute('aria-selected')) === 'true';
    if (wanted.has(label) !== isSelected) {
      await option.click();
    }
  }

  // Close the overlay so it doesn't intercept later clicks, and let the filtered
  // slice re-render.
  await page.keyboard.press('Escape');
  await expect(statusSelect).toBeVisible();
}

/**
 * Open the per-row context menu on a home list (Scenario Templates or Scenarios).
 *
 * Each row renders an icon button whose `title` is the menu name ("Scenario
 * Template Menu" or "Scenario Menu"); clicking it opens a shared `mat-menu` whose
 * items (Edit / Copy / Delete / Start / End / Create a Scenario) are gated by
 * permission and row state. Returns once the menu panel is visible so the caller
 * can click an item.
 *
 * @param page - Playwright Page object
 * @param row - Locator for the row whose menu to open
 * @param menuTitle - The button's title attribute (default 'Scenario Template Menu')
 */
export async function openRowContextMenu(
  page: Page,
  row: import('@playwright/test').Locator,
  menuTitle: string = 'Scenario Template Menu'
): Promise<void> {
  const menuButton = row.locator(`button[title="${menuTitle}"]`);
  await expect(menuButton).toBeVisible({ timeout: 10000 });
  await menuButton.click();
  // The mat-menu panel renders detached from the row, at the CDK overlay root.
  await expect(page.locator('.mat-mdc-menu-panel')).toBeVisible({ timeout: 5000 });
}

/**
 * Click an item in the currently-open context `mat-menu` by its visible label
 * (Edit, Copy, Delete, Start, End, "Create a Scenario"), then wait for the menu
 * to close so the follow-up dialog/action isn't clicked through the closing panel.
 *
 * @param page - Playwright Page object
 * @param name - The menu item's text
 */
export async function clickContextMenuItem(page: Page, name: string): Promise<void> {
  const item = page.getByRole('menuitem', { name, exact: true });
  await expect(item).toBeVisible({ timeout: 5000 });
  await item.click();
  await expect(page.locator('.mat-mdc-menu-panel')).not.toBeVisible({ timeout: 5000 });
}

/**
 * Confirm or cancel the CrucibleDialogService confirmation dialog (delete/copy/
 * create-scenario prompts). The dialog renders as a `role="dialog"` with submit
 * ("Confirm") and cancel ("Cancel") buttons; label matching is kept tolerant
 * (Yes/Delete, No) so a future label tweak in crucible-common doesn't break these.
 *
 * @param page - Playwright Page object
 * @param confirm - true to accept (submit), false to dismiss (cancel)
 */
export async function respondToConfirmDialog(page: Page, confirm: boolean): Promise<void> {
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible({ timeout: 5000 });
  const button = confirm
    ? dialog.getByRole('button', { name: /Confirm|Yes|Delete/i })
    : dialog.getByRole('button', { name: /Cancel|No/i });
  await expect(button).toBeVisible({ timeout: 5000 });
  await button.click();
  await expect(dialog).not.toBeVisible({ timeout: 10000 });
}

/**
 * Expand a Scenario Template row so its task tree (`app-tasks`) renders, and wait
 * until the tree's toolbar is visible.
 *
 * Steamfitter shows a template's tasks inside an expandable detail row: clicking the
 * template row toggles `expandedScenarioTemplateId`, which mounts
 * `<app-scenario-template-edit>` -> `<app-tasks>`. The task tree exposes an "Add a
 * Task" button in its header, so we wait on that as the ready signal.
 *
 * @param page - Playwright Page object
 * @param row - Locator for the template row to expand
 */
export async function expandScenarioTemplateRow(
  page: Page,
  row: import('@playwright/test').Locator
): Promise<void> {
  await expect(row).toBeVisible({ timeout: 10000 });
  const addTaskButton = page.locator('button[title="Add a Task"]');
  // Clicking the row toggles the detail panel; if a prior action already expanded a
  // different row, one click still lands on this row's cells and expands it.
  if (!(await addTaskButton.isVisible().catch(() => false))) {
    await row.click();
  }
  await expect(addTaskButton).toBeVisible({ timeout: 10000 });
}

/**
 * Locate a task node in the currently-rendered task tree by its name. Task nodes are
 * `mat-tree-node`s whose label shows the task name; filtering by text isolates the
 * one we seeded/created without depending on tree order.
 *
 * @param page - Playwright Page object
 * @param name - The task's name
 */
export function findTaskNode(page: Page, name: string) {
  return page.locator('mat-tree-node').filter({ hasText: name }).first();
}

/**
 * Open a task's context menu from its tree node. Each node renders a `button
 * title="Task Menu"` that opens the shared task `mat-menu` (Edit / Copy / Cut /
 * Paste / New / Delete, gated by permission and state). Returns once the panel is
 * visible so the caller can click an item with {@link clickContextMenuItem}.
 *
 * @param page - Playwright Page object
 * @param taskNode - Locator for the task's `mat-tree-node`
 */
export async function openTaskMenu(
  page: Page,
  taskNode: import('@playwright/test').Locator
): Promise<void> {
  const menuButton = taskNode.locator('button[title="Task Menu"]');
  await expect(menuButton).toBeVisible({ timeout: 10000 });
  await menuButton.click();
  await expect(page.locator('.mat-mdc-menu-panel')).toBeVisible({ timeout: 5000 });
}

/**
 * Fields settable on the Task add/edit dialog. All optional so an edit can change
 * just one. `action` and `iterationTermination`/`triggerCondition` are chosen from
 * mat-select dropdowns by their visible label; the numeric fields are typed as
 * strings. `vmMask` only exists in the DOM when the selected `action` requires a VM,
 * so pass `action` (a VM-requiring one, e.g. "Power on a VM") alongside it.
 */
export interface TaskDialogFields {
  name?: string;
  description?: string;
  /** Visible label in the "Select an Action" dropdown, e.g. "GET Request". */
  action?: string;
  /** Trigger Condition option label: Time / Manual / Completion / Success / Failure / Expiration. */
  triggerCondition?: string;
  expectedOutput?: string;
  delaySeconds?: string;
  iterations?: string;
  intervalSeconds?: string;
  /** IterationTermination option label: IterationCount / UntilSuccess / UntilFailure. */
  iterationTermination?: string;
  /** Only applies when `action` requires a VM (the VM Mask field is conditionally rendered). */
  vmMask?: string;
}

/**
 * Fill the Task add/edit dialog (crucible-dialog, title "Edit Task") and Save.
 *
 * The dialog is opened by the caller ("Add a Task" or the task menu's Edit). Its Save
 * button is gated only on a non-empty Name (`errorFree()`), so a name is enough to
 * persist. Waits on the tasks POST/PUT before asserting the dialog closed, so callers
 * assert against a persisted task.
 *
 * Two binding styles coexist in this dialog: Name/Description/Expected Output/VM Mask
 * are one-way `[value]` inputs that the async Action-list load can re-bind (and wipe)
 * mid-fill, so we fill them inside expect.toPass; Trigger/Iteration/Score/Delay use
 * two-way `[(ngModel)]` and are stable. `action` must be selected before `vmMask`
 * because the VM Mask field only renders for VM-requiring actions.
 *
 * @param page - Playwright Page object
 * @param fields - the task fields to set (see {@link TaskDialogFields})
 */
export async function fillTaskDialog(page: Page, fields: TaskDialogFields): Promise<void> {
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByRole('heading', { name: 'Edit Task' })).toBeVisible({ timeout: 5000 });

  // The dialog's Action list loads asynchronously; when it renders it re-binds the
  // dialog's one-way `[value]` inputs, which can wipe a value we filled a moment
  // earlier. Wait for the Action select to be present first, then fill each field
  // inside expect.toPass so a mid-fill re-render is simply retried.
  await expect(dialog.getByRole('combobox', { name: /Select an Action/ })).toBeVisible({
    timeout: 10000,
  });

  const fillAndConfirm = async (field: import('@playwright/test').Locator, value: string) => {
    await expect(async () => {
      await field.fill(value);
      await expect(field).toHaveValue(value, { timeout: 1000 });
    }).toPass({ timeout: 10000 });
  };

  const selectOption = async (
    combobox: import('@playwright/test').Locator,
    optionLabel: string
  ) => {
    await combobox.click();
    // Match by substring: Action options render as "<api> - <display>" (e.g.
    // "vm - Power on a VM"), and no option label is a substring of another within any
    // one of these dropdowns, so hasText is unambiguous.
    const option = page.getByRole('option').filter({ hasText: optionLabel }).first();
    await option.click();
    await expect(option).not.toBeVisible({ timeout: 5000 });
  };

  if (fields.name !== undefined) {
    await fillAndConfirm(dialog.getByRole('textbox', { name: /Name/ }), fields.name);
  }
  if (fields.description !== undefined) {
    await fillAndConfirm(dialog.getByRole('textbox', { name: /Description/ }), fields.description);
  }
  // Select the Action before VM Mask so the VM-dependent field is rendered.
  if (fields.action !== undefined) {
    await selectOption(dialog.getByRole('combobox', { name: /Select an Action/ }), fields.action);
  }
  if (fields.triggerCondition !== undefined) {
    await selectOption(
      dialog.getByRole('combobox', { name: /Trigger Condition/ }),
      fields.triggerCondition
    );
  }
  if (fields.expectedOutput !== undefined) {
    await fillAndConfirm(
      dialog.getByRole('textbox', { name: /Expected Output/ }),
      fields.expectedOutput
    );
  }
  if (fields.delaySeconds !== undefined) {
    await fillAndConfirm(
      dialog.getByRole('spinbutton', { name: /Delay \(seconds\)/ }),
      fields.delaySeconds
    );
  }
  if (fields.iterations !== undefined) {
    await fillAndConfirm(
      dialog.getByRole('spinbutton', { name: /Number of Iterations/ }),
      fields.iterations
    );
  }
  if (fields.intervalSeconds !== undefined) {
    await fillAndConfirm(
      dialog.getByRole('spinbutton', { name: /Interval \(seconds\)/ }),
      fields.intervalSeconds
    );
  }
  if (fields.iterationTermination !== undefined) {
    await selectOption(
      dialog.getByRole('combobox', { name: /IterationTermination/ }),
      fields.iterationTermination
    );
  }
  if (fields.vmMask !== undefined) {
    await fillAndConfirm(dialog.getByRole('textbox', { name: /VM Mask/ }), fields.vmMask);
  }

  const saveResponse = page.waitForResponse(
    (response) =>
      /\/api\/tasks(\/|\?|$)/.test(response.url()) &&
      ['POST', 'PUT'].includes(response.request().method()) &&
      response.ok(),
    { timeout: 15000 }
  );

  const saveButton = dialog.getByRole('button', { name: 'Save' });
  await expect(saveButton).toBeEnabled({ timeout: 5000 });
  await saveButton.click();
  await saveResponse.catch(() => {});
  await expect(dialog).not.toBeVisible({ timeout: 10000 });
}

/**
 * Fill the Scenario Template add/edit dialog (crucible-dialog) and Save.
 *
 * The dialog is opened by the caller (Add button or context-menu Edit). Fields are
 * optional so an edit can change just one of them; when a field is omitted its
 * current value is left untouched. Waits on the scenarioTemplates POST/PUT before
 * asserting the dialog closed, so callers assert against a persisted row.
 *
 * @param page - Playwright Page object
 * @param fields - name / description / durationHours to set
 */
export async function fillScenarioTemplateDialog(
  page: Page,
  fields: { name?: string; description?: string; durationHours?: string }
): Promise<void> {
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible({ timeout: 5000 });

  if (fields.name !== undefined) {
    const nameField = dialog.getByRole('textbox', { name: /Name/ });
    await nameField.fill(fields.name);
    await expect(nameField).toHaveValue(fields.name);
  }
  if (fields.description !== undefined) {
    const descriptionField = dialog.getByRole('textbox', { name: /Description/ });
    await descriptionField.fill(fields.description);
    await expect(descriptionField).toHaveValue(fields.description);
  }
  if (fields.durationHours !== undefined) {
    const durationField = dialog.getByRole('spinbutton', { name: /Duration Hours/ });
    await durationField.fill(fields.durationHours);
    await expect(durationField).toHaveValue(fields.durationHours);
  }

  const saveResponse = page.waitForResponse(
    (response) =>
      response.url().includes('/api/scenarioTemplates') &&
      ['POST', 'PUT'].includes(response.request().method()) &&
      response.ok(),
    { timeout: 15000 }
  );

  const saveButton = dialog.getByRole('button', { name: 'Save' });
  await expect(saveButton).toBeEnabled({ timeout: 5000 });
  await saveButton.click();
  await saveResponse.catch(() => {});
  await expect(dialog).not.toBeVisible({ timeout: 10000 });
}
