// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: specs/blueprint-test-plan.md
// seed: tests/seed.spec.ts

import { test, expect, Services } from '../../fixtures';

/**
 * Remove Unit from MSEL
 *
 * Steps:
 * 1. Navigate to Admin > Units and create a test unit
 * 2. Navigate to Build page and copy the "Project Lagoon TTX - Admin User" MSEL
 * 3. Open the copied MSEL and navigate to Contributors
 * 4. Add the unit via the expansion panel
 * 5. Remove the unit and verify it is gone
 * 6. Delete the copied MSEL
 * 7. Delete the test unit
 */

test.describe('Contributors Management', () => {
  test('Remove Unit from MSEL', async ({ blueprintAuthenticatedPage: page }) => {
    // The MSEL copy API call is slow (can take 2+ minutes for large MSELs)
    test.setTimeout(300000);

    const timestamp = Date.now();
    const SOURCE_MSEL_NAME = 'Project Lagoon TTX - Admin User';
    const COPIED_MSEL_NAME = `${SOURCE_MSEL_NAME} - Admin User`;
    const UNIT_SHORT_NAME = 'RUT';
    const UNIT_NAME = `Remove Unit Test ${timestamp}`;

    // ── Helpers ──────────────────────────────────────────────────────────────────

    /**
     * Navigate to the Admin > Units page.
     * The admin page loads permissions asynchronously, so we must wait for the
     * Units nav item to appear in the sidenav (only shown when canViewUnits=true).
     */
    const navigateToAdminUnits = async () => {
      // The admin page can be slow to load under concurrent access.
      // Retry the full navigation if the sidebar doesn't appear in time.
      for (let attempt = 0; attempt < 3; attempt++) {
        await page.goto(`${Services.Blueprint.UI}/admin`);
        await page.waitForLoadState('domcontentloaded');

        // Wait for the admin sidebar to load nav items (permissions-driven)
        const loaded = await page.waitForSelector('.appitems-container mat-list-item', { state: 'visible', timeout: 30000 })
          .then(() => true)
          .catch(() => false);
        if (loaded) break;
        if (attempt === 2) throw new Error('Admin sidebar did not load after 3 attempts');
      }

      // Click the Units nav item in the sidebar
      const unitsNav = page.locator('.appitems-container mat-list-item').filter({ hasText: 'Units' }).first();
      await expect(unitsNav).toBeVisible({ timeout: 10000 });
      await unitsNav.click();
      await page.waitForTimeout(1000);

      // Wait for the units table to appear (Add Unit button in table header)
      await expect(page.getByRole('button', { name: 'Add Unit' })).toBeVisible({ timeout: 20000 });
    };

    const navigateToBuildPage = async () => {
      await page.goto(`${Services.Blueprint.UI}/build`);
      await page.waitForLoadState('domcontentloaded');
      await expect(page.getByRole('textbox', { name: 'Search' })).toBeVisible({ timeout: 20000 });
      await page.waitForTimeout(2000);
    };

    const deleteAllMselsByName = async (name: string) => {
      let deleteBtn = page.getByRole('button', { name: `Delete ${name}` }).first();
      while (await deleteBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
        await deleteBtn.click();
        const confirmDialog = page.locator('[role="dialog"], .mat-dialog-container').first();
        await expect(confirmDialog).toBeVisible({ timeout: 5000 });
        const confirmButton = page.locator(
          'button:has-text("Confirm"), button:has-text("Delete"), button:has-text("Yes"), button:has-text("YES"), button:has-text("OK")'
        ).last();
        await confirmButton.click();
        await page.waitForTimeout(2000);
        deleteBtn = page.getByRole('button', { name: `Delete ${name}` }).first();
      }
    };

    const deleteAllTestUnits = async (name: string) => {
      let deleteBtn = page.getByRole('button', { name: `Delete ${name}` }).first();
      while (await deleteBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
        await deleteBtn.click();
        const confirmDialog = page.locator('[role="dialog"], .mat-dialog-container').first();
        await expect(confirmDialog).toBeVisible({ timeout: 5000 });
        const confirmButton = page.locator(
          'button:has-text("Confirm"), button:has-text("Delete"), button:has-text("Yes"), button:has-text("YES"), button:has-text("OK")'
        ).last();
        await confirmButton.click();
        await page.waitForTimeout(2000);
        deleteBtn = page.getByRole('button', { name: `Delete ${name}` }).first();
      }
    };

    // ── PHASE A: Create test unit ─────────────────────────────────────────────────
    await navigateToAdminUnits();

    // A1. Pre-cleanup any leftover test units with this name
    await deleteAllTestUnits(UNIT_NAME);

    // A2. Create the test unit
    // expect: clicking "Add Unit" opens a dialog
    const addUnitButton = page.locator('button[title="Add Unit"]').first();
    await expect(addUnitButton).toBeVisible({ timeout: 5000 });
    await addUnitButton.click();
    await page.waitForTimeout(500);

    const addUnitDialog = page.locator('[role="dialog"]').first();
    await expect(addUnitDialog).toBeVisible({ timeout: 5000 });

    const nameField = addUnitDialog.getByRole('textbox', { name: 'Name', exact: true });
    await expect(nameField).toBeVisible({ timeout: 5000 });
    await nameField.fill(UNIT_NAME);

    const shortNameField = addUnitDialog.getByRole('textbox', { name: 'Short Name' });
    await expect(shortNameField).toBeVisible({ timeout: 5000 });
    await shortNameField.fill(UNIT_SHORT_NAME);

    const saveButton = addUnitDialog.getByRole('button', { name: 'Save' });
    await expect(saveButton).toBeEnabled({ timeout: 5000 });
    await saveButton.click();

    // expect: unit appears in the table
    const newUnitCell = page.locator(
      `td:has-text("${UNIT_NAME}"), [role="cell"]:has-text("${UNIT_NAME}")`
    ).first();
    await expect(newUnitCell).toBeVisible({ timeout: 10000 });

    try {
      // ── PHASE B: Copy the source MSEL ──────────────────────────────────────────
      await navigateToBuildPage();

      // B1. Pre-cleanup any leftover copied MSELs from previous runs
      await deleteAllMselsByName(COPIED_MSEL_NAME);

      // B2. Click Copy for the source MSEL
      // expect: clicking Copy creates a new MSEL named "<SOURCE> - Admin User"
      // The Copy button has an isReady flag — wait for it to be enabled before clicking
      const copyButton = page.getByRole('button', { name: `Copy ${SOURCE_MSEL_NAME}` }).first();
      await expect(copyButton).toBeVisible({ timeout: 10000 });
      await expect(copyButton).toBeEnabled({ timeout: 15000 });
      await copyButton.click();

      // The copy API call is slow (large MSEL with many events, can take 2+ minutes).
      // Poll by reloading the build page every 30s rather than relying on SignalR staying
      // connected for the entire duration — SignalR can time out on long operations.
      // expect: copied MSEL link appears in the list when the operation completes
      let copiedMselFound = false;
      for (let poll = 0; poll < 6 && !copiedMselFound; poll++) {
        if (poll === 0) {
          // Give the copy a head start before the first check
          await page.waitForTimeout(15000);
        } else {
          await page.waitForTimeout(30000);
        }
        await navigateToBuildPage();
        copiedMselFound = await page
          .getByRole('link', { name: COPIED_MSEL_NAME, exact: true })
          .first()
          .isVisible({ timeout: 5000 })
          .catch(() => false);
      }
      if (!copiedMselFound) {
        throw new Error(`Copied MSEL "${COPIED_MSEL_NAME}" not found after polling — copy may have failed or timed out`);
      }
      const copiedMselLink = page.getByRole('link', { name: COPIED_MSEL_NAME, exact: true }).first();

      // ── PHASE C: Open copied MSEL → Contributors ────────────────────────────────
      await copiedMselLink.click();
      await page.waitForLoadState('domcontentloaded');
      await page.waitForTimeout(1000);

      // C1. Click Contributors in the left nav
      // expect: Contributors section becomes active
      const contribNavItem = page.locator('text=Contributors').first();
      await expect(contribNavItem).toBeVisible({ timeout: 10000 });
      await contribNavItem.click();
      await page.waitForTimeout(1000);

      const contributorsSection = page.locator('app-msel-contributors').first();
      await expect(contributorsSection).toBeVisible({ timeout: 5000 });

      // ── PHASE D: Add the unit to the MSEL ──────────────────────────────────────
      // D1. Expand "Add a Contributor Unit" panel
      const addContribButton = page.getByRole('button', { name: 'Add a Contributor Unit' });
      await expect(addContribButton).toBeVisible({ timeout: 5000 });
      const isExpanded = await addContribButton.getAttribute('aria-expanded');
      if (isExpanded !== 'true') {
        await addContribButton.click();
        await page.waitForTimeout(500);
      }

      // D2. Click the "+" button to add the test unit to the MSEL
      // expect: the specific unit row is visible in the available units list
      const unitOptionRow = page.locator(`.other-units-div:has-text("${UNIT_NAME}")`).first();
      await expect(unitOptionRow).toBeVisible({ timeout: 5000 });

      // expect: the add button for this specific unit is visible
      const addUnitToMselBtn = unitOptionRow.locator('button[title="Add unit to MSEL"]').first();
      await expect(addUnitToMselBtn).toBeVisible({ timeout: 5000 });
      await addUnitToMselBtn.click();
      await page.waitForTimeout(2000);

      // ── PHASE E: Verify unit appears in Contributors table ─────────────────────
      // expect: unit short name visible in the contributors table
      const unitCell = contributorsSection.locator(
        `td:has-text("${UNIT_SHORT_NAME}"), [role="cell"]:has-text("${UNIT_SHORT_NAME}")`
      ).first();
      await expect(unitCell).toBeVisible({ timeout: 10000 });

      // Record row count before removal
      const elementRows = contributorsSection.locator('table tbody tr.element-row');
      const rowsBefore = await elementRows.count();
      expect(rowsBefore).toBeGreaterThan(0);

      // ── PHASE F: Remove the unit from the MSEL ─────────────────────────────────
      // F1. Click the remove button for the unit row
      const removeBtn = page.locator('button[title="Remove unit from MSEL"]').first();
      await expect(removeBtn).toBeVisible({ timeout: 5000 });
      await removeBtn.click();

      // F2. Confirm the removal dialog
      // expect: dialog with "Remove Contributor" title and YES button
      const confirmDialog = page.locator('[role="dialog"]').first();
      await expect(confirmDialog).toBeVisible({ timeout: 5000 });
      await expect(confirmDialog).toContainText('Remove Contributor', { timeout: 5000 });
      await expect(confirmDialog).toContainText(/Are you sure that you want to remove/i);

      const yesBtn = confirmDialog.getByRole('button', { name: 'YES' });
      await expect(yesBtn).toBeVisible({ timeout: 5000 });
      await yesBtn.click();
      await page.waitForTimeout(1500);

      // ── PHASE G: Verify the unit is gone ───────────────────────────────────────
      // expect: row count decreased
      const rowsAfter = await elementRows.count();
      expect(rowsAfter).toBeLessThan(rowsBefore);

      // expect: unit short name cell is no longer visible
      await expect(
        contributorsSection.locator(`td:has-text("${UNIT_SHORT_NAME}")`)
      ).not.toBeVisible({ timeout: 5000 });

    } finally {
      // ── CLEANUP: Delete copied MSEL and test unit ──────────────────────────────
      // Retry navigation to ensure we actually reach the build page before deleting.
      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          await navigateToBuildPage();
          await deleteAllMselsByName(COPIED_MSEL_NAME);
          break;
        } catch {
          if (attempt === 2) break; // give up silently on final attempt
        }
      }

      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          await navigateToAdminUnits();
          await deleteAllTestUnits(UNIT_NAME);
          break;
        } catch {
          if (attempt === 2) break;
        }
      }

      // expect: unit is no longer in the admin table
      await expect(
        page.locator(`td:has-text("${UNIT_NAME}")`).first()
      ).not.toBeVisible({ timeout: 5000 }).catch(() => {});
    }
  });
});
