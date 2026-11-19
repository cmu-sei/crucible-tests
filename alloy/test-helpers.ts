// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { Locator, Page, expect } from '@playwright/test';
import { Services } from '../shared-fixtures';

/**
 * Themes every Alloy functional spec is parameterized over. Each spec runs once
 * per entry so every screen is exercised in both light and dark mode.
 */
export const ALLOY_THEMES = ['light', 'dark'] as const;
export type AlloyTheme = (typeof ALLOY_THEMES)[number];

/** True when the Alloy UI is currently rendering in dark mode. */
export async function alloyIsDarkTheme(page: Page): Promise<boolean> {
  return page.evaluate(() => document.body.classList.contains('darkMode'));
}

/**
 * The top-bar user-menu button. It is labelled with the signed-in user's name, so this
 * finds it by position rather than by "Admin User": a spec signed in as a seeded user
 * has no such button, and on the admin page `name: 'Admin User'` also matches every
 * Event Template whose "Edit: <name> - Admin User" title carries the creator's name.
 */
export function alloyUserMenuButton(page: Page): Locator {
  return page.locator('.user-text').getByRole('button');
}

/**
 * Put the Alloy UI into the requested theme by writing the persisted preference and
 * reloading, then wait for the user menu and <body> to reflect it. No menu clicks.
 *
 * Alloy's theme lives only in the browser: the `auth.ui` slice of the Akita auth store
 * (@cmusei/crucible-common), persisted to localStorage under 'akita-alloy-ui'
 * (`main.ts`) and rehydrated before AppComponent applies it. Nothing reads it from the
 * server, and no component overrides it on bootstrap. Akita stores the slice under the
 * store name, so the shape is `{"auth":{"theme":"dark-theme"},"$cache":{"auth":false}}`
 * (captured from alloy.ui after a UI toggle, crucible-common 0.8.0) — NOT
 * `{"auth":{"ui":...}}`. The key is absent until the theme first changes, so it is
 * merged into, not replaced. A fresh browser context defaults to light, so requesting
 * 'light' is a no-op. `?theme=` is not used: once seen, AppComponent writes it back
 * onto the URL on every later theme change, which would leak it into URL assertions.
 *
 * The reload is safe for Alloy's sessionStorage-held OIDC token: a reload keeps the
 * tab's sessionStorage (and the `page` fixture's init script replays the saved one).
 * Specs whose subject is the toggle control use `toggleAlloyThemeViaMenu`.
 */
export async function applyAlloyTheme(page: Page, theme: AlloyTheme): Promise<void> {
  const wantDark = theme === 'dark';
  if ((await alloyIsDarkTheme(page)) === wantDark) {
    return;
  }

  await page.evaluate((value) => {
    const key = 'akita-alloy-ui';
    let state: Record<string, any> = {};
    try {
      state = JSON.parse(localStorage.getItem(key) ?? '{}') ?? {};
    } catch {
      state = {};
    }
    state.auth = { ...(state.auth ?? {}), theme: value };
    localStorage.setItem(key, JSON.stringify(state));
  }, wantDark ? 'dark-theme' : 'light-theme');

  await page.reload({ waitUntil: 'domcontentloaded' });
  await expect(alloyUserMenuButton(page)).toBeVisible({ timeout: 15000 });
  await expect.poll(() => alloyIsDarkTheme(page), { timeout: 10000 }).toBe(wantDark);
}

/**
 * Put the Alloy UI into the requested theme via the top-bar user menu's "Dark Theme"
 * switch, then wait until <body> reflects the change. For specs whose subject is the
 * toggle control itself; everything else uses `applyAlloyTheme`. No-ops when the
 * requested theme is already active.
 */
export async function toggleAlloyThemeViaMenu(page: Page, theme: AlloyTheme): Promise<void> {
  const wantDark = theme === 'dark';
  if ((await alloyIsDarkTheme(page)) === wantDark) {
    return;
  }

  await alloyUserMenuButton(page).click();
  const toggle = page.getByRole('switch', { name: 'Dark Theme' });
  await toggle.waitFor({ state: 'visible', timeout: 10000 });
  await toggle.click();
  await page.keyboard.press('Escape');

  // Wait for the user-menu overlay to fully tear down before returning. A test
  // that opens the menu next (e.g. to reach "Administration") would otherwise
  // race a lingering CDK backdrop that silently intercepts its clicks.
  await page
    .locator('.cdk-overlay-backdrop')
    .waitFor({ state: 'detached', timeout: 5000 })
    .catch(() => {});
  await page
    .locator('.mat-mdc-menu-panel')
    .waitFor({ state: 'detached', timeout: 5000 })
    .catch(() => {});

  await page.locator('body').evaluate(
    (body, expected) =>
      new Promise<void>((resolve, reject) => {
        if (body.classList.contains('darkMode') === expected) return resolve();
        const observer = new MutationObserver(() => {
          if (body.classList.contains('darkMode') === expected) {
            observer.disconnect();
            resolve();
          }
        });
        observer.observe(body, { attributes: true, attributeFilter: ['class'] });
        setTimeout(() => {
          observer.disconnect();
          reject(new Error(`Alloy theme did not become ${expected ? 'dark' : 'light'}`));
        }, 10000);
      }),
    wantDark
  );
}

async function closeOpenDialogs(page: Page): Promise<void> {
  for (let i = 0; i < 3; i++) {
    const openDialog = page.getByRole('dialog').first();
    if (!(await openDialog.isVisible({ timeout: 500 }).catch(() => false))) {
      return;
    }

    const cancelButton = openDialog.getByRole('button', { name: /Cancel|Close/i });
    if (await cancelButton.isVisible({ timeout: 500 }).catch(() => false)) {
      await cancelButton.click();
    } else {
      await page.keyboard.press('Escape');
    }

    await expect(openDialog).not.toBeVisible({ timeout: 5000 }).catch(() => {});
  }
}

/**
 * Navigate to the Alloy admin Event Templates page.
 * Handles cases where the page is already on admin or needs re-navigation.
 */
async function ensureOnAdminPage(page: Page): Promise<void> {
  if (!page.url().includes('/admin')) {
    await page.goto(`${Services.Alloy.UI}/admin`, { waitUntil: 'domcontentloaded' });
  }

  await closeOpenDialogs(page);

  const adminHeading = page.getByRole('heading', { name: 'Administration' });
  const eventTemplatesTable = page.getByRole('table');
  const adminLoaded =
    (await adminHeading.isVisible({ timeout: 2000 }).catch(() => false)) &&
    (await eventTemplatesTable.isVisible({ timeout: 2000 }).catch(() => false));

  if (!adminLoaded) {
    await page.goto(`${Services.Alloy.UI}/admin`, { waitUntil: 'domcontentloaded' });
    await closeOpenDialogs(page);
  }

  await expect(adminHeading).toBeVisible({ timeout: 30000 });
  await expect(eventTemplatesTable).toBeVisible({ timeout: 30000 });
}

/**
 * Wait for a Material dialog to finish opening before typing into it.
 */
export async function waitForDialogOpen(dialog: Locator): Promise<void> {
  await expect(dialog).toBeVisible();
  await expect(dialog.locator(':focus')).toHaveCount(1);
}

export async function fillFieldAndVerify(field: Locator, value: string): Promise<void> {
  let lastError: unknown;

  for (let attempt = 0; attempt < 2; attempt++) {
    await field.click();
    await field.fill(value);

    try {
      await expect(field).toHaveValue(value, { timeout: 5000 });
      return;
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError;
}

/**
 * On the admin Event Templates list, search for `name` and return its row's Edit
 * button once the filtered row is visible. The list paginates, so a template created
 * moments ago can sit on page 2 of the unfiltered list. Alloy filters on keyup, so the
 * term is typed rather than filled.
 */
export async function findEventTemplateEditButton(page: Page, name: string, timeout = 10000): Promise<Locator> {
  const searchBox = page.getByRole('textbox', { name: 'Search' });
  await searchBox.fill('');
  await searchBox.pressSequentially(name);
  const editButton = page.getByRole('button', { name: `Edit: ${name}`, exact: true });
  await expect(editButton).toBeVisible({ timeout });
  return editButton;
}

/**
 * Delete an event template by name via the admin UI.
 * Handles the confirmation dialog and waits for the row to disappear.
 * Errors are caught and logged rather than thrown to avoid masking original test failures.
 */
export async function deleteEventTemplateByName(page: Page, name: string): Promise<boolean> {
  try {
    await ensureOnAdminPage(page);

    await closeOpenDialogs(page);

    let editButton: Locator;
    try {
      editButton = await findEventTemplateEditButton(page, name, 5000);
    } catch {
      console.log(`Event template "${name}" not found for cleanup`);
      return false;
    }

    await editButton.click();

    const editDialog = page.getByRole('dialog', { name: 'Edit Event Template' });
    await expect(editDialog).toBeVisible({ timeout: 5000 });

    await editDialog.getByRole('button', { name: 'Delete' }).click();

    const confirmDialog = page.getByRole('dialog', { name: 'Delete Event Template' });
    await expect(confirmDialog).toBeVisible({ timeout: 5000 });
    await confirmDialog.getByRole('button', { name: 'Delete' }).click();

    await expect(editDialog).not.toBeVisible({ timeout: 10000 });

    console.log(`Deleted event template "${name}"`);
    return true;
  } catch (error) {
    console.log(`Error deleting event template "${name}":`, (error as Error).message);
    return false;
  }
}

/**
 * Delete all event templates matching a name pattern via the admin UI.
 * Searches across paginated results by searching for matching names.
 */
export async function deleteEventTemplatesByPattern(page: Page, searchTerm: string): Promise<number> {
  let deletedCount = 0;
  const maxAttempts = 10;

  try {
    await ensureOnAdminPage(page);

    const searchBox = page.getByRole('textbox', { name: 'Search' });
    await searchBox.pressSequentially(searchTerm);
    // Only ever touch templates whose name contains the term: until the list has
    // filtered, the first Edit button can be another (concurrent) test's template.
    const escaped = searchTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const matchingEdit = page.getByRole('button', { name: new RegExp(`^Edit: .*${escaped}`, 'i') });
    await expect(matchingEdit.first()).toBeVisible({ timeout: 5000 }).catch(() => {});

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const openDialog = page.getByRole('dialog').first();
      if (await openDialog.isVisible({ timeout: 500 }).catch(() => false)) {
        await page.keyboard.press('Escape');
        await expect(openDialog).not.toBeVisible({ timeout: 3000 });
      }

      const editButton = matchingEdit.first();
      if (!(await editButton.isVisible().catch(() => false))) {
        break;
      }

      await editButton.click();

      const editDialog = page.getByRole('dialog', { name: 'Edit Event Template' });
      if (!(await editDialog.waitFor({ state: 'visible', timeout: 3000 }).then(() => true, () => false))) {
        break;
      }

      const deleteButton = editDialog.getByRole('button', { name: 'Delete' });
      if (!(await deleteButton.waitFor({ state: 'visible', timeout: 2000 }).then(() => true, () => false))) {
        await page.keyboard.press('Escape');
        break;
      }
      await deleteButton.click();

      const confirmDialog = page.getByRole('dialog', { name: 'Delete Event Template' });
      if (!(await confirmDialog.waitFor({ state: 'visible', timeout: 3000 }).then(() => true, () => false))) {
        break;
      }
      await confirmDialog.getByRole('button', { name: 'Delete' }).click();

      await editDialog.waitFor({ state: 'hidden', timeout: 10000 }).catch(() => {});

      deletedCount++;
    }

    await searchBox.fill('');

    if (deletedCount > 0) {
      console.log(`Cleaned up ${deletedCount} event template(s) matching "${searchTerm}"`);
    }
  } catch (error) {
    console.log(`Error cleaning up event templates matching "${searchTerm}":`, (error as Error).message);
  }

  return deletedCount;
}

/**
 * Create an event template via the admin UI and return its name.
 * The caller is responsible for cleaning up the template after the test.
 * Assumes the page is already authenticated and on the admin Event Templates page.
 *
 * As of Alloy.ui PR #711, the "Add Event Template" button opens the dialog of
 * the same name with an empty form instead of inserting a default "New Event
 * Template" row. The template is only POSTed when Save is clicked, so we fill
 * the form (name + duration are required), save it, and wait for the UI to show
 * the created row. The UI state is the stable contract these tests need; a
 * raw waitForResponse here was flaky under parallel load even when the create
 * eventually succeeded.
 */
export async function createTestEventTemplate(
  page: Page,
  name: string,
  options: { description?: string; durationHours?: string } = {}
): Promise<string> {
  const { description = 'Auto-created for testing', durationHours = '2' } = options;

  await ensureOnAdminPage(page);

  // Click Add Event Template to open the create dialog (no API call yet).
  const createDialog = page.getByRole('dialog', { name: 'Add Event Template' });
  await page.getByRole('button', { name: 'Add Event Template' }).click();
  await waitForDialogOpen(createDialog);

  // Fill in the name, description, and duration. Name and Duration Hours are
  // required; duration must be an integer greater than 0.
  const nameField = createDialog.getByRole('textbox', { name: /^Name/ });
  await fillFieldAndVerify(nameField, name);

  const descField = createDialog.getByRole('textbox', { name: 'Event Template Description' });
  await fillFieldAndVerify(descField, description);

  const durationField = createDialog.getByRole('spinbutton', { name: 'Duration Hours' });
  await fillFieldAndVerify(durationField, durationHours);

  // Save. The template is created on save; wait for the user-visible result
  // rather than a specific network response that can be missed or delayed.
  const saveButton = createDialog.getByRole('button', { name: 'Save' });
  await expect(saveButton).toBeEnabled({ timeout: 5000 });
  await saveButton.click();

  await expect(createDialog).not.toBeVisible({ timeout: 60000 });
  await expect(page.getByRole('cell', { name }).first()).toBeVisible({ timeout: 30000 });

  console.log(`Created test event template "${name}"`);
  return name;
}

/**
 * End and clean up events visible on the admin Events page.
 * Navigates to the Events section and ends any active events.
 */
export async function cleanupEndedEvents(page: Page): Promise<void> {
  try {
    await page.goto(`${Services.Alloy.UI}/admin`, { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('heading', { name: 'Administration' })).toBeVisible({ timeout: 15000 });

    // Click on Events in the sidebar
    const eventsNav = page.locator('mat-list-item').filter({ hasText: 'Events' });
    if (await eventsNav.isVisible({ timeout: 2000 }).catch(() => false)) {
      await eventsNav.click();
      await expect(page.getByRole('heading', { name: /Events/i })).toBeVisible({ timeout: 5000 });
    }
  } catch (error) {
    console.log('Error cleaning up events:', (error as Error).message);
  }
}
