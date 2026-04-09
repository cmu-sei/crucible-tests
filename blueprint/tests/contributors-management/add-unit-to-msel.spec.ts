// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: specs/blueprint-test-plan.md
// seed: tests/seed.spec.ts

import { test, expect, Services } from '../../fixtures';

test.describe('Contributors Management', () => {
   test('Add Unit to MSEL', async ({ blueprintAuthenticatedPage: page }) => {
    // The MSEL copy API call is slow (can take 2+ minutes for large MSELs)
    test.setTimeout(300000);
    const timestamp = Date.now();
    const sourceMselName = 'Project Lagoon TTX - Admin User';
    // When copied, the app auto-names the copy "[Original Name] - Admin User"
    const clonedMselName = `${sourceMselName} - Admin User`;
    const unitShortName = 'TU';
    const unitName = `Test Unit ${timestamp}`;

    // Helper: navigate to the build page and wait for the MSEL list to appear.
    // Blueprint uses Angular Material tables (divs) and SignalR — avoid 'networkidle'.
    const navigateToBuildPage = async () => {
      await page.goto(`${Services.Blueprint.UI}/build`);
      await page.waitForLoadState('domcontentloaded');
      // Wait for the search box which appears once the build page is ready
      await expect(page.getByRole('textbox', { name: 'Search' })).toBeVisible({ timeout: 20000 });
      // Extra wait for MSEL data to load from the API
      await page.waitForTimeout(2000);
    };

    // Helper: navigate to Admin Units section and wait for it to be ready.
    // The admin page loads permissions asynchronously, so we must wait for the
    // Units nav item to appear in the sidenav (only shown when canViewUnits=true).
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

    // Helper: delete all MSELs whose delete button matches the given name
    const deleteAllMselsByName = async (name: string) => {
      let deleteBtn = page.getByRole('button', { name: `Delete ${name}` }).first();
      while (await deleteBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
        await deleteBtn.click();
        const confirmDialog = page.locator('[role="dialog"], .mat-dialog-container').first();
        await expect(confirmDialog).toBeVisible({ timeout: 5000 });
        const confirmButton = page.locator(
          'button:has-text("Confirm"), button:has-text("Delete"), button:has-text("Yes"), button:has-text("OK")'
        ).last();
        await confirmButton.click();
        await page.waitForTimeout(2000);
        deleteBtn = page.getByRole('button', { name: `Delete ${name}` }).first();
      }
    };

    // Helper: delete all units with the given exact name
    const deleteAllTestUnits = async (name: string) => {
      let deleteBtn = page.getByRole('button', { name: `Delete ${name}` }).first();
      while (await deleteBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
        await deleteBtn.click();
        const confirmDialog = page.locator('[role="dialog"], .mat-dialog-container').first();
        await expect(confirmDialog).toBeVisible({ timeout: 5000 });
        const confirmButton = page.locator(
          'button:has-text("Confirm"), button:has-text("Delete"), button:has-text("Yes"), button:has-text("OK")'
        ).last();
        await confirmButton.click();
        await page.waitForTimeout(2000);
        deleteBtn = page.getByRole('button', { name: `Delete ${name}` }).first();
      }
    };

    // ── PHASE A: Admin setup — clean up leftovers and create the test unit ────────
    // Navigate to admin once for both pre-cleanup and unit creation
    await navigateToAdminUnits();

    // A1. Delete any leftover test units from previous runs (same name = same timestamp)
    await deleteAllTestUnits(unitName);

    // A2. Create the test unit
    // expect: Unit creation form/dialog appears
    const addUnitButton = page.getByRole('button', { name: 'Add Unit' });
    await expect(addUnitButton).toBeVisible({ timeout: 5000 });
    await addUnitButton.click();
    await page.waitForTimeout(500);

    const form = page.locator('[role="dialog"]').first();
    await expect(form).toBeVisible({ timeout: 5000 });

    // Fill Name field (first required field in the dialog)
    const nameField = page.getByRole('textbox', { name: 'Name' }).first();
    await expect(nameField).toBeVisible({ timeout: 5000 });
    await nameField.fill(unitName);

    // Fill Short Name field
    const shortNameField = page.getByRole('textbox', { name: 'Short Name' }).first();
    await expect(shortNameField).toBeVisible({ timeout: 5000 });
    await shortNameField.fill(unitShortName);

    // Save the unit (wait for Save to become enabled)
    const saveButton = page.getByRole('button', { name: 'Save' });
    await expect(saveButton).toBeEnabled({ timeout: 5000 });
    await saveButton.click();

    // expect: Unit is created and appears in the units table
    const newUnitCell = page.locator(
      `td:has-text("${unitName}"), [role="cell"]:has-text("${unitName}")`
    ).first();
    await expect(newUnitCell).toBeVisible({ timeout: 10000 });

    try {
      // ── PHASE B: Build page — clean up and clone the source MSEL ─────────────────
      await navigateToBuildPage();

      // B1. Delete any existing clones from previous runs
      await deleteAllMselsByName(clonedMselName);

      // B2. Click Copy for the source MSEL — creates a clone named "[Original] - Admin User"
      // expect: Clicking Copy creates a new MSEL entry in the list
      const copyButton = page.getByRole('button', { name: `Copy ${sourceMselName}` }).first();
      await expect(copyButton).toBeVisible({ timeout: 5000 });
      await copyButton.click();

      // The copy API call is slow (large MSEL with many events, can take 2+ minutes).
      // Poll by reloading the build page every 30s rather than relying on SignalR staying
      // connected for the entire duration — SignalR can time out on long operations.
      // expect: copied MSEL link appears in the list when the operation completes
      let clonedMselFound = false;
      for (let poll = 0; poll < 6 && !clonedMselFound; poll++) {
        if (poll === 0) {
          // Give the copy a head start before the first check
          await page.waitForTimeout(15000);
        } else {
          await page.waitForTimeout(30000);
        }
        await navigateToBuildPage();
        clonedMselFound = await page
          .getByRole('link', { name: clonedMselName, exact: true })
          .first()
          .isVisible({ timeout: 5000 })
          .catch(() => false);
      }
      if (!clonedMselFound) {
        throw new Error(`Copied MSEL "${clonedMselName}" not found after polling — copy may have failed or timed out`);
      }

      // ── PHASE C: Open the cloned MSEL and add the unit to Contributors ────────────

      // C1. Click the cloned MSEL link to open it
      // expect: The cloned MSEL detail page loads
      const mselLink = page.getByRole('link', { name: clonedMselName, exact: true }).first();
      await expect(mselLink).toBeVisible({ timeout: 5000 });
      await mselLink.click();
      await page.waitForLoadState('domcontentloaded');

      // expect: The MSEL detail page title reflects the cloned MSEL name
      await expect(page).toHaveTitle(
        new RegExp(clonedMselName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')),
        { timeout: 10000 }
      );

      // C2. Click the Contributors nav item in the left sidebar
      // expect: Contributors section becomes active showing the "Add a Contributor Unit" panel
      const contribEl = page.locator('text=Contributors').first();
      await expect(contribEl).toBeVisible({ timeout: 5000 });
      await contribEl.click();
      await page.waitForTimeout(1000);

      // expect: "Add a Contributor Unit" expansion panel button is visible
      const addContribButton = page.getByRole('button', { name: 'Add a Contributor Unit' });
      await expect(addContribButton).toBeVisible({ timeout: 5000 });

      // C3. Expand the "Add a Contributor Unit" panel if not already open
      const isExpanded = await addContribButton.getAttribute('aria-expanded');
      if (isExpanded !== 'true') {
        await addContribButton.click();
        await page.waitForTimeout(500);
      }

      // expect: The unit list appears inside the panel
      // Each available unit has a row with class .other-units-div
      const unitOptionRow = page.locator(`.other-units-div:has-text("${unitName}")`).first();
      await expect(unitOptionRow).toBeVisible({ timeout: 5000 });

      // C4. Click the add button for the specific test unit
      const addUnitToMselButton = unitOptionRow.locator('button[title="Add unit to MSEL"]').first();
      await expect(addUnitToMselButton).toBeVisible({ timeout: 5000 });
      await addUnitToMselButton.click();
      await page.waitForTimeout(2000);

      // ── PHASE D: Verify the unit appears in the Contributors table ────────────────
      // expect: The unit's short name appears in the contributors table
      const unitInTable = page.locator(
        `[role="cell"]:has-text("${unitShortName}"), ` +
        `td:has-text("${unitShortName}")`
      ).first();
      await expect(unitInTable).toBeVisible({ timeout: 10000 });

    } finally {
      // ── CLEANUP: Delete the cloned MSEL and the test unit ─────────────────────────
      // Retry navigation to ensure we actually reach the build page before deleting.
      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          await navigateToBuildPage();
          await deleteAllMselsByName(clonedMselName);
          break;
        } catch {
          if (attempt === 2) break;
        }
      }

      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          await navigateToAdminUnits();
          await deleteAllTestUnits(unitName);
          break;
        } catch {
          if (attempt === 2) break;
        }
      }
    }
  });
});
